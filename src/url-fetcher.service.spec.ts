import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { UrlFetcherService } from './url-fetcher.service';
import { StorageService } from './storage.service';
import { FetchStatus } from './enums/fetch-status.enum';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('UrlFetcherService', () => {
    let service: UrlFetcherService;
    let mockStorageService: Partial<StorageService>;
    let mockConfigService: Partial<ConfigService>;

    beforeEach(async () => {
        mockStorageService = {
            upload: jest.fn(),
        };

        mockConfigService = {
            get: jest.fn((key: string, defaultValue?: any) => {
                const config: Record<string, any> = {
                    FETCH_TIMEOUT: 5000,
                    FETCH_MAX_REDIRECTS: 5,
                    FETCH_MAX_SIZE_MB: 5,
                };
                return config[key] ?? defaultValue;
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UrlFetcherService,
                {
                    provide: StorageService,
                    useValue: mockStorageService,
                },
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
            ],
        }).compile();

        service = module.get<UrlFetcherService>(UrlFetcherService);

        // Reset mocks
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('fetchAndStore', () => {
        const requestId = 'test-request-id';
        const url = 'https://example.com';

        describe('Successful Fetch', () => {
            it('should fetch URL and store content in S3', async () => {
                const htmlContent = '<!DOCTYPE html><html><head><title>Test Page</title></head><body>Content</body></html>';

                mockedAxios.get.mockResolvedValue({
                    status: 200,
                    data: htmlContent,
                });

                (mockStorageService.upload as jest.Mock).mockResolvedValue(undefined);

                const result = await service.fetchAndStore(url, requestId);

                expect(result.status).toBe(FetchStatus.SUCCESS);
                expect(result.statusCode).toBe(200);
                expect(result.title).toBe('Test Page');
                expect(result.s3Key).toMatch(/test-request-id\/[a-f0-9]+\.html/);
                expect(result.fetchedAt).toBeInstanceOf(Date);
                expect(result.url).toBe(url);

                expect(mockedAxios.get).toHaveBeenCalledWith(url, {
                    timeout: 5000,
                    maxRedirects: 5,
                    maxContentLength: 5 * 1024 * 1024,
                    maxBodyLength: 5 * 1024 * 1024,
                    responseType: 'text',
                });

                expect(mockStorageService.upload).toHaveBeenCalledWith(
                    expect.stringMatching(/test-request-id\/[a-f0-9]+\.html/),
                    htmlContent
                );
            });

            it('should extract title correctly', async () => {
                const htmlContent = '<html><head><title>My Amazing Page</title></head></html>';

                mockedAxios.get.mockResolvedValue({
                    status: 200,
                    data: htmlContent,
                });

                const result = await service.fetchAndStore(url, requestId);

                expect(result.title).toBe('My Amazing Page');
            });

            it('should handle pages without title', async () => {
                const htmlContent = '<html><body>No title here</body></html>';

                mockedAxios.get.mockResolvedValue({
                    status: 200,
                    data: htmlContent,
                });

                const result = await service.fetchAndStore(url, requestId);

                expect(result.title).toBe('No Title');
            });

            it('should handle empty title tags', async () => {
                const htmlContent = '<html><head><title></title></head></html>';

                mockedAxios.get.mockResolvedValue({
                    status: 200,
                    data: htmlContent,
                });

                const result = await service.fetchAndStore(url, requestId);

                expect(result.title).toBe('No Title');
            });

            it('should handle titles with special characters', async () => {
                const htmlContent = '<html><title>Test &amp; &quot;Special&quot; &lt;Characters&gt;</title></html>';

                mockedAxios.get.mockResolvedValue({
                    status: 200,
                    data: htmlContent,
                });

                const result = await service.fetchAndStore(url, requestId);

                expect(result.title).toBe('Test &amp; &quot;Special&quot; &lt;Characters&gt;');
            });

            it('should handle case-insensitive title tags', async () => {
                const htmlContent = '<HTML><TITLE>UPPERCASE TITLE</TITLE></HTML>';

                mockedAxios.get.mockResolvedValue({
                    status: 200,
                    data: htmlContent,
                });

                const result = await service.fetchAndStore(url, requestId);

                expect(result.title).toBe('UPPERCASE TITLE');
            });

            it('should generate consistent S3 key for same URL', async () => {
                mockedAxios.get.mockResolvedValue({
                    status: 200,
                    data: '<html><title>Test</title></html>',
                });

                const result1 = await service.fetchAndStore(url, requestId);
                const result2 = await service.fetchAndStore(url, requestId);

                // Same URL should generate same hash
                expect(result1.s3Key).toBe(result2.s3Key);
            });

            it('should generate different S3 keys for different URLs', async () => {
                mockedAxios.get.mockResolvedValue({
                    status: 200,
                    data: '<html><title>Test</title></html>',
                });

                const result1 = await service.fetchAndStore('https://example.com', requestId);
                const result2 = await service.fetchAndStore('https://different.com', requestId);

                expect(result1.s3Key).not.toBe(result2.s3Key);
            });
        });

        describe('HTTP Error Handling', () => {
            it('should handle 404 errors', async () => {
                mockedAxios.get.mockRejectedValue({
                    message: 'Request failed with status code 404',
                    response: { status: 404 },
                });

                const result = await service.fetchAndStore(url, requestId);

                expect(result.status).toBe(FetchStatus.ERROR);
                expect(result.statusCode).toBe(404);
                expect(result.error).toBe('Request failed with status code 404');
                expect(result.fetchedAt).toBeInstanceOf(Date);
            });

            it('should handle 500 errors', async () => {
                mockedAxios.get.mockRejectedValue({
                    message: 'Internal Server Error',
                    response: { status: 500 },
                });

                const result = await service.fetchAndStore(url, requestId);

                expect(result.status).toBe(FetchStatus.ERROR);
                expect(result.statusCode).toBe(500);
            });

            it('should handle timeout errors', async () => {
                mockedAxios.get.mockRejectedValue({
                    message: 'timeout of 5000ms exceeded',
                    code: 'ECONNABORTED',
                });

                const result = await service.fetchAndStore(url, requestId);

                expect(result.status).toBe(FetchStatus.ERROR);
                expect(result.error).toBe('timeout of 5000ms exceeded');
                expect(result.statusCode).toBeUndefined();
            });

            it('should handle network errors', async () => {
                mockedAxios.get.mockRejectedValue({
                    message: 'Network Error',
                    code: 'ENETUNREACH',
                });

                const result = await service.fetchAndStore(url, requestId);

                expect(result.status).toBe(FetchStatus.ERROR);
                expect(result.error).toBe('Network Error');
            });

            it('should handle DNS errors', async () => {
                mockedAxios.get.mockRejectedValue({
                    message: 'getaddrinfo ENOTFOUND invalid-domain.com',
                    code: 'ENOTFOUND',
                });

                const result = await service.fetchAndStore(url, requestId);

                expect(result.status).toBe(FetchStatus.ERROR);
                expect(result.error).toContain('ENOTFOUND');
            });

            it('should handle unknown errors gracefully', async () => {
                mockedAxios.get.mockRejectedValue({
                    // No message property
                });

                const result = await service.fetchAndStore(url, requestId);

                expect(result.status).toBe(FetchStatus.ERROR);
                expect(result.error).toBe('Unknown error');
            });
        });

        describe('Configuration', () => {
            it('should use custom timeout from config', async () => {
                (mockConfigService.get as jest.Mock).mockImplementation((key: string) => {
                    if (key === 'FETCH_TIMEOUT') return 10000;
                    if (key === 'FETCH_MAX_REDIRECTS') return 5;
                    if (key === 'FETCH_MAX_SIZE_MB') return 5;
                    return undefined;
                });

                // Create new service instance to pick up new config
                const customService = new UrlFetcherService(
                    mockStorageService as StorageService,
                    mockConfigService as ConfigService
                );

                mockedAxios.get.mockResolvedValue({
                    status: 200,
                    data: '<html><title>Test</title></html>',
                });

                await customService.fetchAndStore(url, requestId);

                expect(mockedAxios.get).toHaveBeenCalledWith(url, expect.objectContaining({
                    timeout: 10000,
                }));
            });

            it('should use custom max redirects from config', async () => {
                (mockConfigService.get as jest.Mock).mockImplementation((key: string) => {
                    if (key === 'FETCH_TIMEOUT') return 5000;
                    if (key === 'FETCH_MAX_REDIRECTS') return 10;
                    if (key === 'FETCH_MAX_SIZE_MB') return 5;
                    return undefined;
                });

                const customService = new UrlFetcherService(
                    mockStorageService as StorageService,
                    mockConfigService as ConfigService
                );

                mockedAxios.get.mockResolvedValue({
                    status: 200,
                    data: '<html></html>',
                });

                await customService.fetchAndStore(url, requestId);

                expect(mockedAxios.get).toHaveBeenCalledWith(url, expect.objectContaining({
                    maxRedirects: 10,
                }));
            });

            it('should use custom max size from config', async () => {
                (mockConfigService.get as jest.Mock).mockImplementation((key: string) => {
                    if (key === 'FETCH_TIMEOUT') return 5000;
                    if (key === 'FETCH_MAX_REDIRECTS') return 5;
                    if (key === 'FETCH_MAX_SIZE_MB') return 10;
                    return undefined;
                });

                const customService = new UrlFetcherService(
                    mockStorageService as StorageService,
                    mockConfigService as ConfigService
                );

                mockedAxios.get.mockResolvedValue({
                    status: 200,
                    data: '<html></html>',
                });

                await customService.fetchAndStore(url, requestId);

                expect(mockedAxios.get).toHaveBeenCalledWith(url, expect.objectContaining({
                    maxContentLength: 10 * 1024 * 1024,
                    maxBodyLength: 10 * 1024 * 1024,
                }));
            });
        });

        describe('S3 Storage', () => {
            it('should return error when S3 upload fails', async () => {
                mockedAxios.get.mockResolvedValue({
                    status: 200,
                    data: '<html><title>Test</title></html>',
                });

                (mockStorageService.upload as jest.Mock).mockRejectedValue(new Error('S3 Upload Failed'));

                // The service catches the S3 error and returns an error status
                const result = await service.fetchAndStore(url, requestId);

                expect(result.status).toBe(FetchStatus.ERROR);
                expect(result.error).toContain('S3 Upload Failed');
            });

            it('should not upload to S3 if fetch fails', async () => {
                mockedAxios.get.mockRejectedValue({
                    message: 'Fetch failed',
                    response: { status: 500 },
                });

                await service.fetchAndStore(url, requestId);

                expect(mockStorageService.upload).not.toHaveBeenCalled();
            });
        });
    });
});
