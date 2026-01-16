import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationDto {
    @ApiPropertyOptional({
        description: 'Cursor for pagination (zero-based index)',
        default: 0,
        minimum: 0
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    cursor?: number;

    @ApiPropertyOptional({
        description: 'Number of items to return',
        default: 100,
        minimum: 1,
        maximum: 100
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number;
}
