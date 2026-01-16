import { Inject, Injectable, OnModuleInit, OnModuleDestroy, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Repository, Not, MoreThanOrEqual } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { RequestEntity } from '../entities/request.entity';
import { ResultEntity } from '../entities/result.entity';
import { UrlFetcherService } from '../url-fetcher.service';
import { StorageService } from '../storage.service';
import { FetchInput, FetchResult, PaginatedFetchResult } from '../interfaces/fetch.interface';
import { ScanStatus } from '../enums/scan-status.enum';

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
    async fetchUrls(urls: string[], userId?: string): Promise<string> {
        const requestId = uuidv4();

        // 1. Create Request Entity (The Parent)
        await this.requestRepository.save({
            id: requestId,
            total: urls.length,
            processed: 0,
            status: ScanStatus.IN_PROGRESS,
            userId,
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

        // 4. Update counter safely using Conditional Update
        // We count the actual number of completed items in the DB.
        const processedCount = await this.resultRepository.count({
            where: {
                requestId,
                status: Not('pending')
            }
        });

        // Use QueryBuilder to avoid Race Condition
        // We update only if the new number is greater than the old number
        await this.requestRepository
            .createQueryBuilder()
            .update()
            .set({ processed: processedCount })
            .where("id = :id", { id: requestId })
            .andWhere("processed < :count", { count: processedCount }) // <--- Protection against overwriting
            .execute();

        // 5. Check completion
        const request = await this.requestRepository.findOne({ where: { id: requestId } });
        if (request && request.processed >= request.total) {
            await this.requestRepository.update({ id: requestId }, { status: ScanStatus.COMPLETED });
            this.logger.log(`[${requestId}] Request completed. processed: ${request.processed}/${request.total}`);
        }
    }

    async getResults(requestId: string, userId: string, cursor: number = 0, limit: number = 100): Promise<PaginatedFetchResult> {
        // 1. Check Request Status
        const request = await this.requestRepository.findOne({ where: { id: requestId } });
        if (!request) {
            throw new NotFoundException(`Request with ID '${requestId}' not found`);
        }

        // 2. Authorization: Check if user owns this request
        if (request.userId !== userId && userId !== 'admin') {
            throw new ForbiddenException('You do not have permission to access this request');
        }

        // 2. Try Cache (Only for completed requests) - Cache contains metadata only, not HTML
        let cachedMetadata: { status: string; data: any[]; meta: { nextCursor: string | null } } | null = null;
        if (request.status === ScanStatus.COMPLETED) {
            try {
                const cacheKey = `results:${requestId}:${cursor}:${limit}`;
                const cached = await this.redis.get(cacheKey);
                if (cached) {
                    this.logger.debug(`Cache hit for results ${cacheKey}`);
                    cachedMetadata = JSON.parse(cached);
                }
            } catch (error) {
                this.logger.warn(`Redis error, continuing without cache: ${error.message}`);
                // Continue to DB fallback
            }
        }

        // 3. Fetch from DB if not cached
        let results: any[];
        let total: number;
        let nextCursor: string | null;

        if (cachedMetadata) {
            // Use cached metadata
            results = cachedMetadata.data;
            total = cachedMetadata.data.length; // Approximate, but cursor is cached
            nextCursor = cachedMetadata.meta.nextCursor;
        } else {
            // Fetch from DB (for both completed and in-progress requests)
            // Use WHERE clause with originalIndex for efficient pagination (O(1) instead of O(n))
            const dbResults = await this.resultRepository.find({
                where: {
                    requestId,
                    ...(cursor > 0 && { originalIndex: MoreThanOrEqual(cursor) })
                },
                take: limit,
                order: { originalIndex: 'ASC' }
            });

            results = dbResults.map(entity => ({
                url: entity.url,
                status: entity.status,
                statusCode: entity.statusCode,
                title: entity.title,
                s3Key: entity.s3Key,
                error: entity.error,
                fetchedAt: entity.fetchedAt,
                originalIndex: entity.originalIndex // Keep for nextCursor calculation
            }));

            // Use request.total (not dbTotal which is remaining count after WHERE clause)
            total = request.total;

            // Calculate nextCursor from actual data (defensive coding)
            if (dbResults.length === limit && dbResults.length > 0) {
                const lastResult = dbResults[dbResults.length - 1];
                nextCursor = (lastResult.originalIndex + 1).toString();
            } else {
                nextCursor = null;
            }
        }

        // 4. Hydrate content from S3 (always fetch fresh, never cache HTML)
        const hydratedResults = await Promise.all(results.map(async (result) => {
            // Remove internal originalIndex field before returning
            const { originalIndex, ...resultWithoutIndex } = result;

            if (resultWithoutIndex.s3Key) {
                try {
                    const stream = await this.storageService.getStream(resultWithoutIndex.s3Key);
                    const content = await this.storageService.streamToString(stream);
                    return { ...resultWithoutIndex, content, s3Key: undefined };
                } catch (error) {
                    this.logger.error(`[${requestId}] Failed to fetch S3 content for key ${resultWithoutIndex.s3Key}`, error);
                    return { ...resultWithoutIndex, error: 'Failed to retrieve content' };
                }
            }
            return resultWithoutIndex;
        }));

        const response: PaginatedFetchResult = {
            status: request.status,
            data: hydratedResults,
            meta: {
                nextCursor: nextCursor
            }
        };

        // 5. Save metadata to Cache (Only for completed requests, without HTML content, TTL: 1 Hour)
        if (request.status === ScanStatus.COMPLETED && !cachedMetadata) {
            try {
                const cacheKey = `results:${requestId}:${cursor}:${limit}`;
                const metadataToCache = {
                    status: request.status,
                    data: results, // Only metadata, no HTML content
                    meta: {
                        nextCursor: nextCursor
                    }
                };
                await this.redis.set(cacheKey, JSON.stringify(metadataToCache), 'EX', 3600);
            } catch (error) {
                this.logger.warn(`Redis error, failed to cache results: ${error.message}`);
                // Continue without caching - data is already in DB
            }
        }

        return response;
    }

    async getRequestStatus(requestId: string, userId: string): Promise<{ status: string; total: number; processed: number; percentage: number }> {
        const request = await this.requestRepository.findOne({ where: { id: requestId } });

        if (!request) {
            throw new NotFoundException(`Request with ID '${requestId}' not found`);
        }

        // Authorization: Check if user owns this request
        if (request.userId !== userId && userId !== 'admin') {
            throw new ForbiddenException('You do not have permission to access this request');
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
