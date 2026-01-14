import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

import * as crypto from 'crypto';

/**
 * Custom Throttler Guard that uses API key/user ID for rate limiting
 * instead of IP address for authenticated requests
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        if (context.getType() !== 'http') {
            return true;
        }
        return super.canActivate(context);
    }

    /**
     * Generate throttler key based on user ID or API key.
     * Falls back to IP address if no key is present.
     */
    protected async getTracker(req: Record<string, any>): Promise<string> {
        // 1. If user is already authenticated (e.g. guard order), use user ID
        if (req.user && req.user.id) {
            return `user-${req.user.id}`;
        }

        // 2. Try to extract API Key from headers (X-API-Key or Bearer)
        // This allows rate limiting by key even before full auth validation
        const apiKey = this.extractKey(req);
        if (apiKey) {
            // Hash the key to avoid storing raw keys in Redis/Logs
            const hash = crypto.createHash('md5').update(apiKey).digest('hex');
            return `key-${hash}`;
        }

        // 3. Fallback to IP-based tracking
        return req.ip || req.ips?.[0] || 'unknown';
    }

    private extractKey(request: any): string | null {
        // specific check for RabbitMQ or other non-http contexts where headers might be missing
        if (!request || !request.headers) {
            return null;
        }

        // Try X-API-Key header first
        let key = request.headers['x-api-key'];

        // Fallback to Authorization: Bearer
        if (!key && request.headers.authorization) {
            const [type, token] = request.headers.authorization.split(' ');
            if (type === 'Bearer') {
                key = token;
            }
        }

        return key || null;
    }

    /**
     * Override error message to provide clear feedback
     */
    protected async getErrorMessage(context: ExecutionContext, throttlerLimitDetail: any): Promise<string> {
        const { limit, ttl } = throttlerLimitDetail;
        const ttlSeconds = Math.ceil(ttl / 1000);
        return `Rate limit exceeded. You can make ${limit} requests per ${ttlSeconds} seconds. Please try again later.`;
    }
}
