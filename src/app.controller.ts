import { Body, Controller, Get, Param, Post, Logger, Query, DefaultValuePipe, ParseIntPipe, PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { AppService } from './app.service';
import { FetchUrlDto } from './fetch-url.dto';

@Injectable()
export class ParseIntWithMaxPipe implements PipeTransform {
    constructor(private readonly max: number) { }

    transform(value: any, metadata: ArgumentMetadata) {
        let val = parseInt(value, 10);
        if (isNaN(val)) {
            throw new BadRequestException('Validation failed');
        }
        if (val > this.max) {
            val = this.max;
        }
        return val;
    }
}

@Controller()
export class AppController {
    private readonly logger = new Logger(AppController.name);

    constructor(private readonly appService: AppService) { }

    @Post('fetch')
    async fetchUrls(@Body() fetchUrlDto: FetchUrlDto) {
        this.logger.log(`Received fetch request for ${fetchUrlDto.urls.length} URLs`);
        const requestId = await this.appService.fetchUrls(fetchUrlDto.urls);
        return { message: 'Fetching started', requestId, resultCount: fetchUrlDto.urls.length };
    }

    @Get('fetch/:id')
    getResults(
        @Param('id') id: string,
        @Query('cursor', new DefaultValuePipe(0), ParseIntPipe) cursor: number,
        @Query('limit', new DefaultValuePipe(100), new ParseIntWithMaxPipe(100)) limit: number
    ) {
        this.logger.log(`Fetching results for requestId: ${id} cursor: ${cursor} limit: ${limit}`);
        return this.appService.getResults(id, cursor, limit);
    }

    @Get('fetch/:id/status')
    getRequestStatus(@Param('id') id: string) {
        this.logger.log(`Fetching status for requestId: ${id}`);
        return this.appService.getRequestStatus(id);
    }
}
