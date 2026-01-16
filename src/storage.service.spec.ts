import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { StorageService } from './storage.service';
import { Readable } from 'stream';

describe('StorageService', () => {
    let service: StorageService;
    let mockS3Client: Partial<S3Client>;
    let mockConfigService: Partial<ConfigService>;

    beforeEach(async () => {
        mockS3Client = {
            send: jest.fn(),
        };

        // ConfigService is called during constructor, so set it up before module creation
        mockConfigService = {
            get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
                if (key === 'S3_BUCKET_NAME') {
                    // Return 'test-bucket' during tests by default unless overridden
                    return 'test-bucket';
                }
                return defaultValue;
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                StorageService,
                {
                    provide: 'S3_CLIENT',
                    useValue: mockS3Client,
                },
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
            ],
        }).compile();

        service = module.get<StorageService>(StorageService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('ensureBucketExists', () => {
        it('should check if bucket exists without creating it', async () => {
            (mockS3Client.send as jest.Mock).mockResolvedValue({});

            await service.ensureBucketExists();

            expect(mockS3Client.send).toHaveBeenCalledTimes(1);
            expect(mockS3Client.send).toHaveBeenCalledWith(expect.any(HeadBucketCommand));

            const headBucketCall = (mockS3Client.send as jest.Mock).mock.calls[0][0];
            expect(headBucketCall.input.Bucket).toBe('test-bucket');
        });

        it('should create bucket if it does not exist', async () => {
            (mockS3Client.send as jest.Mock)
                .mockRejectedValueOnce(new Error('NoSuchBucket'))
                .mockResolvedValueOnce({}); // CreateBucket success

            await service.ensureBucketExists();

            expect(mockS3Client.send).toHaveBeenCalledTimes(2);
            expect(mockS3Client.send).toHaveBeenNthCalledWith(1, expect.any(HeadBucketCommand));
            expect(mockS3Client.send).toHaveBeenNthCalledWith(2, expect.any(CreateBucketCommand));

            const createBucketCall = (mockS3Client.send as jest.Mock).mock.calls[1][0];
            expect(createBucketCall.input.Bucket).toBe('test-bucket');
        });

        it('should handle errors during bucket creation gracefully', async () => {
            (mockS3Client.send as jest.Mock)
                .mockRejectedValueOnce(new Error('NoSuchBucket'))
                .mockRejectedValueOnce(new Error('BucketAlreadyOwnedByYou'));

            // Should not throw
            await expect(service.ensureBucketExists()).resolves.toBeUndefined();
        });

        it('should use bucket name from config', async () => {
            (mockConfigService.get as jest.Mock).mockReturnValue('custom-bucket-name');

            // Create a new instance to pick up the config value
            const customService = new StorageService(mockS3Client as S3Client, mockConfigService as ConfigService);

            (mockS3Client.send as jest.Mock).mockResolvedValue({});

            await customService.ensureBucketExists();

            const headBucketCall = (mockS3Client.send as jest.Mock).mock.calls[0][0];
            expect(headBucketCall.input.Bucket).toBe('custom-bucket-name');
        });

        it('should use default bucket name when config returns undefined', async () => {
            // Mock to return the default value (second parameter)
            (mockConfigService.get as jest.Mock).mockImplementation((key: string, defaultValue?: any) => defaultValue);

            const defaultService = new StorageService(mockS3Client as S3Client, mockConfigService as ConfigService);

            (mockS3Client.send as jest.Mock).mockResolvedValue({});

            await defaultService.ensureBucketExists();

            const headBucketCall = (mockS3Client.send as jest.Mock).mock.calls[0][0];
            expect(headBucketCall.input.Bucket).toBe('scraped-content');
        });
    });

    describe('upload', () => {
        it('should upload content to S3 with correct parameters', async () => {
            const key = 'test/file.html';
            const body = '<html><body>Test</body></html>';

            (mockS3Client.send as jest.Mock).mockResolvedValue({});

            await service.upload(key, body);

            expect(mockS3Client.send).toHaveBeenCalledWith(expect.any(PutObjectCommand));

            const putObjectCall = (mockS3Client.send as jest.Mock).mock.calls[0][0];
            expect(putObjectCall.input).toEqual({
                Bucket: 'test-bucket',
                Key: key,
                Body: body,
                ContentType: 'text/html',
            });
        });

        it('should support custom content type', async () => {
            const key = 'test/data.json';
            const body = '{"test": true}';
            const contentType = 'application/json';

            (mockS3Client.send as jest.Mock).mockResolvedValue({});

            await service.upload(key, body, contentType);

            const putObjectCall = (mockS3Client.send as jest.Mock).mock.calls[0][0];
            expect(putObjectCall.input.ContentType).toBe('application/json');
        });

        it('should default to text/html content type', async () => {
            (mockS3Client.send as jest.Mock).mockResolvedValue({});

            await service.upload('test.html', '<html></html>');

            const putObjectCall = (mockS3Client.send as jest.Mock).mock.calls[0][0];
            expect(putObjectCall.input.ContentType).toBe('text/html');
        });

        it('should propagate errors from S3 client', async () => {
            (mockS3Client.send as jest.Mock).mockRejectedValue(new Error('S3 Upload Error'));

            await expect(service.upload('key', 'body')).rejects.toThrow('S3 Upload Error');
        });
    });

    describe('getStream', () => {
        it('should retrieve object stream from S3', async () => {
            const key = 'test/file.html';
            const mockStream = new Readable({ read() { } });
            mockStream.push('test content');
            mockStream.push(null);

            (mockS3Client.send as jest.Mock).mockResolvedValue({ Body: mockStream });

            const result = await service.getStream(key);

            expect(mockS3Client.send).toHaveBeenCalledWith(expect.any(GetObjectCommand));
            expect(result).toBe(mockStream);

            const getObjectCall = (mockS3Client.send as jest.Mock).mock.calls[0][0];
            expect(getObjectCall.input).toEqual({
                Bucket: 'test-bucket',
                Key: key,
            });
        });

        it('should handle S3 errors', async () => {
            (mockS3Client.send as jest.Mock).mockRejectedValue(new Error('NoSuchKey'));

            await expect(service.getStream('nonexistent-key')).rejects.toThrow('NoSuchKey');
        });
    });

    describe('streamToString', () => {
        it('should convert stream to string', async () => {
            const mockStream = new Readable({
                read() { }
            });
            const testData = 'Hello, World!';

            // Push data immediately in Jest environment
            mockStream.push(testData);
            mockStream.push(null);

            const result = await service.streamToString(mockStream);

            expect(result).toBe(testData);
        });

        it('should handle multi-chunk streams', async () => {
            const mockStream = new Readable({
                read() { }
            });
            const chunk1 = 'First chunk ';
            const chunk2 = 'Second chunk';

            mockStream.push(chunk1);
            mockStream.push(chunk2);
            mockStream.push(null);

            const result = await service.streamToString(mockStream);

            expect(result).toBe('First chunk Second chunk');
        });

        it('should handle empty stream', async () => {
            const mockStream = new Readable({
                read() { }
            });

            mockStream.push(null);

            const result = await service.streamToString(mockStream);

            expect(result).toBe('');
        });

        it('should handle stream errors', async () => {
            const mockStream = new Readable({
                read() {
                    this.destroy(new Error('Stream error'));
                }
            });

            await expect(service.streamToString(mockStream)).rejects.toThrow('Stream error');
        });

        it('should handle UTF-8 encoding correctly', async () => {
            const mockStream = new Readable({
                read() { }
            });
            const unicodeText = 'Hello 世界 🌍';

            mockStream.push(Buffer.from(unicodeText, 'utf8'));
            mockStream.push(null);

            const result = await service.streamToString(mockStream);

            expect(result).toBe(unicodeText);
        });

        it('should concatenate multiple buffer chunks correctly', async () => {
            const mockStream = new Readable({
                read() { }
            });
            const text = 'A very long text that might be split into multiple chunks';

            // Simulate multiple chunks
            for (let i = 0; i < text.length; i += 10) {
                mockStream.push(text.slice(i, i + 10));
            }
            mockStream.push(null);

            const result = await service.streamToString(mockStream);

            expect(result).toBe(text);
        });
    });
});
