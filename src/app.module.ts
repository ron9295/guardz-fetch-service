import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import Redis from 'ioredis';
import { S3Client } from '@aws-sdk/client-s3';
import { UrlConsumer } from './url.consumer';
import { StorageService } from './storage.service';
import { UrlFetcherService } from './url-fetcher.service';
import { ConfigModule } from '@nestjs/config';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestEntity } from './entities/request.entity';
import { ResultEntity } from './entities/result.entity';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
            type: 'postgres',
            host: process.env.POSTGRES_HOST || 'localhost',
            port: 5432,
            username: process.env.POSTGRES_USER || 'user',
            password: process.env.POSTGRES_PASSWORD || 'password',
            database: process.env.POSTGRES_DB || 'scraper_db',
            entities: [RequestEntity, ResultEntity],
            synchronize: true, // Dev only
        }),
        TypeOrmModule.forFeature([RequestEntity, ResultEntity]),
        RabbitMQModule.forRoot({
            exchanges: [
                {
                    name: 'scraper_exchange',
                    type: 'topic',
                },
            ],
            uri: `amqp://${process.env.RABBITMQ_USER || 'user'}:${process.env.RABBITMQ_PASS || 'password'}@${process.env.RABBITMQ_HOST || 'localhost'}:5672`,
            connectionInitOptions: { wait: false },
        }),
    ],
    controllers: [AppController],
    providers: [
        AppService,
        UrlConsumer,
        StorageService,
        UrlFetcherService,
        {
            provide: 'REDIS_CLIENT',
            useFactory: () => {
                return new Redis({
                    host: process.env.REDIS_HOST || 'localhost',
                    port: parseInt(process.env.REDIS_PORT) || 6379,
                });
            },
        },
        {
            provide: 'S3_CLIENT',
            useFactory: () => {
                return new S3Client({
                    region: process.env.AWS_REGION || 'us-east-1',
                    endpoint: process.env.S3_ENDPOINT || 'http://localhost:4566',
                    forcePathStyle: true,
                    credentials: {
                        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
                        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
                    },
                });
            },
        },
    ],
})
export class AppModule { }
