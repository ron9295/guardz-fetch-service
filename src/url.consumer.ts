import { RabbitSubscribe, Nack } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger } from '@nestjs/common';
import { AppService } from './app.service';

@Injectable()
export class UrlConsumer {
    private readonly logger = new Logger(UrlConsumer.name);

    constructor(private readonly appService: AppService) { }

    @RabbitSubscribe({
        exchange: 'scraper_exchange',
        routingKey: 'fetch.chunk',
        queue: 'fetch_queue_rabbitmq',
        queueOptions: {
            durable: true,
            deadLetterExchange: 'scraper_dlx',
            deadLetterRoutingKey: 'fetch.chunk', // Optional: route back with same key or a specific dlq key
        }
    })
    public async processChunk(msg: { requestId: string, inputs: any[] }) {
        const { requestId, inputs } = msg;

        if (!requestId || !inputs) {
            this.logger.error(`Invalid message: ${JSON.stringify(msg)}`);
            return;
        }

        this.logger.debug(`[${requestId}] Received chunk via RabbitMQ (Inputs: ${inputs.length})`);

        try {
            await this.appService.processInBatches(inputs, requestId);
            this.logger.debug(`[${requestId}] Chunk processing completed`);
        } catch (error) {
            this.logger.error(`[${requestId}] Chunk failed`, error);
            // Nack the message to send it to DLQ (configured in queueOptions)
            return new Nack(false);
        }
    }
}
