import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { createHash } from 'crypto';
import { StorageService } from './storage.service';
import { FetchResult } from './interfaces/fetch.interface';

@Injectable()
export class UrlFetcherService {
    private readonly logger = new Logger(UrlFetcherService.name);

    constructor(private readonly storageService: StorageService) { }

    async fetchAndStore(url: string, requestId: string): Promise<Omit<FetchResult, 'content'>> {
        const fetchedAt = new Date();
        try {
            const response = await axios.get(url, {
                timeout: 5000,
                maxRedirects: 5,
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
