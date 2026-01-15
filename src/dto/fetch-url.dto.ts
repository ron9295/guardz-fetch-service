import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUrl, ArrayNotEmpty, ArrayMaxSize } from 'class-validator';

export class FetchUrlDto {
  @ApiProperty({
    description: 'List of HTTP/HTTPS URLs to fetch (protocol required)',
    example: ['https://google.com', 'https://example.com'],
    type: [String],
  })
  @IsArray({ message: 'urls must be an array' })
  @ArrayNotEmpty({ message: 'urls array cannot be empty' })
  @ArrayMaxSize(parseInt(process.env.MAX_URLS_PER_REQUEST || '1000', 10), {
    message: `urls array cannot contain more than ${process.env.MAX_URLS_PER_REQUEST || 1000} URLs`
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
