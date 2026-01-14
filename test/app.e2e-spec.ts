import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ExecutionContext } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module'; // Adjust path if needed
import { ApiKeyGuard } from '../src/auth/guards/api-key.guard';

// Mock uuid to avoid ESM issues
jest.mock('uuid', () => ({
    v4: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    }),
}));

describe('AppController (e2e)', () => {
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
            })
            .compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new ValidationPipe());
        // Ensure we don't conflict with the running app port if we were to listen,
        // but supertest doesn't need app.listen() usually, it takes the http adapter.
        // However, some NestJS setups prefer app.init().
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    it('/scans (POST) -> Status -> Results flow', async () => {
        // 1. Submit URLs
        const urls = ['https://example.com', 'https://google.com'];
        const postResponse = await request(app.getHttpServer())
            .post('/scans')
            .send({ urls })
            .expect(202);

        const { requestId } = postResponse.body;
        expect(requestId).toBeDefined();

        // 2. Poll for completion (Max 10 seconds)
        let status = 'processing';
        let attempts = 0;
        while (status !== 'completed' && attempts < 20) {
            await new Promise((r) => setTimeout(r, 500)); // Wait 500ms
            const statusResponse = await request(app.getHttpServer())
                .get(`/scans/${requestId}/status`)
                .expect(200);

            status = statusResponse.body.status;
            attempts++;
        }

        expect(status).toBe('completed');

        // 3. Get Results
        const resultsResponse = await request(app.getHttpServer())
            .get(`/scans/${requestId}/results`)
            .expect(200);

        const results = resultsResponse.body.data;
        expect(results).toHaveLength(2);
        expect(results[0].content).toBeDefined(); // Assuming hydration works
        expect(results[0].status).toBe('success');
    }, 30000); // 30s timeout
});
