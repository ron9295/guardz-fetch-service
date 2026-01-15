import { ApiProperty } from '@nestjs/swagger';

class ApiKeyItemDto {
    @ApiProperty({
        description: 'UUID of the API key',
        example: '123e4567-e89b-12d3-a456-426614174000'
    })
    id: string;

    @ApiProperty({
        description: 'Name/description of the API key',
        example: 'Production Server'
    })
    name: string;

    @ApiProperty({
        description: 'Truncated version of the API key for security',
        example: 'gsk_...cdef'
    })
    truncated: string;

    @ApiProperty({
        description: 'Timestamp when the key was created',
        example: '2026-01-15T10:00:00.000Z'
    })
    createdAt: Date;

    @ApiProperty({
        description: 'Timestamp of last usage (null if never used)',
        example: '2026-01-15T10:30:00.000Z',
        nullable: true
    })
    lastUsedAt: Date | null;
}

export class ListKeysResponseDto {
    @ApiProperty({
        description: 'List of API keys belonging to the user',
        type: [ApiKeyItemDto]
    })
    keys: ApiKeyItemDto[];
}
