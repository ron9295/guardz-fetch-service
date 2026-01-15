import { ApiProperty } from '@nestjs/swagger';
import { ScanStatus } from '../enums/scan-status.enum';

export class StatusResponseDto {
    @ApiProperty({
        description: 'Status of the scan request',
        enum: ScanStatus,
        example: ScanStatus.IN_PROGRESS
    })
    status: ScanStatus;

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
