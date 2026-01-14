import { Injectable, UnauthorizedException, Logger, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes, createHash } from 'crypto';
import { ApiKeyEntity } from './entities/api-key.entity';
import { UserEntity } from './entities/user.entity';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        @InjectRepository(ApiKeyEntity)
        private readonly apiKeyRepo: Repository<ApiKeyEntity>,
        @InjectRepository(UserEntity)
        private readonly userRepo: Repository<UserEntity>,
    ) { }

    /**
     * Generate a new API key with SHA-256 hash
     * Returns the plain key only once!
     */
    async createApiKey(userId: string, name: string): Promise<{ key: string; id: string; truncated: string }> {
        // 1. Generate high-entropy random key
        const rawKey = randomBytes(32).toString('hex'); // 64 hex chars
        const prefix = 'sk_live_';
        const fullKey = `${prefix}${rawKey}`;

        // 2. Hash with SHA-256 (fast: ~0.001ms)
        const hash = createHash('sha256').update(fullKey).digest('hex');

        // 3. Save metadata
        const apiKey = this.apiKeyRepo.create({
            userId,
            name,
            hash,
            truncatedKey: fullKey.slice(-4), // Last 4 chars for display
        });

        await this.apiKeyRepo.save(apiKey);

        this.logger.log(`Created API key for user ${userId}: ${name}`);

        return {
            key: fullKey, // Return plain key ONCE
            id: apiKey.id,
            truncated: `${prefix}...${apiKey.truncatedKey}`,
        };
    }

    /**
     * Validate API key with SHA-256 and throttled lastUsedAt update
     * Performance: ~0.001ms for hash + indexed DB lookup
     */
    async validateApiKey(fullKey: string): Promise<UserEntity> {
        // 1. Hash the received key
        const hash = createHash('sha256').update(fullKey).digest('hex');

        // 2. Find by hash (indexed lookup)
        const keyEntity = await this.apiKeyRepo.findOne({
            where: { hash, isActive: true },
            relations: ['user'],
        });

        if (!keyEntity) {
            throw new UnauthorizedException('Invalid API Key');
        }

        if (!keyEntity.user.isActive) {
            throw new UnauthorizedException('User account is inactive');
        }

        // 3. Throttled update: only if >1 hour since last update
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (!keyEntity.lastUsedAt || keyEntity.lastUsedAt < oneHourAgo) {
            // Fire-and-forget async update (don't block request)
            this.apiKeyRepo
                .update(keyEntity.id, { lastUsedAt: new Date() })
                .catch(err => this.logger.error('Failed to update lastUsedAt', err));
        }

        return keyEntity.user;
    }

    /**
     * Revoke (deactivate) an API key
     */
    async revokeApiKey(keyId: string, userId: string): Promise<void> {
        const result = await this.apiKeyRepo.update(
            { id: keyId, userId },
            { isActive: false }
        );

        if (result.affected === 0) {
            throw new UnauthorizedException('API key not found or not owned by user');
        }

        this.logger.log(`Revoked API key ${keyId}`);
    }

    /**
     * List user's API keys (masked)
     */
    async listUserKeys(userId: string): Promise<Array<{
        id: string;
        name: string;
        truncated: string;
        isActive: boolean;
        createdAt: Date;
        lastUsedAt: Date | null;
    }>> {
        const keys = await this.apiKeyRepo.find({
            where: { userId },
            order: { createdAt: 'DESC' },
        });

        return keys.map(key => ({
            id: key.id,
            name: key.name,
            truncated: `sk_live_...${key.truncatedKey}`,
            isActive: key.isActive,
            createdAt: key.createdAt,
            lastUsedAt: key.lastUsedAt,
        }));
    }

    /**
     * Create a user (for initial setup)
     */
    async createUser(email: string, name: string): Promise<UserEntity> {
        try {
            const user = this.userRepo.create({ email, name });
            await this.userRepo.save(user);
            this.logger.log(`Created user: ${email}`);
            return user;
        } catch (error) {
            // Postgres unique constraint violation code is 23505
            if (error.code === '23505') {
                throw new ConflictException('Email already exists');
            }
            throw error;
        }
    }
}
