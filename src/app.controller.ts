import { Body, Controller, Get, Param, Post, Logger, Query, HttpCode, HttpStatus, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { FetchUrlDto } from './fetch-url.dto';
import { PaginationDto } from './pagination.dto';
import { ApiTags, ApiSecurity } from '@nestjs/swagger';
import { ApiKeyGuard } from './auth/guards/api-key.guard';
import { CurrentUser } from './auth/decorators/current-user.decorator';
import { UserEntity } from './auth/entities/user.entity';

@Controller({ path: 'scans', version: '1' })
@ApiTags('Scans v1')
@UseGuards(ApiKeyGuard)
@ApiSecurity('x-api-key')
export class AppController {
    private readonly logger = new Logger(AppController.name);

    constructor(private readonly appService: AppService) { }

    @Post()
    @HttpCode(HttpStatus.ACCEPTED)
    async fetchUrls(
        @CurrentUser() user: UserEntity,
        @Body() fetchUrlDto: FetchUrlDto
    ) {
        this.logger.log(`User ${user.id} received fetch request for ${fetchUrlDto.urls.length} URLs`);
        const requestId = await this.appService.fetchUrls(fetchUrlDto.urls, user.id);
        return { message: 'Fetching started', requestId, resultCount: fetchUrlDto.urls.length };
    }

    @Get(':id/results')
    getResults(
        @CurrentUser() user: UserEntity,
        @Param('id', ParseUUIDPipe) id: string,
        @Query() query: PaginationDto
    ) {
        this.logger.log(`User ${user.id} fetching results for requestId: ${id}`);
        return this.appService.getResults(id, user.id, query.cursor, query.limit);
    }

    @Get(':id/status')
    getRequestStatus(
        @CurrentUser() user: UserEntity,
        @Param('id', ParseUUIDPipe) id: string
    ) {
        this.logger.log(`User ${user.id} fetching status for requestId: ${id}`);
        return this.appService.getRequestStatus(id, user.id);
    }


}
