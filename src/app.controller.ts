import { Body, Controller, Get, Param, Post, Logger, Query, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { AppService } from './app.service';
import { FetchUrlDto } from './fetch-url.dto';

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
        @Query('cursor') cursor?: string,
        @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit?: number
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
