import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // Enable CORS for Flutter mobile app
    app.enableCors({
        origin: '*', // In production, specify your Flutter app's origin
        credentials: true,
    });

    // Global validation pipe
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );

    // API prefix
    app.setGlobalPrefix('api/v1');

    const port = process.env.PORT || 3000;
    await app.listen(port);

    console.log(`🚀 Odin ERP Club API running on: http://localhost:${port}/api/v1`);
}

bootstrap();
