
export interface FetchResult {
    url: string;
    status: 'success' | 'error';
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
    status: string;
    data: FetchResult[];
    meta: {
        next_cursor: string | null;
    };
}
