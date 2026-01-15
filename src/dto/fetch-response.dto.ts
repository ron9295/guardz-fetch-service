import { ApiProperty } from '@nestjs/swagger';

export class FetchResponseDto {
    @ApiProperty({
        description: 'Success message',
        example: 'Fetching started'
    })
    message: string;

    @ApiProperty({
        description: 'UUID of the created scan request',
        example: '123e4567-e89b-12d3-a456-426614174000'
    })
    requestId: string;

    @ApiProperty({
        description: 'Number of URLs in the scan request',
        example: 10
    })
    resultCount: number;
}
