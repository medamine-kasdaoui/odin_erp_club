import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { PlayersService } from '../../players/players.service';
import { ChatbotMessageDto } from '../dto/chatbot-message.dto';

@Injectable()
export class LearningAiService {
  private readonly logger = new Logger(LearningAiService.name);
  private readonly apiKey: string;
  private readonly model: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly playersService: PlayersService,
  ) {
    this.apiKey =
      this.configService.get<string>('GEMINI_API_KEY') ||
      this.configService.get<string>('GOOGLE_API_KEY') ||
      '';
    this.model =
      this.configService.get<string>('GEMINI_MODEL') || 'gemini-flash-lite-latest';
  }

  async practice(dto: ChatbotMessageDto) {
    const playerContext = await this.getPlayerContext(dto.playerId);
    const mode = dto.mode ?? 'practice';
    const prompt = this.buildPrompt(dto, playerContext);

    if (!this.apiKey) {
      return this.offlineResponse(dto.message, mode, playerContext);
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
      const response = await firstValueFrom(
        this.httpService.post(url, {
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.65,
            maxOutputTokens: 420,
          },
        }),
      );

      const reply =
        response.data?.candidates?.[0]?.content?.parts
          ?.map((part: any) => part.text)
          .filter(Boolean)
          .join('\n')
          .trim() || '';

      return {
        mode,
        model: this.model,
        provider: 'gemini',
        reply: reply || this.offlineResponse(dto.message, mode, playerContext).reply,
        suggestions: this.suggestionsForMode(mode),
      };
    } catch (error: any) {
      this.logger.warn(`Gemini learning chatbot failed: ${error?.message ?? 'unknown error'}`);
      return this.offlineResponse(dto.message, mode, playerContext);
    }
  }

  private async getPlayerContext(playerId?: string) {
    if (!playerId) return null;
    try {
      const player = await this.playersService.resolveByAnyId(playerId);
      return {
        name:
          player.name ||
          `${player.firstName ?? ''} ${player.lastName ?? ''}`.trim() ||
          'ODIN Player',
        position: player.position ?? 'Unknown',
        injured: player.isInjured === true,
        injuryType: player.lastInjuryType,
      };
    } catch (_) {
      return null;
    }
  }

  private buildPrompt(dto: ChatbotMessageDto, playerContext: any) {
    const mode = dto.mode ?? 'practice';
    const history = (dto.history ?? [])
      .map((item) => `${item.role === 'user' ? 'Player' : 'Coach'}: ${item.content}`)
      .join('\n');

    const modeInstruction = {
      practice:
        'Run a short sports-English practice conversation. Correct mistakes gently and give one better phrase.',
      interview:
        'Simulate a post-match TV interview. Ask one question at a time and coach the answer.',
      press_conference:
        'Simulate a press conference with difficult but fair questions. Train calm, team-first answers.',
      medical:
        'Simulate a player-to-medical-staff conversation about symptoms, pain scale, recovery, and injury reporting.',
    }[mode];

    return `
You are ODIN English Coach, an expert English tutor for professional football players.
Use clear B1-B2 English unless the player asks for advanced language.
Keep the answer concise: max 8 lines.
Always include:
1. A natural reply in the scenario.
2. One corrected or stronger phrase.
3. One follow-up question for the player.

Mode: ${mode}
Instruction: ${modeInstruction}
Player context: ${playerContext ? JSON.stringify(playerContext) : 'unknown player'}
Conversation so far:
${history || 'No previous messages.'}

Player message: ${dto.message}
`.trim();
  }

  private offlineResponse(message: string, mode: string, playerContext: any) {
    const position = playerContext?.position ? ` as a ${playerContext.position}` : '';
    const replyByMode: Record<string, string> = {
      practice:
        `Good start${position}. Stronger phrase: "I stayed focused and helped the team keep control." Try answering again with one short sentence about the next action.`,
      interview:
        `Interviewer: "You were under pressure late in the match. How did you stay composed?" Stronger phrase: "We trusted our structure and stayed together." What would you say next?`,
      press_conference:
        `Journalist: "Do you feel responsible for the result?" Stronger phrase: "I take responsibility, and we will respond as a group." Give me a calm team-first answer.`,
      medical:
        `Medical staff: "Describe the pain clearly." Stronger phrase: "I felt sharp pain during acceleration, around 7 out of 10." What movement triggered your pain?`,
    };

    return {
      mode,
      model: 'offline-coach',
      provider: 'local-fallback',
      reply: replyByMode[mode] ?? replyByMode.practice,
      suggestions: this.suggestionsForMode(mode),
      echo: message,
    };
  }

  private suggestionsForMode(mode: string) {
    if (mode === 'medical') {
      return ['Describe pain scale', 'Explain recovery status', 'Ask about training load'];
    }
    if (mode === 'press_conference' || mode === 'interview') {
      return ['Answer under pressure', 'Bridge a difficult question', 'Praise teammates'];
    }
    return ['Practice match commands', 'Improve grammar', 'Learn useful football phrases'];
  }
}
