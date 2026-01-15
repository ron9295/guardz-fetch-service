import { ApiProperty } from '@nestjs/swagger';

export class StatusResponseDto {
    @ApiProperty({
        description: 'Status of the scan request',
        enum: ['pending', 'in_progress', 'completed', 'failed'],
        example: 'in_progress'
    })
    status: string;

    @ApiProperty({
        description: 'Total number of URLs in the scan',
        example: 100
    })
    total: number;

    @ApiProperty({
        description: 'Number of URLs processed so far',
        example: 75
    })
    processed: number;

    @ApiProperty({
        description: 'Completion percentage (0-100)',
        example: 75.0
    })
    percentage: number;
}
