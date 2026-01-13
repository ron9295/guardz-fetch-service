import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

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
            const query = { cursor: 10, limit: 50 };
            await controller.getResults('req-1', query);
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

