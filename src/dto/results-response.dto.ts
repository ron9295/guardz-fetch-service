import { ApiProperty } from '@nestjs/swagger';
import { ScanStatus } from '../enums/scan-status.enum';
import { FetchStatus } from '../enums/fetch-status.enum';

class FetchResultDto {
    @ApiProperty({
        description: 'The URL that was fetched',
        example: 'https://example.com'
    })
    url: string;

    @ApiProperty({
        description: 'Status of the fetch operation',
        enum: FetchStatus,
        example: FetchStatus.SUCCESS
    })
    status: FetchStatus;

    @ApiProperty({
        description: 'HTTP status code if successful',
        example: 200,
        required: false
    })
    statusCode?: number;

    @ApiProperty({
        description: 'Page title extracted from HTML',
        example: 'Example Domain',
        required: false
    })
    title?: string;

    @ApiProperty({
        description: 'HTML content of the fetched page',
        example: '<!DOCTYPE html><html>...</html>',
        required: false
    })
    content?: string;

    @ApiProperty({
        description: 'Error message if fetch failed',
        example: 'Connection timeout',
        required: false
    })
    error?: string;

    @ApiProperty({
        description: 'Timestamp when the URL was fetched',
        example: '2026-01-15T10:00:00.000Z',
        required: false
    })
    fetchedAt?: Date;
}

class ResultsMetaDto {
    @ApiProperty({
        description: 'Cursor for next page of results (null if no more results)',
        example: '10',
        nullable: true
    })
    nextCursor: string | null;
}

export class ResultsResponseDto {
    @ApiProperty({
        description: 'Status of the scan request',
        enum: ScanStatus,
        example: ScanStatus.COMPLETED
    })
    status: ScanStatus;

    @ApiProperty({
        description: 'Array of fetch results',
        type: [FetchResultDto]
    })
    data: FetchResultDto[];

    @ApiProperty({
        description: 'Pagination metadata',
        type: ResultsMetaDto
    })
    meta: ResultsMetaDto;
}
