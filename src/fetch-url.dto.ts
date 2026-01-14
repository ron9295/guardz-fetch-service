import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUrl, ArrayNotEmpty } from 'class-validator';

export class FetchUrlDto {
  @ApiProperty({
    description: 'List of HTTP/HTTPS URLs to fetch (protocol required)',
    example: ['https://google.com', 'https://example.com'],
    type: [String],
  })
  @IsArray({ message: 'urls must be an array' })
  @ArrayNotEmpty({ message: 'urls array cannot be empty' })
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    require_valid_protocol: true,
    require_tld: true
  }, {
    each: true,
    message: 'Each URL must be a valid HTTP or HTTPS URL with protocol and TLD (e.g., https://example.com)'
  })
  urls: string[];
}
