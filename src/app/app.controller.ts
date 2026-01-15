import { Body, Controller, Get, Param, Post, Logger, Query, HttpCode, HttpStatus, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { FetchUrlDto } from '../dto/fetch-url.dto';
import { PaginationDto } from '../dto/pagination.dto';
import { ApiTags, ApiSecurity, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserEntity } from '../auth/entities/user.entity';
import { Throttle } from '@nestjs/throttler';
import { FetchResponseDto } from '../dto/fetch-response.dto';
import { ResultsResponseDto } from '../dto/results-response.dto';
import { StatusResponseDto } from '../dto/status-response.dto';

@Controller({ path: 'scans', version: '1' })
@ApiTags('Scans v1')
@UseGuards(ApiKeyGuard)
@ApiSecurity('x-api-key')
export class AppController {
    private readonly logger = new Logger(AppController.name);

    constructor(private readonly appService: AppService) { }

    @Post()
    @HttpCode(HttpStatus.ACCEPTED)
    @Throttle({ default: { limit: 20, ttl: 60000 } })
    @ApiOperation({ summary: 'Submit URLs for fetching' })
    @ApiResponse({ status: 202, description: 'Fetch request accepted and queued', type: FetchResponseDto })
    @ApiResponse({ status: 400, description: 'Bad request - invalid URLs or format' })
    @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
    async fetchUrls(
        @CurrentUser() user: UserEntity,
        @Body() fetchUrlDto: FetchUrlDto
    ) {
        this.logger.log(`User ${user.id} received fetch request for ${fetchUrlDto.urls.length} URLs`);
        const requestId = await this.appService.fetchUrls(fetchUrlDto.urls, user.id);
        return { message: 'Fetching started', requestId, resultCount: fetchUrlDto.urls.length };
    }

    @Get(':id/results')
    @ApiOperation({ summary: 'Get paginated results for a scan request' })
    @ApiResponse({ status: 200, description: 'Fetch results with pagination', type: ResultsResponseDto })
    @ApiResponse({ status: 404, description: 'Request not found' })
    @ApiResponse({ status: 403, description: 'Forbidden - not authorized to access this request' })
    getResults(
        @CurrentUser() user: UserEntity,
        @Param('id', ParseUUIDPipe) id: string,
        @Query() query: PaginationDto
    ) {
        this.logger.log(`User ${user.id} fetching results for requestId: ${id}`);
        return this.appService.getResults(id, user.id, query.cursor, query.limit);
    }

    @Get(':id/status')
    @ApiOperation({ summary: 'Get status and progress of a scan request' })
    @ApiResponse({ status: 200, description: 'Scan request status and progress', type: StatusResponseDto })
    @ApiResponse({ status: 404, description: 'Request not found' })
    @ApiResponse({ status: 403, description: 'Forbidden - not authorized to access this request' })
    getRequestStatus(
        @CurrentUser() user: UserEntity,
        @Param('id', ParseUUIDPipe) id: string
    ) {
        this.logger.log(`User ${user.id} fetching status for requestId: ${id}`);
        return this.appService.getRequestStatus(id, user.id);
    }


}
