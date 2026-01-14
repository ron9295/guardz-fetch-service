import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ApiKeyGuard } from './guards/api-key.guard';
import { UserEntity } from './entities/user.entity';
import { ApiKeyEntity } from './entities/api-key.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([UserEntity, ApiKeyEntity]),
    ],
    controllers: [AuthController],
    providers: [AuthService, ApiKeyGuard],
    exports: [AuthService, ApiKeyGuard],
})
export class AuthModule { }
