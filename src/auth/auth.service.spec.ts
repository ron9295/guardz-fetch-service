import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ApiKeyEntity } from './entities/api-key.entity';
import { UserEntity } from './entities/user.entity';
import { Repository } from 'typeorm';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import * as crypto from 'crypto';

describe('AuthService', () => {
    let service: AuthService;
    let apiKeyRepo: Repository<ApiKeyEntity>;
    let userRepo: Repository<UserEntity>;

    const mockApiKeyRepo = {
        create: jest.fn(),
        save: jest.fn(),
        findOne: jest.fn(),
        update: jest.fn(),
        find: jest.fn(),
    };

    const mockUserRepo = {
        create: jest.fn(),
        save: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: getRepositoryToken(ApiKeyEntity),
                    useValue: mockApiKeyRepo,
                },
                {
                    provide: getRepositoryToken(UserEntity),
                    useValue: mockUserRepo,
                },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
        apiKeyRepo = module.get<Repository<ApiKeyEntity>>(getRepositoryToken(ApiKeyEntity));
        userRepo = module.get<Repository<UserEntity>>(getRepositoryToken(UserEntity));

        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('createApiKey', () => {
        it('should generate and save a new API key', async () => {
            const userId = 'user-123';
            const name = 'Test Key';
            const apiKeyId = 'key-uuid';
            const fullKeyStub = 'sk_live_12345';

            // Mock randomBytes/createHash indirectly if possible, but testing the output structure is enough usually.
            // However, the service logic is tightly coupled to crypto.
            // Let's just mock the repo behavior.

            mockApiKeyRepo.create.mockReturnValue({
                id: apiKeyId,
                truncatedKey: '345',
            });
            mockApiKeyRepo.save.mockResolvedValue({
                id: apiKeyId,
                truncatedKey: '345',
            });

            const result = await service.createApiKey(userId, name);

            expect(result).toHaveProperty('key');
            expect(result.key).toMatch(/^sk_live_/);
            expect(result.id).toBe(apiKeyId);
            expect(mockApiKeyRepo.create).toHaveBeenCalledWith(expect.objectContaining({
                userId,
                name,
                hash: expect.any(String),
                truncatedKey: expect.any(String),
            }));
            expect(mockApiKeyRepo.save).toHaveBeenCalled();
        });
    });

    describe('validateApiKey', () => {
        it('should return user if key is valid', async () => {
            const fullKey = 'sk_live_validKey';
            const mockUser = { id: 'user-1', isActive: true };
            const mockKeyEntity = {
                id: 'key-1',
                user: mockUser,
                lastUsedAt: new Date(),
            };

            mockApiKeyRepo.findOne.mockResolvedValue(mockKeyEntity);

            // We can spy on update to ensure it's NOT called if recently used
            const result = await service.validateApiKey(fullKey);

            expect(result).toEqual(mockUser);
            expect(mockApiKeyRepo.findOne).toHaveBeenCalledWith({
                where: { hash: expect.any(String), isActive: true },
                relations: ['user'],
            });
        });

        it('should validate key and update lastUsedAt if old', async () => {
            const fullKey = 'sk_live_validKey';
            const mockUser = { id: 'user-1', isActive: true };
            const oldDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
            const mockKeyEntity = {
                id: 'key-1',
                user: mockUser,
                lastUsedAt: oldDate,
            };

            mockApiKeyRepo.findOne.mockResolvedValue(mockKeyEntity);
            mockApiKeyRepo.update.mockResolvedValue({ affected: 1 });

            await service.validateApiKey(fullKey);

            expect(mockApiKeyRepo.update).toHaveBeenCalledWith(
                'key-1',
                { lastUsedAt: expect.any(Date) }
            );
        });

        it('should throw UnauthorizedException if key is invalid', async () => {
            mockApiKeyRepo.findOne.mockResolvedValue(null);

            await expect(service.validateApiKey('sk_live_invalid')).rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException if user is inactive', async () => {
            const mockUser = { id: 'user-1', isActive: false };
            const mockKeyEntity = {
                id: 'key-1',
                user: mockUser,
            };
            mockApiKeyRepo.findOne.mockResolvedValue(mockKeyEntity);

            await expect(service.validateApiKey('sk_live_valid')).rejects.toThrow(UnauthorizedException);
        });
    });

    describe('revokeApiKey', () => {
        it('should revoke API key successfully', async () => {
            mockApiKeyRepo.update.mockResolvedValue({ affected: 1 });

            await service.revokeApiKey('key-1', 'user-1');

            expect(mockApiKeyRepo.update).toHaveBeenCalledWith(
                { id: 'key-1', userId: 'user-1' },
                { isActive: false }
            );
        });

        it('should throw UnauthorizedException if key not found', async () => {
            mockApiKeyRepo.update.mockResolvedValue({ affected: 0 });

            await expect(service.revokeApiKey('key-1', 'user-1')).rejects.toThrow(UnauthorizedException);
        });
    });

    describe('listUserKeys', () => {
        it('should list user keys formatted correctly', async () => {
            const mockKeys = [
                {
                    id: 'key-1',
                    name: 'Test Key',
                    truncatedKey: 'abcd',
                    isActive: true,
                    createdAt: new Date(),
                    lastUsedAt: null,
                }
            ];
            mockApiKeyRepo.find.mockResolvedValue(mockKeys);

            const result = await service.listUserKeys('user-1');

            expect(result).toHaveLength(1);
            expect(result[0].truncated).toContain('sk_live_...abcd');
            expect(mockApiKeyRepo.find).toHaveBeenCalledWith({
                where: { userId: 'user-1' },
                order: { createdAt: 'DESC' },
            });
        });
    });

    describe('createUser', () => {
        it('should create and return a new user', async () => {
            const mockUser = { id: 'user-1', email: 'test@example.com', name: 'Test' };
            mockUserRepo.create.mockReturnValue(mockUser);
            mockUserRepo.save.mockResolvedValue(mockUser);

            const result = await service.createUser('test@example.com', 'Test');

            expect(result).toEqual(mockUser);
            expect(mockUserRepo.save).toHaveBeenCalledWith(mockUser);
        });

        it('should throw ConflictException if email exists', async () => {
            const error = new Error('Duplicate') as any;
            error.code = '23505';
            mockUserRepo.save.mockRejectedValue(error);
            mockUserRepo.create.mockReturnValue({});

            await expect(service.createUser('test@example.com', 'Test')).rejects.toThrow(ConflictException);
        });

        it('should throw other errors', async () => {
            const error = new Error('DB Error');
            mockUserRepo.save.mockRejectedValue(error);
            mockUserRepo.create.mockReturnValue({});

            await expect(service.createUser('test@example.com', 'Test')).rejects.toThrow('DB Error');
        });
    });
});
