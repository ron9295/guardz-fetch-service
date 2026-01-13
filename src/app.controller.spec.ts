import { Test, TestingModule } from '@nestjs/testing';
import { AppController, IntRangePipe } from './app.controller';
import { AppService } from './app.service';
import { BadRequestException, ArgumentMetadata } from '@nestjs/common';

jest.mock('uuid', () => ({
    v4: () => 'test-request-id',
}));

describe('AppController', () => {
    let controller: AppController;
    let mockAppService: any;

    beforeEach(async () => {
        mockAppService = {
            fetchUrls: jest.fn(),
            getResults: jest.fn(),
            getRequestStatus: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [AppController],
            providers: [
                {
                    provide: AppService,
                    useValue: mockAppService,
                },
            ],
        }).compile();

        controller = module.get<AppController>(AppController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('fetchUrls', () => {
        it('should call appService.fetchUrls', async () => {
            const dto = { urls: ['http://example.com'] };
            mockAppService.fetchUrls.mockResolvedValue('req-1');

            const result = await controller.fetchUrls(dto);

            expect(mockAppService.fetchUrls).toHaveBeenCalledWith(dto.urls);
            expect(result).toEqual({ message: 'Fetching started', requestId: 'req-1', resultCount: 1 });
        });
    });

    describe('getResults', () => {
        it('should call appService.getResults with correct params', async () => {
            mockAppService.getResults.mockResolvedValue({});
            await controller.getResults('req-1', 10, 50);
            expect(mockAppService.getResults).toHaveBeenCalledWith('req-1', 10, 50);
        });
    });

    describe('getRequestStatus', () => {
        it('should call appService.getRequestStatus', async () => {
            mockAppService.getRequestStatus.mockResolvedValue({});
            await controller.getRequestStatus('req-1');
            expect(mockAppService.getRequestStatus).toHaveBeenCalledWith('req-1');
        });
    });
});

describe('IntRangePipe', () => {
    let pipe: IntRangePipe;
    const metadata: ArgumentMetadata = { type: 'query', data: 'limit' };

    beforeEach(() => {
        pipe = new IntRangePipe(10, 100);
    });

    it('should return value if it is within range', () => {
        expect(pipe.transform('50', metadata)).toBe(50);
    });

    it('should clamp value to max if it exceeds max (default)', () => {
        expect(pipe.transform('150', metadata)).toBe(100);
    });

    it('should clamp value to min if it is below min (default)', () => {
        expect(pipe.transform('5', metadata)).toBe(10);
    });

    it('should throw BadRequestException if value is not a number', () => {
        expect(() => pipe.transform('invalid', metadata)).toThrow(BadRequestException);
    });

    it('should handle numeric input directly', () => {
        expect(pipe.transform(50, metadata)).toBe(50);
    });

    it('should throw exception if strictMin is true and value is below min', () => {
        const strictPipe = new IntRangePipe(10, 100, { strictMin: true });
        expect(() => strictPipe.transform('5', metadata)).toThrow(BadRequestException);
    });

    it('should throw exception if strictMax is true and value is above max', () => {
        const strictPipe = new IntRangePipe(10, 100, { strictMax: true });
        expect(() => strictPipe.transform('150', metadata)).toThrow(BadRequestException);
    });
});
