import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IncomingCallPushPayload } from "./calls.types";

interface PushDispatchResult {
  sent: number;
  failed: number;
  invalidTokens: string[];
}

@Injectable()
export class CallsNotificationsService {
  private readonly logger = new Logger(CallsNotificationsService.name);
  private firebaseChecked = false;
  private firebaseAdmin: any = null;

  constructor(private readonly configService: ConfigService) {}

  async sendIncomingCall(
    tokens: string[],
    payload: IncomingCallPushPayload,
  ): Promise<PushDispatchResult> {
    const title = "Incoming Call";
    const body = `You have a call from ${payload.callerName}`;

    return this.sendToTokens(tokens, {
      notification: {
        title,
        body,
      },
      data: {
        type: "incoming_call",
        callId: payload.callId,
        channelId: payload.channelId,
        conversationId: payload.conversationId,
        callerId: payload.callerId,
        callerName: payload.callerName,
        isVideo: String(payload.isVideo),
        sessionType: payload.sessionType,
      },
      android: {
        priority: "high",
        notification: {
          channelId: "incoming_calls",
          sound: "default",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            contentAvailable: true,
          },
        },
      },
    });
  }

  async sendMissedCall(
    tokens: string[],
    params: {
      callId: string;
      callerName: string;
      conversationId: string;
    },
  ): Promise<PushDispatchResult> {
    return this.sendToTokens(tokens, {
      notification: {
        title: "Missed Call",
        body: `You missed a call from ${params.callerName}`,
      },
      data: {
        type: "missed_call",
        callId: params.callId,
        conversationId: params.conversationId,
        callerName: params.callerName,
      },
      android: {
        priority: "high",
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
          },
        },
      },
    });
  }

  private async sendToTokens(
    tokens: string[],
    message: Record<string, unknown>,
  ): Promise<PushDispatchResult> {
    const uniqueTokens = Array.from(
      new Set(tokens.filter((token) => token.trim().length > 0)),
    );
    if (uniqueTokens.length === 0) {
      return { sent: 0, failed: 0, invalidTokens: [] };
    }

    const admin = this.getFirebaseAdmin();
    if (!admin) {
      return { sent: 0, failed: uniqueTokens.length, invalidTokens: [] };
    }

    const chunks: string[][] = [];
    const chunkSize = 500;
    for (let index = 0; index < uniqueTokens.length; index += chunkSize) {
      chunks.push(uniqueTokens.slice(index, index + chunkSize));
    }

    let sent = 0;
    let failed = 0;
    const invalidTokens: string[] = [];

    for (const chunk of chunks) {
      const response = await admin.messaging().sendEachForMulticast({
        tokens: chunk,
        ...message,
      });

      sent += response.successCount;
      failed += response.failureCount;

      response.responses.forEach((item: any, idx: number) => {
        if (!item.success && this.isInvalidTokenError(item.error?.code)) {
          invalidTokens.push(chunk[idx]);
        }
      });
    }

    if (failed > 0) {
      this.logger.warn(
        `Call push delivery partial failure (sent=${sent}, failed=${failed}, invalid=${invalidTokens.length})`,
      );
    }

    return { sent, failed, invalidTokens };
  }

  private isInvalidTokenError(code: string | undefined) {
    if (!code) {
      return false;
    }

    return [
      "messaging/invalid-registration-token",
      "messaging/registration-token-not-registered",
      "messaging/invalid-argument",
    ].includes(code);
  }

  private getFirebaseAdmin(): any | null {
    if (this.firebaseChecked) {
      return this.firebaseAdmin;
    }

    this.firebaseChecked = true;

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const admin = require("firebase-admin");

      const serviceAccountJson = this.configService.get<string>(
        "FIREBASE_SERVICE_ACCOUNT_JSON",
      );
      const projectId = this.configService.get<string>("FIREBASE_PROJECT_ID");
      const clientEmail = this.configService.get<string>(
        "FIREBASE_CLIENT_EMAIL",
      );
      const privateKeyRaw = this.configService.get<string>(
        "FIREBASE_PRIVATE_KEY",
      );

      if (
        !serviceAccountJson &&
        (!projectId || !clientEmail || !privateKeyRaw)
      ) {
        this.logger.warn(
          "Firebase push disabled: missing service account configuration",
        );
        this.firebaseAdmin = null;
        return null;
      }

      const credentialSource = serviceAccountJson
        ? JSON.parse(serviceAccountJson)
        : {
            projectId,
            clientEmail,
            privateKey: privateKeyRaw?.replace(/\\n/g, "\n"),
          };

      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(credentialSource),
        });
      }

      this.firebaseAdmin = admin;
      this.logger.log("Firebase push provider initialized for calls");
      return this.firebaseAdmin;
    } catch (error) {
      this.logger.warn(
        `Firebase push provider unavailable (${error instanceof Error ? error.message : "unknown error"})`,
      );
      this.firebaseAdmin = null;
      return null;
    }
  }
}
