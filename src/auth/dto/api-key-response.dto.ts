import { ApiProperty } from '@nestjs/swagger';

export class ApiKeyResponseDto {
    @ApiProperty({
        description: 'Success message',
        example: 'API key created successfully. Save this key - it will not be shown again!'
    })
    message: string;

    @ApiProperty({
        description: 'The full API key (only shown once)',
        example: 'gsk_1234567890abcdef1234567890abcdef'
    })
    apiKey: string;

    @ApiProperty({
        description: 'UUID of the created API key',
        example: '123e4567-e89b-12d3-a456-426614174000'
    })
    id: string;

    @ApiProperty({
        description: 'Truncated version of the API key for display',
        example: 'gsk_...cdef'
    })
    truncated: string;
}
