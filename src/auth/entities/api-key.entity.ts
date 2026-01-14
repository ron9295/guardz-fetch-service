import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, Index } from 'typeorm';
import { UserEntity } from './user.entity';

@Entity('api_keys')
export class ApiKeyEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column({ length: 8 })
    truncatedKey: string; // Last 4 chars for display (e.g., "...abc123")

    @Index()
    @Column({ unique: true })
    hash: string; // SHA-256 hash of the full key

    @Column({ default: true })
    isActive: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @Column({ nullable: true })
    lastUsedAt: Date;

    @ManyToOne(() => UserEntity, user => user.apiKeys)
    user: UserEntity;

    @Column()
    userId: string;
}
