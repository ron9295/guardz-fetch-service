import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        logger: ['error', 'warn', 'log', 'debug', 'verbose'],
        bufferLogs: true,
    });

    const configService = app.get(ConfigService);
    const logger = new Logger('Bootstrap');

    app.use(helmet());

    app.enableCors({
        origin: configService.get('CORS_ORIGIN') || '*',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    });

    app.setGlobalPrefix('api');

    // Enable URI versioning (e.g., /api/v1/scans)
    app.enableVersioning({
        type: VersioningType.URI,
        defaultVersion: '1',
    });

    app.useGlobalPipes(new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
    }));

    app.enableShutdownHooks();

    const config = new DocumentBuilder()
        .setTitle('Guardz Fetch Service')
        .setDescription('API to fetch and retrieve content from HTTP URLs')
        .setVersion('1.0')
        .addTag('Scans v1')
        .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);

    const port = configService.get<number>('PORT') || 3000;
    await app.listen(port);

    logger.log(`🚀 Application is running on: http://localhost:${port}/api/v1`);
    logger.log(`📑 Swagger is available at: http://localhost:${port}/docs`);
}
bootstrap();