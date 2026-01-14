import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateApiKeyDto {
    @ApiProperty({
        description: 'Name/description for the API key (e.g., "Production Server")',
        example: 'Production Server',
        minLength: 3,
        maxLength: 100
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(3)
    @MaxLength(100)
    name: string;
}
