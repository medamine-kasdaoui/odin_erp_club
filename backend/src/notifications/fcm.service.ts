import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FcmService implements OnModuleInit {
    private readonly logger = new Logger(FcmService.name);
    private app: admin.app.App | null = null;
    private initialized = false;

    constructor(private readonly configService: ConfigService) {}

    onModuleInit() {
        const projectId   = this.configService.get<string>('FIREBASE_PROJECT_ID');
        const privateKey  = this.configService.get<string>('FIREBASE_PRIVATE_KEY');
        const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');

        if (!projectId || !privateKey || !clientEmail) {
            this.logger.warn(
                'FCM non configuré — variables FIREBASE_* manquantes dans .env. Les notifications push seront désactivées.',
            );
            return;
        }

        try {
            // Avoid duplicate initialization in hot-reload
            if (admin.apps.length === 0) {
                this.app = admin.initializeApp({
                    credential: admin.credential.cert({
                        projectId,
                        privateKey: privateKey.replace(/\\n/g, '\n'),
                        clientEmail,
                    }),
                });
            } else {
                this.app = admin.apps[0];
            }
            this.initialized = true;
            this.logger.log('Firebase Admin SDK initialisé ✅');
        } catch (err) {
            this.logger.error('Erreur initialisation Firebase Admin SDK', err);
        }
    }

    /** Envoie une notification push à un token unique */
    async sendToToken(
        token: string,
        title: string,
        body: string,
        data?: Record<string, string>,
    ): Promise<boolean> {
        if (!this.initialized || !token) return false;
        try {
            await admin.messaging().send({
                token,
                notification: { title, body },
                data: data ?? {},
                android: { priority: 'high' },
                apns: { payload: { aps: { sound: 'default', badge: 1 } } },
            });
            return true;
        } catch (err) {
            this.logger.warn(`FCM sendToToken failed for token ${token.slice(0, 20)}...: ${(err as Error).message}`);
            return false;
        }
    }

    /** Envoie une notification push à plusieurs tokens (batch multicast — max 500) */
    async sendToTokens(
        tokens: string[],
        title: string,
        body: string,
        data?: Record<string, string>,
    ): Promise<{ successCount: number; failureCount: number }> {
        if (!this.initialized || tokens.length === 0) {
            return { successCount: 0, failureCount: tokens.length };
        }

        // Firebase multicast accepts max 500 tokens per call
        const chunks = this.chunkArray(tokens, 500);
        let successCount = 0;
        let failureCount = 0;

        for (const chunk of chunks) {
            try {
                const response = await admin.messaging().sendEachForMulticast({
                    tokens: chunk,
                    notification: { title, body },
                    data: data ?? {},
                    android: { priority: 'high' },
                    apns: { payload: { aps: { sound: 'default', badge: 1 } } },
                });
                successCount += response.successCount;
                failureCount += response.failureCount;
            } catch (err) {
                this.logger.warn(`FCM sendToTokens batch failed: ${(err as Error).message}`);
                failureCount += chunk.length;
            }
        }

        this.logger.log(`FCM multicast: ${successCount} envoyés, ${failureCount} échoués`);
        return { successCount, failureCount };
    }

    /** Envoie à un topic FCM (club_<clubId>, team_<teamId>, etc.) */
    async sendToTopic(
        topic: string,
        title: string,
        body: string,
        data?: Record<string, string>,
    ): Promise<boolean> {
        if (!this.initialized) return false;
        try {
            await admin.messaging().send({
                topic,
                notification: { title, body },
                data: data ?? {},
                android: { priority: 'high' },
                apns: { payload: { aps: { sound: 'default', badge: 1 } } },
            });
            this.logger.log(`FCM topic "${topic}" envoyé`);
            return true;
        } catch (err) {
            this.logger.warn(`FCM sendToTopic "${topic}" failed: ${(err as Error).message}`);
            return false;
        }
    }

    get isReady(): boolean {
        return this.initialized;
    }

    private chunkArray<T>(arr: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
        }
        return chunks;
    }
}
