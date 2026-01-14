import { Body, Controller, Get, Param, Post, Logger, Query, HttpCode, HttpStatus, ParseUUIDPipe } from '@nestjs/common';
import { AppService } from './app.service';
import { FetchUrlDto } from './fetch-url.dto';
import { PaginationDto } from './pagination.dto';
import { ApiTags } from '@nestjs/swagger';

@Controller({ path: 'scans', version: '1' })
@ApiTags('Scans v1')
export class AppController {
    private readonly logger = new Logger(AppController.name);

    constructor(private readonly appService: AppService) { }

    @Post()
    @HttpCode(HttpStatus.ACCEPTED)
    async fetchUrls(@Body() fetchUrlDto: FetchUrlDto) {
        this.logger.log(`Received fetch request for ${fetchUrlDto.urls.length} URLs`);
        const requestId = await this.appService.fetchUrls(fetchUrlDto.urls);
        return { message: 'Fetching started', requestId, resultCount: fetchUrlDto.urls.length };
    }

    @Get(':id/results')
    getResults(
        @Param('id', ParseUUIDPipe) id: string,
        @Query() query: PaginationDto
    ) {
        // AppService handles defaults for cursor (0) and limit (100)
        this.logger.log(`Fetching results for requestId: ${id} cursor: ${query.cursor} limit: ${query.limit}`);
        return this.appService.getResults(id, query.cursor, query.limit);
    }

    @Get(':id/status')
    getRequestStatus(@Param('id', ParseUUIDPipe) id: string) {
        this.logger.log(`Fetching status for requestId: ${id}`);
        return this.appService.getRequestStatus(id);
    }


}
