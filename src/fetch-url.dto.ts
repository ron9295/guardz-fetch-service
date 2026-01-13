import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUrl, ArrayNotEmpty } from 'class-validator';

export class FetchUrlDto {
  @ApiProperty({
    description: 'List of HTTP URLs to fetch',
    example: ['https://google.com', 'https://example.com'],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUrl({}, { each: true })
  urls: string[];
}
