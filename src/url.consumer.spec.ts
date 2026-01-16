import { Test, TestingModule } from '@nestjs/testing';
import { Nack } from '@golevelup/nestjs-rabbitmq';
import { UrlConsumer } from './url.consumer';
import { AppService } from './app/app.service';

jest.mock('uuid', () => ({
    v4: () => 'test-request-id',
}));

describe('UrlConsumer', () => {
    let consumer: UrlConsumer;
    let mockAppService: Partial<AppService>;

    beforeEach(async () => {
        mockAppService = {
            processInBatches: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UrlConsumer,
                {
                    provide: AppService,
                    useValue: mockAppService,
                },
            ],
        }).compile();

        consumer = module.get<UrlConsumer>(UrlConsumer);
    });

    it('should be defined', () => {
        expect(consumer).toBeDefined();
    });

    describe('processChunk', () => {
        describe('Valid Messages', () => {
            it('should process valid message successfully', async () => {
                const message = {
                    requestId: 'req-123',
                    inputs: [
                        { scanId: 'req-123', urlId: 'url-1', url: 'https://example.com' },
                        { scanId: 'req-123', urlId: 'url-2', url: 'https://test.com' },
                    ],
                };

                (mockAppService.processInBatches as jest.Mock).mockResolvedValue(undefined);

                await consumer.processChunk(message);

                expect(mockAppService.processInBatches).toHaveBeenCalledWith(message.inputs, message.requestId);
            });

            it('should process single URL batch', async () => {
                const message = {
                    requestId: 'req-456',
                    inputs: [
                        { scanId: 'req-456', urlId: 'url-1', url: 'https://single.com' },
                    ],
                };

                (mockAppService.processInBatches as jest.Mock).mockResolvedValue(undefined);

                await consumer.processChunk(message);

                expect(mockAppService.processInBatches).toHaveBeenCalledTimes(1);
                expect(mockAppService.processInBatches).toHaveBeenCalledWith(message.inputs, 'req-456');
            });

            it('should process large batch of URLs', async () => {
                const inputs = Array.from({ length: 50 }, (_, i) => ({
                    scanId: 'req-789',
                    urlId: `url-${i}`,
                    url: `https://example${i}.com`,
                }));

                const message = {
                    requestId: 'req-789',
                    inputs,
                };

                (mockAppService.processInBatches as jest.Mock).mockResolvedValue(undefined);

                await consumer.processChunk(message);

                expect(mockAppService.processInBatches).toHaveBeenCalledWith(inputs, 'req-789');
            });

            it('should handle empty inputs array', async () => {
                const message = {
                    requestId: 'req-empty',
                    inputs: [],
                };

                (mockAppService.processInBatches as jest.Mock).mockResolvedValue(undefined);

                await consumer.processChunk(message);

                expect(mockAppService.processInBatches).toHaveBeenCalledWith([], 'req-empty');
            });
        });

        describe('Invalid Messages', () => {
            it('should handle missing requestId', async () => {
                const message = {
                    requestId: null as any,
                    inputs: [{ scanId: 'req', urlId: 'url-1', url: 'https://example.com' }],
                };

                await consumer.processChunk(message);

                expect(mockAppService.processInBatches).not.toHaveBeenCalled();
            });

            it('should handle missing inputs', async () => {
                const message = {
                    requestId: 'req-123',
                    inputs: null as any,
                };

                await consumer.processChunk(message);

                expect(mockAppService.processInBatches).not.toHaveBeenCalled();
            });

            it('should handle undefined requestId', async () => {
                const message = {
                    requestId: undefined as any,
                    inputs: [],
                };

                await consumer.processChunk(message);

                expect(mockAppService.processInBatches).not.toHaveBeenCalled();
            });

            it('should handle undefined inputs', async () => {
                const message = {
                    requestId: 'req-123',
                    inputs: undefined as any,
                };

                await consumer.processChunk(message);

                expect(mockAppService.processInBatches).not.toHaveBeenCalled();
            });

            it('should handle completely invalid message', async () => {
                const message = {} as any;

                await consumer.processChunk(message);

                expect(mockAppService.processInBatches).not.toHaveBeenCalled();
            });

            it('should handle null message fields', async () => {
                const message = {
                    requestId: '',
                    inputs: null as any,
                };

                await consumer.processChunk(message);

                expect(mockAppService.processInBatches).not.toHaveBeenCalled();
            });
        });

        describe('Error Handling', () => {
            it('should return Nack when processing fails', async () => {
                const message = {
                    requestId: 'req-error',
                    inputs: [
                        { scanId: 'req-error', urlId: 'url-1', url: 'https://example.com' },
                    ],
                };

                (mockAppService.processInBatches as jest.Mock).mockRejectedValue(
                    new Error('Processing failed')
                );

                const result = await consumer.processChunk(message);

                expect(result).toBeInstanceOf(Nack);
                expect((result as Nack).requeue).toBe(false);
            });

            it('should return Nack on database errors', async () => {
                const message = {
                    requestId: 'req-db-error',
                    inputs: [
                        { scanId: 'req-db-error', urlId: 'url-1', url: 'https://example.com' },
                    ],
                };

                (mockAppService.processInBatches as jest.Mock).mockRejectedValue(
                    new Error('Database connection lost')
                );

                const result = await consumer.processChunk(message);

                expect(result).toBeInstanceOf(Nack);
            });

            it('should return Nack on timeout errors', async () => {
                const message = {
                    requestId: 'req-timeout',
                    inputs: [
                        { scanId: 'req-timeout', urlId: 'url-1', url: 'https://slow-site.com' },
                    ],
                };

                (mockAppService.processInBatches as jest.Mock).mockRejectedValue(
                    new Error('Operation timed out')
                );

                const result = await consumer.processChunk(message);

                expect(result).toBeInstanceOf(Nack);
            });

            it('should handle unexpected errors gracefully', async () => {
                const message = {
                    requestId: 'req-unexpected',
                    inputs: [
                        { scanId: 'req-unexpected', urlId: 'url-1', url: 'https://example.com' },
                    ],
                };

                // Throw a non-Error object
                (mockAppService.processInBatches as jest.Mock).mockRejectedValue('Unexpected error string');

                const result = await consumer.processChunk(message);

                expect(result).toBeInstanceOf(Nack);
            });

            it('should not return Nack when processing succeeds', async () => {
                const message = {
                    requestId: 'req-success',
                    inputs: [
                        { scanId: 'req-success', urlId: 'url-1', url: 'https://example.com' },
                    ],
                };

                (mockAppService.processInBatches as jest.Mock).mockResolvedValue(undefined);

                const result = await consumer.processChunk(message);

                expect(result).toBeUndefined();
            });
        });

        describe('Message Format Variations', () => {
            it('should handle different input structures', async () => {
                const message = {
                    requestId: 'req-var',
                    inputs: [
                        {
                            scanId: 'req-var',
                            urlId: 'url-1',
                            url: 'https://example.com',
                            // May have additional fields
                            extraField: 'ignored',
                        },
                    ],
                };

                (mockAppService.processInBatches as jest.Mock).mockResolvedValue(undefined);

                await consumer.processChunk(message);

                expect(mockAppService.processInBatches).toHaveBeenCalledWith(message.inputs, 'req-var');
            });

            it('should process messages with special characters in requestId', async () => {
                const message = {
                    requestId: 'req-special-123-abc_xyz',
                    inputs: [
                        { scanId: 'req-special-123-abc_xyz', urlId: 'url-1', url: 'https://example.com' },
                    ],
                };

                (mockAppService.processInBatches as jest.Mock).mockResolvedValue(undefined);

                await consumer.processChunk(message);

                expect(mockAppService.processInBatches).toHaveBeenCalledWith(
                    message.inputs,
                    'req-special-123-abc_xyz'
                );
            });

            it('should handle URLs with query parameters and fragments', async () => {
                const message = {
                    requestId: 'req-complex-url',
                    inputs: [
                        {
                            scanId: 'req-complex-url',
                            urlId: 'url-1',
                            url: 'https://example.com/path?query=value&foo=bar#section',
                        },
                    ],
                };

                (mockAppService.processInBatches as jest.Mock).mockResolvedValue(undefined);

                await consumer.processChunk(message);

                expect(mockAppService.processInBatches).toHaveBeenCalled();
            });
        });

        describe('Concurrency', () => {
            it('should handle multiple concurrent messages', async () => {
                const messages = [
                    {
                        requestId: 'req-1',
                        inputs: [{ scanId: 'req-1', urlId: 'url-1', url: 'https://example1.com' }],
                    },
                    {
                        requestId: 'req-2',
                        inputs: [{ scanId: 'req-2', urlId: 'url-2', url: 'https://example2.com' }],
                    },
                    {
                        requestId: 'req-3',
                        inputs: [{ scanId: 'req-3', urlId: 'url-3', url: 'https://example3.com' }],
                    },
                ];

                (mockAppService.processInBatches as jest.Mock).mockResolvedValue(undefined);

                await Promise.all(messages.map(msg => consumer.processChunk(msg)));

                expect(mockAppService.processInBatches).toHaveBeenCalledTimes(3);
            });
        });
    });
});
