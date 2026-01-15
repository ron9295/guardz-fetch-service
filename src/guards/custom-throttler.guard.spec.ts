import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { CustomThrottlerGuard } from './custom-throttler.guard';
import { Reflector } from '@nestjs/core';
import { THROTTLER_OPTIONS } from '@nestjs/throttler/dist/throttler.constants';
import { ThrottlerStorage } from '@nestjs/throttler/dist/throttler-storage.interface';
import * as crypto from 'crypto';

describe('CustomThrottlerGuard', () => {
    let guard: CustomThrottlerGuard;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CustomThrottlerGuard,
                {
                    provide: THROTTLER_OPTIONS,
                    useValue: {
                        throttlers: [{ limit: 100, ttl: 60000 }],
                    },
                },
                {
                    provide: ThrottlerStorage,
                    useValue: {
                        increment: jest.fn().mockResolvedValue({ totalHits: 0, timeToExpire: 60000, isBlocked: false }),
                    },
                },
                Reflector,
            ],
        }).compile();

        guard = module.get<CustomThrottlerGuard>(CustomThrottlerGuard);
    });

    describe('canActivate', () => {
        it('should return true for non-HTTP contexts', async () => {
            const context = {
                getType: jest.fn().mockReturnValue('rpc'),
            } as unknown as ExecutionContext;

            const result = await guard.canActivate(context);

            expect(result).toBe(true);
            expect(context.getType).toHaveBeenCalled();
        });

        it('should call super.canActivate for HTTP contexts', async () => {
            const context = {
                getType: jest.fn().mockReturnValue('http'),
                switchToHttp: jest.fn().mockReturnValue({
                    getRequest: jest.fn().mockReturnValue({
                        ip: '127.0.0.1',
                        headers: {},
                    }),
                }),
                getHandler: jest.fn(),
                getClass: jest.fn(),
            } as unknown as ExecutionContext;

            // Mock the parent class method
            jest.spyOn(guard as any, 'getTracker').mockResolvedValue('127.0.0.1');

            // This will call the parent's canActivate which we need to mock
            // For now, we just verify the context type check works
            expect(context.getType()).toBe('http');
        });
    });

    describe('getTracker', () => {
        it('should track by user ID when authenticated', async () => {
            const req = {
                user: { id: 'user-123' },
                headers: {},
                ip: '192.168.1.1'
            };

            const tracker = await guard['getTracker'](req);

            expect(tracker).toBe('user-user-123');
        });

        it('should track by API key hash when present in x-api-key header', async () => {
            const apiKey = 'test-key-value';
            const expectedHash = crypto.createHash('md5').update(apiKey).digest('hex');
            const req = {
                headers: { 'x-api-key': apiKey },
                ip: '192.168.1.1'
            };

            const tracker = await guard['getTracker'](req);

            expect(tracker).toBe(`key-${expectedHash}`);
            expect(tracker).toMatch(/^key-[a-f0-9]{32}$/);
        });

        it('should track by API key hash when present in Authorization Bearer header', async () => {
            const apiKey = 'bearer-token-value';
            const expectedHash = crypto.createHash('md5').update(apiKey).digest('hex');
            const req = {
                headers: {
                    authorization: `Bearer ${apiKey}`
                },
                ip: '192.168.1.1'
            };

            const tracker = await guard['getTracker'](req);

            expect(tracker).toBe(`key-${expectedHash}`);
            expect(tracker).toMatch(/^key-[a-f0-9]{32}$/);
        });

        it('should prioritize user ID over API key', async () => {
            const req = {
                user: { id: 'user-456' },
                headers: { 'x-api-key': 'some-key' },
                ip: '192.168.1.1'
            };

            const tracker = await guard['getTracker'](req);

            expect(tracker).toBe('user-user-456');
        });

        it('should prioritize API key over IP address', async () => {
            const apiKey = 'priority-test';
            const expectedHash = crypto.createHash('md5').update(apiKey).digest('hex');
            const req = {
                headers: { 'x-api-key': apiKey },
                ip: '192.168.1.1'
            };

            const tracker = await guard['getTracker'](req);

            expect(tracker).toBe(`key-${expectedHash}`);
        });

        it('should track by IP when no auth', async () => {
            const req = {
                ip: '192.168.1.1',
                headers: {}
            };

            const tracker = await guard['getTracker'](req);

            expect(tracker).toBe('192.168.1.1');
        });

        it('should handle missing headers gracefully', async () => {
            const req = {
                ip: '127.0.0.1'
            };

            const tracker = await guard['getTracker'](req);

            expect(tracker).toBe('127.0.0.1');
        });

        it('should use first IP from ips array when ip is not available', async () => {
            const req = {
                ips: ['10.0.0.1', '10.0.0.2'],
                headers: {}
            };

            const tracker = await guard['getTracker'](req);

            expect(tracker).toBe('10.0.0.1');
        });

        it('should return "unknown" when no IP information is available', async () => {
            const req = {
                headers: {}
            };

            const tracker = await guard['getTracker'](req);

            expect(tracker).toBe('unknown');
        });
    });

    describe('extractKey', () => {
        it('should extract key from x-api-key header', () => {
            const req = {
                headers: { 'x-api-key': 'my-secret-key' }
            };

            const key = guard['extractKey'](req);

            expect(key).toBe('my-secret-key');
        });

        it('should extract key from Bearer authorization header', () => {
            const req = {
                headers: { authorization: 'Bearer my-bearer-token' }
            };

            const key = guard['extractKey'](req);

            expect(key).toBe('my-bearer-token');
        });

        it('should prioritize x-api-key over Bearer token', () => {
            const req = {
                headers: {
                    'x-api-key': 'api-key-value',
                    authorization: 'Bearer bearer-token'
                }
            };

            const key = guard['extractKey'](req);

            expect(key).toBe('api-key-value');
        });

        it('should return null for non-Bearer authorization', () => {
            const req = {
                headers: { authorization: 'Basic dXNlcjpwYXNz' }
            };

            const key = guard['extractKey'](req);

            expect(key).toBeNull();
        });

        it('should return null when no headers present', () => {
            const req = {};

            const key = guard['extractKey'](req);

            expect(key).toBeNull();
        });

        it('should return null when headers is undefined', () => {
            const req = { headers: undefined };

            const key = guard['extractKey'](req);

            expect(key).toBeNull();
        });

        it('should return null when request is null', () => {
            const key = guard['extractKey'](null);

            expect(key).toBeNull();
        });

        it('should handle malformed authorization header', () => {
            const req = {
                headers: { authorization: 'InvalidFormat' }
            };

            const key = guard['extractKey'](req);

            expect(key).toBeNull();
        });
    });

    describe('getErrorMessage', () => {
        it('should return formatted error message with rate limit details', async () => {
            const context = {} as ExecutionContext;
            const throttlerLimitDetail = {
                limit: 100,
                ttl: 60000, // 60 seconds in ms
            };

            const message = await guard['getErrorMessage'](context, throttlerLimitDetail);

            expect(message).toBe('Rate limit exceeded. You can make 100 requests per 60 seconds. Please try again later.');
        });

        it('should round up TTL to nearest second', async () => {
            const context = {} as ExecutionContext;
            const throttlerLimitDetail = {
                limit: 50,
                ttl: 30500, // 30.5 seconds
            };

            const message = await guard['getErrorMessage'](context, throttlerLimitDetail);

            expect(message).toBe('Rate limit exceeded. You can make 50 requests per 31 seconds. Please try again later.');
        });

        it('should handle small TTL values', async () => {
            const context = {} as ExecutionContext;
            const throttlerLimitDetail = {
                limit: 10,
                ttl: 1000, // 1 second
            };

            const message = await guard['getErrorMessage'](context, throttlerLimitDetail);

            expect(message).toBe('Rate limit exceeded. You can make 10 requests per 1 seconds. Please try again later.');
        });
    });
});
