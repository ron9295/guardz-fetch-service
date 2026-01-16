import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUrl, ArrayNotEmpty, ArrayMaxSize } from 'class-validator';

// Configuration constant - evaluated once at module load
const MAX_URLS_PER_REQUEST = parseInt(process.env.MAX_URLS_PER_REQUEST || '1000', 10);

export class FetchUrlDto {
  @ApiProperty({
    description: 'List of HTTP/HTTPS URLs to fetch (protocol required)',
    example: ['https://google.com', 'https://example.com'],
    type: [String],
  })
  @IsArray({ message: 'urls must be an array' })
  @ArrayNotEmpty({ message: 'urls array cannot be empty' })
  @ArrayMaxSize(MAX_URLS_PER_REQUEST, {
    message: `urls array cannot contain more than ${MAX_URLS_PER_REQUEST} URLs`
  })
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
