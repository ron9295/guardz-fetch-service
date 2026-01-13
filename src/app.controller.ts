import { Body, Controller, Get, Param, Post, Logger, Query, DefaultValuePipe, ParseIntPipe, PipeTransform, Injectable, ArgumentMetadata, BadRequestException, HttpCode, HttpStatus, ParseUUIDPipe } from '@nestjs/common';
import { AppService } from './app.service';
import { FetchUrlDto } from './fetch-url.dto';

@Injectable()
export class IntRangePipe implements PipeTransform {
    constructor(
        private readonly min: number,
        private readonly max: number,
        private readonly options: { strictMin?: boolean; strictMax?: boolean } = {}
    ) { }

    transform(value: any, metadata: ArgumentMetadata) {
        let val = parseInt(value, 10);
        if (isNaN(val)) {
            throw new BadRequestException(`Validation failed. '${metadata.data}' must be a number.`);
        }
        if (val < this.min) {
            if (this.options.strictMin) {
                throw new BadRequestException(`Validation failed. '${metadata.data}' must be at least ${this.min}.`);
            }
            val = this.min;
        }
        if (val > this.max) {
            if (this.options.strictMax) {
                throw new BadRequestException(`Validation failed. '${metadata.data}' must be at most ${this.max}.`);
            }
            val = this.max;
        }
        return val;
    }
}

@Controller('scans')
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
        @Query('cursor', new DefaultValuePipe(0), new IntRangePipe(0, Number.MAX_SAFE_INTEGER, { strictMin: true })) cursor: number,
        @Query('limit', new DefaultValuePipe(100), new IntRangePipe(1, 100)) limit: number
    ) {
        this.logger.log(`Fetching results for requestId: ${id} cursor: ${cursor} limit: ${limit}`);
        return this.appService.getResults(id, cursor, limit);
    }

    @Get(':id/status')
    getRequestStatus(@Param('id', ParseUUIDPipe) id: string) {
        this.logger.log(`Fetching status for requestId: ${id}`);
        return this.appService.getRequestStatus(id);
    }


}
