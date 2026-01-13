import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { RequestEntity } from './request.entity';

@Entity('results')
@Index(['request', 'url']) // Optimize lookup
export class ResultEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    url: string;

    @Column({ type: 'int', default: 0 })
    originalIndex: number;

    @Column()
    status: string;

    @Column({ nullable: true })
    statusCode?: number;

    @Column({ nullable: true })
    title?: string;

    @Column({ nullable: true })
    s3Key?: string;

    @Column({ nullable: true })
    error?: string;

    @Column({ nullable: true })
    fetchedAt: Date;

    @ManyToOne(() => RequestEntity, (request: RequestEntity) => request.results)
    @JoinColumn({ name: 'requestId' })
    request: RequestEntity;

    @Column()
    requestId: string; // Explicit column for easier querying
}
