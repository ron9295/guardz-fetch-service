import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { createHash } from 'crypto';
import { StorageService } from './storage.service';
import { FetchResult } from './interfaces/fetch.interface';

@Injectable()
export class UrlFetcherService {
    private readonly logger = new Logger(UrlFetcherService.name);

    constructor(
        private readonly storageService: StorageService,
        private readonly configService: ConfigService,
    ) { }

    async fetchAndStore(url: string, requestId: string): Promise<Omit<FetchResult, 'content'>> {
        const fetchedAt = new Date();
        const timeout = this.configService.get<number>('FETCH_TIMEOUT', 5000);
        const maxRedirects = this.configService.get<number>('FETCH_MAX_REDIRECTS', 5);

        try {
            const response = await axios.get(url, {
                timeout,
                maxRedirects,
                responseType: 'text',
            });

            const title = this.extractTitle(response.data);

            // Upload content to S3
            const urlHash = createHash('md5').update(url).digest('hex');
            const s3Key = `${requestId}/${urlHash}.html`;

            await this.storageService.upload(s3Key, response.data);

            return {
                url,
                status: 'success',
                statusCode: response.status,
                title,
                s3Key,
                fetchedAt,
            };
        } catch (error: any) {
            this.logger.error(`Failed to fetch ${url}: ${error.message}`);
            return {
                url,
                status: 'error',
                error: error.message || 'Unknown error',
                statusCode: error.response?.status,
                fetchedAt,
            };
        }
    }

    private extractTitle(html: string): string {
        const match = html.match(/<title>([^<]*)<\/title>/i);
        return match && match[1] ? match[1] : 'No Title';
    }
}
