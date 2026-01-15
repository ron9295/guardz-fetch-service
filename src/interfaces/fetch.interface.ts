import { FetchStatus } from '../enums/fetch-status.enum';
import { ScanStatus } from '../enums/scan-status.enum';

export interface FetchResult {
    url: string;
    status: FetchStatus;
    statusCode?: number;
    title?: string;
    s3Key?: string;
    content?: string;
    error?: string;
    fetchedAt?: Date;
}

export interface FetchInput {
    scanId: string;
    urlId: string;
    url: string;
}

export interface PaginatedFetchResult {
    status: ScanStatus;
    data: FetchResult[];
    meta: {
        nextCursor: string | null;
    };
}
