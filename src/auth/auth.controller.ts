import { Controller, Post, Get, Delete, Body, Param, UseGuards, HttpCode, HttpStatus, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { UserEntity } from './entities/user.entity';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { CreateUserDto } from './dto/create-user.dto';

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
    @ApiResponse({ status: 400, description: 'Admin cannot create API keys' })
    async createApiKey(
        @CurrentUser() user: UserEntity,
        @Body() dto: CreateApiKeyDto,
    ) {
        // Admin is a virtual user and cannot have API keys
        if (user.id === 'admin') {
            throw new BadRequestException('Admin user cannot create API keys. Please create a regular user first.');
        }

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
        @Body() dto: CreateUserDto,
    ) {
        // Critical security check: only admin can create users
        if (currentUser.id !== 'admin') {
            throw new ForbiddenException('Only admin can create users');
        }

        const user = await this.authService.createUser(dto.email, dto.name);
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
