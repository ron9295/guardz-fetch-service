import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';
import axios from 'axios';
import { S3Client } from '@aws-sdk/client-s3';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RequestEntity } from './entities/request.entity';
import { ResultEntity } from './entities/result.entity';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';

jest.mock('axios');
jest.mock('uuid', () => ({
    v4: () => 'test-request-id',
}));

describe('AppService', () => {
    let service: AppService;
    let mockAmqpConnection: any;
    let mockRequestRepo: any;
    let mockResultRepo: any;
    let mockS3Send: jest.Mock;

    beforeEach(async () => {
        mockAmqpConnection = {
            publish: jest.fn(),
        };
        mockRequestRepo = {
            create: jest.fn().mockReturnValue({ id: 'test-request-id' }),
            save: jest.fn().mockResolvedValue({ id: 'test-request-id' }),
            increment: jest.fn(),
        };
        mockResultRepo = {
            create: jest.fn(),
            save: jest.fn(),
            insert: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
                insert: jest.fn().mockReturnThis(),
                into: jest.fn().mockReturnThis(),
                values: jest.fn().mockReturnThis(),
                returning: jest.fn().mockReturnThis(),
                execute: jest.fn().mockResolvedValue({ generatedMaps: [{ id: 1, url: 'http://example.com' }] }),
            })),
            findOne: jest.fn(),
        };
        mockS3Send = jest.fn();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AppService,
                {
                    provide: 'REDIS_CLIENT',
                    useValue: {}, // Mock if still injected
                },
                {
                    provide: AmqpConnection,
                    useValue: mockAmqpConnection,
                },
                {
                    provide: 'S3_CLIENT',
                    useValue: { send: mockS3Send },
                },
                {
                    provide: getRepositoryToken(RequestEntity),
                    useValue: mockRequestRepo,
                },
                {
                    provide: getRepositoryToken(ResultEntity),
                    useValue: mockResultRepo,
                },
            ],
        }).compile();

        service = module.get<AppService>(AppService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('fetchUrls', () => {
        it('should create request, bulk insert results, and publish to RabbitMQ', async () => {
            const urls = ['http://example.com'];
            const requestId = await service.fetchUrls(urls);

            expect(requestId).toBe('test-request-id');

            // Verify Request Creation
            expect(mockRequestRepo.save).toHaveBeenCalled();

            // Verify Bulk Insert using QueryBuilder
            expect(mockResultRepo.createQueryBuilder).toHaveBeenCalled();

            // Verify RabbitMQ Publish
            expect(mockAmqpConnection.publish).toHaveBeenCalledWith(
                'scraper_exchange',
                'fetch.chunk',
                expect.objectContaining({
                    requestId: 'test-request-id',
                    inputs: expect.arrayContaining([
                        expect.objectContaining({ urlId: 1, url: 'http://example.com' })
                    ])
                })
            );
        });
    });

    describe('processInBatches', () => {
        it('should update entities directly using ID without finding them first', async () => {
            const inputs = [{ scanId: 'req-1', urlId: 'url-1', url: 'http://example.com' }];
            const requestId = 'req-1';

            // Mock fetchAndUploadUrl implementation since it's private (accessed via casting or spy)
            // Or better, just mock the private method if possible, but testing implementation details is tricky.
            // Alternative: Mock axios.get and s3.send to let fetchAndUploadUrl run.
            const mockResponse = { status: 200, data: '<html>Title</html>' };
            (axios.get as jest.Mock).mockResolvedValue(mockResponse);

            await service.processInBatches(inputs, requestId);

            // Verify it did NOT call findOne
            expect(mockResultRepo.findOne).not.toHaveBeenCalled();

            // Verify it called save with the correct update object
            expect(mockResultRepo.save).toHaveBeenCalledWith(expect.arrayContaining([
                expect.objectContaining({
                    id: 'url-1',
                    requestId: 'req-1',
                    url: 'http://example.com',
                    status: 'success'
                })
            ]));
        });
    });
});
