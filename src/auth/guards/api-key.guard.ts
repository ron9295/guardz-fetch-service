import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
    constructor(
        private readonly authService: AuthService,
        private readonly configService: ConfigService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const key = this.extractKey(request);

        if (!key) {
            throw new UnauthorizedException('API Key missing');
        }

        // 1. Admin Key Check (Fastest, no DB)
        // Allows calling POST /auth/keys to create the first user
        const adminKey = this.configService.get<string>('ADMIN_API_KEY');
        if (adminKey && key === adminKey) {
            request.user = { id: 'admin', email: 'admin@system', name: 'Admin', isActive: true };
            return true;
        }

        // 2. Standard User Key Check (SHA-256 + DB)
        const user = await this.authService.validateApiKey(key);
        request.user = user;
        return true;
    }

    /**
     * Extract API key from headers
     * Supports both X-API-Key and Authorization: Bearer
     */
    private extractKey(request: any): string | null {
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
}
