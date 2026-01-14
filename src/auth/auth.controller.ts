import { Controller, Post, Get, Delete, Body, Param, UseGuards, HttpCode, HttpStatus, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { UserEntity } from './entities/user.entity';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@Controller({ path: 'auth', version: '1' })
@ApiTags('Authentication')
@UseGuards(ApiKeyGuard)
@ApiSecurity('x-api-key')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('keys')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Generate a new API key' })
    @ApiResponse({ status: 201, description: 'API key created successfully' })
    async createApiKey(
        @CurrentUser() user: UserEntity,
        @Body() dto: CreateApiKeyDto,
    ) {
        const result = await this.authService.createApiKey(user.id, dto.name);
        return {
            message: 'API key created successfully. Save this key - it will not be shown again!',
            apiKey: result.key,
            id: result.id,
            truncated: result.truncated,
        };
    }

    @Get('keys')
    @ApiOperation({ summary: 'List all API keys for current user' })
    @ApiResponse({ status: 200, description: 'List of API keys (masked)' })
    async listKeys(@CurrentUser() user: UserEntity) {
        const keys = await this.authService.listUserKeys(user.id);
        return { keys };
    }

    @Delete('keys/:id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Revoke an API key' })
    @ApiResponse({ status: 204, description: 'API key revoked successfully' })
    async revokeKey(
        @CurrentUser() user: UserEntity,
        @Param('id') keyId: string,
    ) {
        await this.authService.revokeApiKey(keyId, user.id);
    }

    @Post('users')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create a new user (admin only)' })
    @ApiResponse({ status: 201, description: 'User created successfully' })
    @ApiResponse({ status: 403, description: 'Only admin can create users' })
    async createUser(
        @CurrentUser() currentUser: UserEntity,
        @Body() body: { email: string; name: string },
    ) {
        // Critical security check: only admin can create users
        if (currentUser.id !== 'admin') {
            throw new ForbiddenException('Only admin can create users');
        }

        const user = await this.authService.createUser(body.email, body.name);
        return {
            message: 'User created successfully',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
            },
        };
    }
}
