import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import Redis from 'ioredis';
import { S3Client } from '@aws-sdk/client-s3';
import { UrlConsumer } from './url.consumer';
import { StorageService } from './storage.service';
import { UrlFetcherService } from './url-fetcher.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestEntity } from './entities/request.entity';
import { ResultEntity } from './entities/result.entity';
import { AuthModule } from './auth/auth.module';
import { UserEntity } from './auth/entities/user.entity';
import { ApiKeyEntity } from './auth/entities/api-key.entity';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { APP_GUARD } from '@nestjs/core';
import { CustomThrottlerGuard } from './guards/custom-throttler.guard';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                type: 'postgres',
                host: configService.get<string>('POSTGRES_HOST', 'localhost'),
                port: configService.get<number>('POSTGRES_PORT', 5432),
                username: configService.get<string>('POSTGRES_USER', 'user'),
                password: configService.get<string>('POSTGRES_PASSWORD', 'password'),
                database: configService.get<string>('POSTGRES_DB', 'scraper_db'),
                entities: [RequestEntity, ResultEntity, UserEntity, ApiKeyEntity],
                synchronize: configService.get<boolean>('DB_SYNCHRONIZE', true), // Dev only
            }),
        }),
        TypeOrmModule.forFeature([RequestEntity, ResultEntity]),
        AuthModule,
        RabbitMQModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => {
                const user = configService.get<string>('RABBITMQ_USER', 'user');
                const pass = configService.get<string>('RABBITMQ_PASS', 'password');
                const host = configService.get<string>('RABBITMQ_HOST', 'localhost');
                const port = configService.get<number>('RABBITMQ_PORT', 5672);

                return {
                    exchanges: [
                        {
                            name: 'scraper_exchange',
                            type: 'topic',
                        },
                        {
                            name: 'scraper_dlx',
                            type: 'topic',
                        },
                    ],
                    queues: [
                        {
                            name: 'fetch_queue_rabbitmq',
                            exchange: 'scraper_exchange',
                            routingKey: 'fetch.chunk',
                            options: {
                                durable: true,
                                arguments: {
                                    'x-dead-letter-exchange': 'scraper_dlx',
                                    'x-dead-letter-routing-key': 'fetch.chunk',
                                }
                            },
                        },
                        {
                            name: 'fetch_dlq_rabbitmq',
                            exchange: 'scraper_dlx',
                            routingKey: 'fetch.chunk', // Use same routing key to catch dead letters
                            options: {
                                durable: true,
                            },
                        },
                    ],
                    uri: `amqp://${user}:${pass}@${host}:${port}`,
                    connectionInitOptions: { wait: false },
                };
            },
        }),
        ThrottlerModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                throttlers: [
                    {
                        name: 'default',
                        ttl: configService.get<number>('THROTTLE_TTL', 60000), // 60 seconds
                        limit: configService.get<number>('THROTTLE_LIMIT', 100), // 100 requests per TTL
                    },
                ],
                storage: new ThrottlerStorageRedisService(
                    new Redis({
                        host: configService.get<string>('REDIS_HOST', 'localhost'),
                        port: configService.get<number>('REDIS_PORT', 6379),
                    })
                ),
            }),
        }),
    ],
    controllers: [AppController],
    providers: [
        {
            provide: APP_GUARD,
            useClass: CustomThrottlerGuard,
        },
        AppService,
        UrlConsumer,
        StorageService,
        UrlFetcherService,
        {
            provide: 'REDIS_CLIENT',
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => {
                return new Redis({
                    host: configService.get<string>('REDIS_HOST', 'localhost'),
                    port: configService.get<number>('REDIS_PORT', 6379),
                });
            },
        },
        {
            provide: 'S3_CLIENT',
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => {
                return new S3Client({
                    region: configService.get<string>('AWS_REGION', 'us-east-1'),
                    endpoint: configService.get<string>('S3_ENDPOINT', 'http://localhost:4566'),
                    forcePathStyle: true,
                    credentials: {
                        accessKeyId: configService.get<string>('AWS_ACCESS_KEY_ID', 'test'),
                        secretAccessKey: configService.get<string>('AWS_SECRET_ACCESS_KEY', 'test'),
                    },
                });
            },
        },
    ],
})
export class AppModule { }

