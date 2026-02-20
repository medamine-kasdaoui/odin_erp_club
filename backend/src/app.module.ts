import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { ClubsModule } from './clubs/clubs.module';
import { FinanceModule } from './finance/finance.module';
import { OtpModule } from './otp/otp.module';
import { RbacModule } from './rbac/rbac.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGO_URI', 'mongodb://localhost:27017/odin_backend')
      })
    }),
    RbacModule,
    OtpModule,
    AuditModule,
    UsersModule,
    ClubsModule,
    AuthModule,
    FinanceModule
  ],
  controllers: [AppController]
})
export class AppModule {}
