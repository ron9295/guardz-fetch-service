import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { ResultEntity } from './result.entity';

@Entity('requests')
export class RequestEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    total: number;

    @Column({ default: 0 })
    processed: number;

    @Column({ default: 'processing' })
    status: string;

    @CreateDateColumn()
    createdAt: Date;

    @OneToMany(() => ResultEntity, (result: ResultEntity) => result.request)
    results: ResultEntity[];
}
