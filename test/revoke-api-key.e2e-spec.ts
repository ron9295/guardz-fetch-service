import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ExecutionContext, VersioningType } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ApiKeyGuard } from '../src/auth/guards/api-key.guard';

// Mock uuid to avoid ESM issues
jest.mock('uuid', () => ({
    v4: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    }),
}));

describe('AuthController (e2e)', () => {
    let app: INestApplication;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideGuard(ApiKeyGuard)
            .useValue({
                canActivate: (context: ExecutionContext) => {
                    const req = context.switchToHttp().getRequest();
                    req.user = { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', email: 'test@e2e.com' };
                    return true;
                },
            }) // Mock authentication
            .compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({
            transform: true,
            whitelist: true,
            forbidNonWhitelisted: true,
        }));

        // Setup same configuration as main.ts
        app.setGlobalPrefix('api');
        app.enableVersioning({
            type: VersioningType.URI,
            defaultVersion: '1',
        });

        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    it('/auth/keys/:id (DELETE) -> should return 400 for invalid UUID', async () => {
        const invalidUuid = 'not-a-uuid';
        return request(app.getHttpServer())
            .delete(`/api/v1/auth/keys/${invalidUuid}`)
            .expect(400)
            .expect((res) => {
                const message = res.body.message;
                if (Array.isArray(message)) {
                    expect(message).toContain('Validation failed (uuid is expected)');
                } else {
                    expect(message).toBe('Validation failed (uuid is expected)');
                }
            });
    });
});
