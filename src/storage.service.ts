import { Injectable, Logger, Inject } from '@nestjs/common';
import { S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

@Injectable()
export class StorageService {
    private readonly logger = new Logger(StorageService.name);
    private readonly bucketName = process.env.S3_BUCKET_NAME || 'scraped-content';

    constructor(
        @Inject('S3_CLIENT') private readonly s3: S3Client,
    ) { }

    async ensureBucketExists() {
        try {
            await this.s3.send(new HeadBucketCommand({ Bucket: this.bucketName }));
        } catch (error) {
            try {
                await this.s3.send(new CreateBucketCommand({ Bucket: this.bucketName }));
                this.logger.log(`Bucket ${this.bucketName} created.`);
            } catch (createError) {
                this.logger.error('Error creating bucket:', createError);
            }
        }
    }

    async upload(key: string, body: string, contentType: string = 'text/html'): Promise<void> {
        await this.s3.send(new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: body,
            ContentType: contentType,
        }));
    }

    async getStream(key: string): Promise<Readable> {
        const { Body } = await this.s3.send(new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key
        }));
        return Body as Readable;
    }

    async streamToString(stream: Readable): Promise<string> {
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
            stream.on('error', (err) => reject(err));
            stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        });
    }
}
