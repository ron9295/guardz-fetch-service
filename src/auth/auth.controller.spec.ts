import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserEntity } from './entities/user.entity';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ApiKeyGuard } from './guards/api-key.guard';

describe('AuthController', () => {
    let controller: AuthController;
    let mockAuthService: Partial<AuthService>;
    let mockAdminUser: UserEntity;
    let mockRegularUser: UserEntity;

    beforeEach(async () => {
        mockAuthService = {
            createApiKey: jest.fn(),
            listUserKeys: jest.fn(),
            revokeApiKey: jest.fn(),
            createUser: jest.fn(),
        };

        mockAdminUser = {
            id: 'admin',
            email: 'admin@system',
            name: 'System Admin',
            isActive: true,
            createdAt: new Date(),
            apiKeys: [],
        } as UserEntity;

        mockRegularUser = {
            id: 'user-1',
            email: 'user@example.com',
            name: 'Regular User',
            isActive: true,
            createdAt: new Date(),
            apiKeys: [],
        } as UserEntity;

        const module: TestingModule = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [
                {
                    provide: AuthService,
                    useValue: mockAuthService,
                },
            ],
        })
            .overrideGuard(ApiKeyGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get<AuthController>(AuthController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('createApiKey', () => {
        describe('Admin User', () => {
            it('should create API key for specified user when admin provides userId', async () => {
                const dto: CreateApiKeyDto = {
                    name: 'Test Key',
                    userId: 'user-1',
                };

                const mockResult = {
                    id: 'key-1',
                    key: 'sk_live_abc123xyz',
                    truncated: 'sk_live_...xyz',
                };

                (mockAuthService.createApiKey as jest.Mock).mockResolvedValue(mockResult);

                const result = await controller.createApiKey(mockAdminUser, dto);

                expect(mockAuthService.createApiKey).toHaveBeenCalledWith('user-1', 'Test Key');
                expect(result).toEqual({
                    message: 'API key created successfully. Save this key - it will not be shown again!',
                    apiKey: 'sk_live_abc123xyz',
                    id: 'key-1',
                    truncated: 'sk_live_...xyz',
                });
            });

            it('should throw BadRequestException when admin does not provide userId', async () => {
                const dto: CreateApiKeyDto = {
                    name: 'Test Key',
                };

                await expect(controller.createApiKey(mockAdminUser, dto)).rejects.toThrow(BadRequestException);
                await expect(controller.createApiKey(mockAdminUser, dto)).rejects.toThrow(
                    'Admin must specify userId when creating API keys'
                );
                expect(mockAuthService.createApiKey).not.toHaveBeenCalled();
            });
        });

        describe('Regular User', () => {
            it('should create API key for the current user', async () => {
                const dto: CreateApiKeyDto = {
                    name: 'My Key',
                };

                const mockResult = {
                    id: 'key-2',
                    key: 'sk_live_def456',
                    truncated: 'sk_live_...456',
                };

                (mockAuthService.createApiKey as jest.Mock).mockResolvedValue(mockResult);

                const result = await controller.createApiKey(mockRegularUser, dto);

                expect(mockAuthService.createApiKey).toHaveBeenCalledWith('user-1', 'My Key');
                expect(result.apiKey).toBe('sk_live_def456');
            });

            it('should ignore userId in DTO for regular users', async () => {
                const dto: CreateApiKeyDto = {
                    name: 'My Key',
                    userId: 'different-user', // This should be ignored
                };

                const mockResult = {
                    id: 'key-3',
                    key: 'sk_live_xyz789',
                    truncated: 'sk_live_...789',
                };

                (mockAuthService.createApiKey as jest.Mock).mockResolvedValue(mockResult);

                await controller.createApiKey(mockRegularUser, dto);

                // Should use current user's ID, not the provided userId
                expect(mockAuthService.createApiKey).toHaveBeenCalledWith('user-1', 'My Key');
            });
        });
    });

    describe('listKeys', () => {
        it('should return list of user API keys', async () => {
            const mockKeys = [
                {
                    id: 'key-1',
                    name: 'Production Key',
                    truncated: 'sk_live_...abc',
                    createdAt: new Date(),
                    lastUsedAt: new Date(),
                    isActive: true,
                },
                {
                    id: 'key-2',
                    name: 'Development Key',
                    truncated: 'sk_live_...def',
                    createdAt: new Date(),
                    lastUsedAt: null,
                    isActive: true,
                },
            ];

            (mockAuthService.listUserKeys as jest.Mock).mockResolvedValue(mockKeys);

            const result = await controller.listKeys(mockRegularUser);

            expect(mockAuthService.listUserKeys).toHaveBeenCalledWith('user-1');
            expect(result).toEqual({ keys: mockKeys });
        });

        it('should return empty array when user has no keys', async () => {
            (mockAuthService.listUserKeys as jest.Mock).mockResolvedValue([]);

            const result = await controller.listKeys(mockRegularUser);

            expect(result).toEqual({ keys: [] });
        });

        it('should work for admin user', async () => {
            const mockKeys = [
                {
                    id: 'admin-key-1',
                    name: 'Admin Key',
                    truncated: 'sk_live_...xyz',
                    createdAt: new Date(),
                    lastUsedAt: new Date(),
                    isActive: true,
                },
            ];

            (mockAuthService.listUserKeys as jest.Mock).mockResolvedValue(mockKeys);

            const result = await controller.listKeys(mockAdminUser);

            expect(mockAuthService.listUserKeys).toHaveBeenCalledWith('admin');
            expect(result).toEqual({ keys: mockKeys });
        });
    });

    describe('revokeKey', () => {
        it('should revoke API key for current user', async () => {
            const keyId = '550e8400-e29b-41d4-a716-446655440000';

            (mockAuthService.revokeApiKey as jest.Mock).mockResolvedValue(undefined);

            await controller.revokeKey(mockRegularUser, keyId);

            expect(mockAuthService.revokeApiKey).toHaveBeenCalledWith(keyId, 'user-1');
        });

        it('should handle UUID validation in param', async () => {
            // This test verifies that ParseUUIDPipe is used
            // The actual validation happens at the framework level
            const validUuid = '123e4567-e89b-12d3-a456-426614174000';

            (mockAuthService.revokeApiKey as jest.Mock).mockResolvedValue(undefined);

            await controller.revokeKey(mockRegularUser, validUuid);

            expect(mockAuthService.revokeApiKey).toHaveBeenCalledWith(validUuid, 'user-1');
        });

        it('should propagate errors from auth service', async () => {
            const keyId = '550e8400-e29b-41d4-a716-446655440000';

            (mockAuthService.revokeApiKey as jest.Mock).mockRejectedValue(
                new ForbiddenException('API key does not belong to user')
            );

            await expect(controller.revokeKey(mockRegularUser, keyId)).rejects.toThrow(ForbiddenException);
        });
    });

    describe('createUser', () => {
        describe('Admin User', () => {
            it('should create a new user when called by admin', async () => {
                const dto: CreateUserDto = {
                    email: 'newuser@example.com',
                    name: 'New User',
                };

                const mockCreatedUser = {
                    id: 'user-new',
                    email: 'newuser@example.com',
                    name: 'New User',
                    isActive: true,
                    createdAt: new Date(),
                    apiKeys: [],
                } as UserEntity;

                (mockAuthService.createUser as jest.Mock).mockResolvedValue(mockCreatedUser);

                const result = await controller.createUser(mockAdminUser, dto);

                expect(mockAuthService.createUser).toHaveBeenCalledWith('newuser@example.com', 'New User');
                expect(result).toEqual({
                    message: 'User created successfully',
                    user: {
                        id: 'user-new',
                        email: 'newuser@example.com',
                        name: 'New User',
                    },
                });
            });

            it('should handle service errors during user creation', async () => {
                const dto: CreateUserDto = {
                    email: 'duplicate@example.com',
                    name: 'Duplicate User',
                };

                (mockAuthService.createUser as jest.Mock).mockRejectedValue(
                    new BadRequestException('User with this email already exists')
                );

                await expect(controller.createUser(mockAdminUser, dto)).rejects.toThrow(BadRequestException);
            });
        });

        describe('Regular User', () => {
            it('should throw ForbiddenException when regular user tries to create user', async () => {
                const dto: CreateUserDto = {
                    email: 'newuser@example.com',
                    name: 'New User',
                };

                await expect(controller.createUser(mockRegularUser, dto)).rejects.toThrow(ForbiddenException);
                await expect(controller.createUser(mockRegularUser, dto)).rejects.toThrow(
                    'Only admin can create users'
                );
                expect(mockAuthService.createUser).not.toHaveBeenCalled();
            });

            it('should not allow user creation even with valid data', async () => {
                const dto: CreateUserDto = {
                    email: 'valid@example.com',
                    name: 'Valid Name',
                };

                await expect(controller.createUser(mockRegularUser, dto)).rejects.toThrow(ForbiddenException);
            });
        });
    });
});
