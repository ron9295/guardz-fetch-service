import { Inject, Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Repository, Not } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { RequestEntity } from './entities/request.entity';
import { ResultEntity } from './entities/result.entity';
import { UrlFetcherService } from './url-fetcher.service';
import { StorageService } from './storage.service';
import { FetchInput, FetchResult, PaginatedFetchResult } from './interfaces/fetch.interface';

@Injectable()
export class AppService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(AppService.name);
    private isShuttingDown = false;
    private readonly BATCH_SIZE = 50;

    constructor(
        @Inject('REDIS_CLIENT') private readonly redis: Redis,
        private readonly amqpConnection: AmqpConnection,
        private readonly urlFetcherService: UrlFetcherService,
        private readonly storageService: StorageService,
        @InjectRepository(RequestEntity) private readonly requestRepository: Repository<RequestEntity>,
        @InjectRepository(ResultEntity) private readonly resultRepository: Repository<ResultEntity>,
    ) { }

    async onModuleInit() {
        await this.storageService.ensureBucketExists();
    }

    onModuleDestroy() {
        this.isShuttingDown = true;
    }

    /**
     * Submits a request to the reliable queue (RabbitMQ).
     * Creates a Request record in Postgres.
     */
    async fetchUrls(urls: string[]): Promise<string> {
        const requestId = uuidv4();

        // 1. Create Request Entity (The Parent)
        await this.requestRepository.save({
            id: requestId,
            total: urls.length,
            processed: 0,
            status: 'processing'
        });

        this.logger.log(`[${requestId}] Created request for ${urls.length} URLs`);

        // 2. Process in Chunks (Memory Efficient & Data Consistent)
        for (let i = 0; i < urls.length; i += this.BATCH_SIZE) {
            // A. Get the current chunk of URLs
            const urlChunk = urls.slice(i, i + this.BATCH_SIZE);

            // B. Prepare entities for DB
            // We let the DB generate the IDs
            const entitiesToInsert = urlChunk.map((url, index) => ({
                requestId: requestId,
                url: url,
                originalIndex: i + index,
                status: 'pending'
            }));

            // C. Bulk Insert & RETRIEVE GENERATED IDs
            // returning(['id', 'url']) is critical for Postgres to return the generated IDs
            const insertResult = await this.resultRepository
                .createQueryBuilder()
                .insert()
                .into(ResultEntity)
                .values(entitiesToInsert)
                .returning(['id', 'url'])
                .execute();

            // D. Map Real DB IDs to Queue Payload
            const generatedMaps = insertResult.generatedMaps;

            const queuePayload = generatedMaps.map(row => ({
                scanId: requestId,
                urlId: row.id, // This entity ID is needed by the worker for updates
                url: row.url
            }));

            // E. Publish to RabbitMQ
            await this.amqpConnection.publish('scraper_exchange', 'fetch.chunk', {
                requestId,
                inputs: queuePayload
            });
        }

        this.logger.log(`[${requestId}] Successfully dispatched ${urls.length} URLs`);

        return requestId;
    }

    // Public method called by UrlConsumer
    public async processInBatches(inputs: FetchInput[], requestId: string) {
        this.logger.debug(`[${requestId}] Processing batch of ${inputs.length} items`);

        // Send requests in parallel
        const results = await Promise.all(inputs.map(async (item) => {
            // 1. Fetch and Upload
            const resultData = await this.urlFetcherService.fetchAndStore(item.url, requestId);

            // 2. Create update object (No DB fetch!)
            // We use the ID passed from the producer to directly update the record
            const entityUpdate = {
                id: item.urlId,
                requestId: requestId,
                url: item.url,
                status: resultData.status,
                statusCode: resultData.statusCode,
                title: resultData.title,
                s3Key: resultData.s3Key,
                error: resultData.error,
                fetchedAt: resultData.fetchedAt
            };

            return entityUpdate;
        }));

        // 3. Bulk Save
        // Since we have the ID, TypeORM will perform an UPDATE
        await this.resultRepository.save(results);

        this.logger.debug(`[${requestId}] Batch updated: ${results.length} items`);

        // 4. Update counter safely
        // We count the actual number of completed items in the DB.
        // This is idempotent: if the job runs twice, the count will just be calculated again correctly.
        const processedCount = await this.resultRepository.count({
            where: {
                requestId,
                status: Not('pending')
            }
        });

        await this.requestRepository.update({ id: requestId }, { processed: processedCount });

        // 5. Check completion
        const request = await this.requestRepository.findOne({ where: { id: requestId } });
        if (request && request.processed >= request.total) {
            await this.requestRepository.update({ id: requestId }, { status: 'completed' });
            this.logger.log(`[${requestId}] Request completed. processed: ${request.processed}/${request.total}`);
        }
    }

    async getResults(requestId: string, cursor: string = '0', count: number = 100): Promise<PaginatedFetchResult> {
        // Interpret cursor as offset (skip)
        const skip = parseInt(cursor, 10) || 0;

        const [results, total] = await this.resultRepository.findAndCount({
            where: { requestId },
            take: count,
            skip: skip,
            order: { originalIndex: 'ASC' } // Ensure consistent ordering based on input
        });

        // Hydrate content from S3
        const hydratedResults = await Promise.all(results.map(async (entity) => {
            const result: FetchResult = {
                url: entity.url,
                status: entity.status as any,
                statusCode: entity.statusCode,
                title: entity.title,
                s3Key: entity.s3Key,
                error: entity.error,
                fetchedAt: entity.fetchedAt
            };

            if (result.s3Key) {
                try {
                    const stream = await this.storageService.getStream(result.s3Key);
                    const content = await this.storageService.streamToString(stream);
                    return { ...result, content, s3Key: undefined };
                } catch (error) {
                    this.logger.error(`[${requestId}] Failed to fetch S3 content for key ${result.s3Key}`, error);
                    return { ...result, error: 'Failed to retrieve content' };
                }
            }
            return result;
        }));

        const nextCursor = (skip + count < total) ? (skip + count).toString() : null;

        return {
            cursor: nextCursor || '',
            results: hydratedResults
        };
    }
    async getRequestStatus(requestId: string): Promise<{ status: string; total: number; processed: number; percentage: number }> {
        const request = await this.requestRepository.findOne({ where: { id: requestId } });

        if (!request) {
            throw new Error('Request not found');
        }

        const percentage = request.total > 0 ? (request.processed / request.total) * 100 : 0;

        return {
            status: request.status,
            total: request.total,
            processed: request.processed,
            percentage: Math.round(percentage * 100) / 100 // Round to 2 decimal places
        };
    }
}
