import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiKeyGuard } from './api-key.guard';
import { AuthService } from '../auth.service';
import { UserEntity } from '../entities/user.entity';

describe('ApiKeyGuard', () => {
    let guard: ApiKeyGuard;
    let mockAuthService: Partial<AuthService>;
    let mockConfigService: Partial<ConfigService>;
    let mockExecutionContext: ExecutionContext;
    let mockRequest: any;

    beforeEach(async () => {
        mockAuthService = {
            validateApiKey: jest.fn(),
        };

        mockConfigService = {
            get: jest.fn(),
        };

        mockRequest = {
            headers: {},
            user: null,
        };

        mockExecutionContext = {
            switchToHttp: jest.fn().mockReturnValue({
                getRequest: jest.fn().mockReturnValue(mockRequest),
            }),
        } as any;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ApiKeyGuard,
                {
                    provide: AuthService,
                    useValue: mockAuthService,
                },
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
            ],
        }).compile();

        guard = module.get<ApiKeyGuard>(ApiKeyGuard);
    });

    it('should be defined', () => {
        expect(guard).toBeDefined();
    });

    describe('canActivate', () => {
        describe('Missing API Key', () => {
            it('should throw UnauthorizedException when no API key is provided', async () => {
                await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(UnauthorizedException);
                await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow('API Key missing');
            });

            it('should throw UnauthorizedException when Authorization header is malformed', async () => {
                mockRequest.headers.authorization = 'InvalidFormat';
                await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(UnauthorizedException);
            });
        });

        describe('Admin API Key', () => {
            const adminKey = 'admin-super-secret-key';

            beforeEach(() => {
                (mockConfigService.get as jest.Mock).mockReturnValue(adminKey);
            });

            it('should authenticate admin user via X-API-Key header', async () => {
                mockRequest.headers['x-api-key'] = adminKey;

                const result = await guard.canActivate(mockExecutionContext);

                expect(result).toBe(true);
                expect(mockRequest.user).toBeDefined();
                expect(mockRequest.user.id).toBe('admin');
                expect(mockRequest.user.email).toBe('admin@system');
                expect(mockRequest.user.name).toBe('System Admin');
                expect(mockRequest.user.isActive).toBe(true);
                expect(mockAuthService.validateApiKey).not.toHaveBeenCalled();
            });

            it('should authenticate admin user via Authorization Bearer header', async () => {
                mockRequest.headers.authorization = `Bearer ${adminKey}`;

                const result = await guard.canActivate(mockExecutionContext);

                expect(result).toBe(true);
                expect(mockRequest.user.id).toBe('admin');
                expect(mockAuthService.validateApiKey).not.toHaveBeenCalled();
            });

            it('should not authenticate with wrong admin key', async () => {
                mockRequest.headers['x-api-key'] = 'wrong-admin-key';
                (mockAuthService.validateApiKey as jest.Mock).mockRejectedValue(
                    new UnauthorizedException('Invalid API key')
                );

                await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(UnauthorizedException);
            });

            it('should handle case when admin key is not configured', async () => {
                (mockConfigService.get as jest.Mock).mockReturnValue(null);
                mockRequest.headers['x-api-key'] = 'some-key';

                const mockUser: Partial<UserEntity> = {
                    id: 'user-1',
                    email: 'test@example.com',
                    name: 'Test User',
                    isActive: true,
                };

                (mockAuthService.validateApiKey as jest.Mock).mockResolvedValue(mockUser);

                const result = await guard.canActivate(mockExecutionContext);

                expect(result).toBe(true);
                expect(mockAuthService.validateApiKey).toHaveBeenCalledWith('some-key');
            });
        });

        describe('Standard User API Key', () => {
            it('should authenticate regular user via X-API-Key header', async () => {
                const userKey = 'sk_live_abc123';
                const mockUser: Partial<UserEntity> = {
                    id: 'user-1',
                    email: 'test@example.com',
                    name: 'Test User',
                    isActive: true,
                };

                mockRequest.headers['x-api-key'] = userKey;
                (mockAuthService.validateApiKey as jest.Mock).mockResolvedValue(mockUser);
                (mockConfigService.get as jest.Mock).mockReturnValue('admin-key');

                const result = await guard.canActivate(mockExecutionContext);

                expect(result).toBe(true);
                expect(mockRequest.user).toBe(mockUser);
                expect(mockAuthService.validateApiKey).toHaveBeenCalledWith(userKey);
            });

            it('should authenticate regular user via Authorization Bearer header', async () => {
                const userKey = 'sk_live_xyz789';
                const mockUser: Partial<UserEntity> = {
                    id: 'user-2',
                    email: 'user2@example.com',
                    name: 'User Two',
                    isActive: true,
                };

                mockRequest.headers.authorization = `Bearer ${userKey}`;
                (mockAuthService.validateApiKey as jest.Mock).mockResolvedValue(mockUser);
                (mockConfigService.get as jest.Mock).mockReturnValue('admin-key');

                const result = await guard.canActivate(mockExecutionContext);

                expect(result).toBe(true);
                expect(mockRequest.user).toBe(mockUser);
                expect(mockAuthService.validateApiKey).toHaveBeenCalledWith(userKey);
            });

            it('should throw UnauthorizedException for invalid user key', async () => {
                mockRequest.headers['x-api-key'] = 'invalid-key';
                (mockAuthService.validateApiKey as jest.Mock).mockRejectedValue(
                    new UnauthorizedException('Invalid API key')
                );

                await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(UnauthorizedException);
                expect(mockAuthService.validateApiKey).toHaveBeenCalledWith('invalid-key');
            });
        });

        describe('Header Priority', () => {
            it('should prioritize X-API-Key over Authorization header', async () => {
                const xApiKey = 'x-api-key-value';
                const bearerKey = 'bearer-key-value';
                const mockUser: Partial<UserEntity> = {
                    id: 'user-1',
                    email: 'test@example.com',
                    name: 'Test User',
                    isActive: true,
                };

                mockRequest.headers['x-api-key'] = xApiKey;
                mockRequest.headers.authorization = `Bearer ${bearerKey}`;
                (mockAuthService.validateApiKey as jest.Mock).mockResolvedValue(mockUser);
                (mockConfigService.get as jest.Mock).mockReturnValue('admin-key');

                await guard.canActivate(mockExecutionContext);

                // Should call with X-API-Key value, not Bearer
                expect(mockAuthService.validateApiKey).toHaveBeenCalledWith(xApiKey);
            });

            it('should handle case-sensitive header names correctly', async () => {
                mockRequest.headers['X-API-Key'] = 'should-not-work';
                mockRequest.headers['x-api-key'] = 'correct-key';

                const mockUser: Partial<UserEntity> = {
                    id: 'user-1',
                    email: 'test@example.com',
                    name: 'Test User',
                    isActive: true,
                };

                (mockAuthService.validateApiKey as jest.Mock).mockResolvedValue(mockUser);
                (mockConfigService.get as jest.Mock).mockReturnValue('admin-key');

                await guard.canActivate(mockExecutionContext);

                expect(mockAuthService.validateApiKey).toHaveBeenCalledWith('correct-key');
            });
        });
    });
});
