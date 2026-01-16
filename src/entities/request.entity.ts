import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { ResultEntity } from './result.entity';
import { ScanStatus } from '../enums/scan-status.enum';

@Entity('requests')
export class RequestEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    total: number;

    @Column({ default: 0 })
    processed: number;

    @Column({ type: 'varchar', default: ScanStatus.IN_PROGRESS })
    status: ScanStatus;

    @Column({ nullable: true })
    userId: string;

    @CreateDateColumn()
    createdAt: Date;

    @OneToMany(() => ResultEntity, (result: ResultEntity) => result.request)
    results: ResultEntity[];
}
