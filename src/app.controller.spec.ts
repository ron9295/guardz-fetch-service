import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ApiKeyGuard } from './auth/guards/api-key.guard';

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
        })
            .overrideGuard(ApiKeyGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get<AppController>(AppController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('fetchUrls', () => {
        it('should call appService.fetchUrls', async () => {
            const dto = { urls: ['http://example.com'] };
            const mockUser = { id: 'user-1', email: 'test@test.com', name: 'Test', isActive: true };
            mockAppService.fetchUrls.mockResolvedValue('req-1');

            const result = await controller.fetchUrls(mockUser as any, dto);

            expect(mockAppService.fetchUrls).toHaveBeenCalledWith(dto.urls, 'user-1');
            expect(result).toEqual({ message: 'Fetching started', requestId: 'req-1', resultCount: 1 });
        });
    });

    describe('getResults', () => {
        it('should call appService.getResults with correct params', async () => {
            const mockUser = { id: 'user-1', email: 'test@test.com', name: 'Test', isActive: true };
            mockAppService.getResults.mockResolvedValue({});
            const query = { cursor: 10, limit: 50 };
            await controller.getResults(mockUser as any, 'req-1', query);
            expect(mockAppService.getResults).toHaveBeenCalledWith('req-1', 'user-1', 10, 50);
        });
    });

    describe('getRequestStatus', () => {
        it('should call appService.getRequestStatus', async () => {
            const mockUser = { id: 'user-1', email: 'test@test.com', name: 'Test', isActive: true };
            mockAppService.getRequestStatus.mockResolvedValue({});
            await controller.getRequestStatus(mockUser as any, 'req-1');
            expect(mockAppService.getRequestStatus).toHaveBeenCalledWith('req-1', 'user-1');
        });
    });
});

