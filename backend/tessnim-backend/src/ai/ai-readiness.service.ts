import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ReadinessResult } from './entities/readiness-result.entity';
import { PlayerMetricsDto } from './dto/player-metrics.dto';

@Injectable()
export class AiReadinessService {
    private readonly logger = new Logger(AiReadinessService.name);
    private genAI: GoogleGenerativeAI | null = null;

    constructor(
        @InjectRepository(ReadinessResult)
        private readinessRepo: Repository<ReadinessResult>,
        private config: ConfigService,
    ) {
        const apiKey = this.config.get<string>('GEMINI_API_KEY');
        if (apiKey) {
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.logger.log('✅ Gemini AI initialized');
        } else {
            this.logger.warn('⚠️ No GEMINI_API_KEY — using fallback formula only');
        }
    }

    // ─── Analyze one player ─────────────────────────────────────────────
    async analyzePlayer(dto: PlayerMetricsDto, clubId: string): Promise<ReadinessResult> {
        const matchDate = dto.matchDate || new Date().toISOString().split('T')[0];

        // Check cache first (valid for 24h)
        const cached = await this.readinessRepo.findOne({
            where: { playerId: dto.playerId, matchDate, clubId },
            order: { analyzedAt: 'DESC' },
        });

        if (cached) {
            const ageHours = (Date.now() - cached.analyzedAt.getTime()) / 3600000;
            if (ageHours < 24) {
                this.logger.log(`Cache hit for player ${dto.playerName}`);
                return cached;
            }
        }

        // Try Gemini AI first, fall back to formula
        let result: Partial<ReadinessResult>;
        let usedAi = false;

        try {
            if (this.genAI) {
                result = await this._analyzeWithGemini(dto);
                usedAi = true;
            } else {
                result = this._analyzeWithFormula(dto);
            }
        } catch (err) {
            this.logger.error(`Gemini error: ${err.message} — using fallback formula`);
            result = this._analyzeWithFormula(dto);
        }

        // Save to DB
        const entity = this.readinessRepo.create({
            playerId: dto.playerId,
            playerName: dto.playerName,
            clubId,
            matchDate,
            score: result.score,
            status: result.status,
            titulaire: result.titulaire,
            factors: result.factors,
            analysis: result.analysis,
            recommendation: result.recommendation,
            usedAi,
        });

        return this.readinessRepo.save(entity);
    }

    // ─── Get cached results ──────────────────────────────────────────────
    async getCachedResults(clubId: string, matchDate: string): Promise<ReadinessResult[]> {
        return this.readinessRepo.find({
            where: { clubId, matchDate },
            order: { score: 'DESC' },
        });
    }

    // ─── Delete old results (cleanup) ───────────────────────────────────
    async clearResults(clubId: string, matchDate: string): Promise<void> {
        await this.readinessRepo.delete({ clubId, matchDate });
    }

    // ─── Gemini AI Analysis ──────────────────────────────────────────────
    private async _analyzeWithGemini(dto: PlayerMetricsDto): Promise<Partial<ReadinessResult>> {
        const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `Tu es un analyste sportif IA expert pour un club de football professionnel.
Analyse ces données et génère un Match Readiness Score (0–100).

Joueur: ${dto.playerName} | Poste: ${dto.position}
ACWR: ${dto.acwr ?? 'N/A'} | HRV: ${dto.hrvScore ?? 'N/A'}/100 | Sommeil: ${dto.sleepHours ?? 'N/A'}h (${dto.sleepQuality ?? 'N/A'}%)
Douleur musculaire: ${dto.muscularPainLevel ?? 0}/10 | Fatigue déclarée: ${dto.fatigueLevel ?? 0}/10
Historique blessures: ${dto.injuryHistory ?? 'Aucune blessure connue'}
Zones actives: ${dto.activeInjuryZones ?? 'Aucune'}
Jours depuis dernière blessure: ${dto.daysSinceLastInjury ?? 'N/A'}
Note dernier match: ${dto.lastMatchRating ?? 'N/A'}/10 | Buts 5 derniers matchs: ${dto.goalsLast5 ?? 0} | Minutes: ${dto.minutesLast5 ?? 0}
Jours avant le match: ${dto.daysToMatch ?? 1}

Règles de scoring:
- ACWR >1.5 = surcharge chronique grave (-20 pts)
- ACWR >1.3 = surcharge (-10 pts)
- HRV <50 = récupération insuffisante (-15 pts)
- Fatigue >7 = risque élevé (-15 pts)
- Douleur >5 = risque blessure (-20 pts)
- Blessure récente (<7 jours) = -25 pts

Réponds UNIQUEMENT en JSON valide (sans markdown):
{
  "score": <entier 0-100>,
  "titulaire": <true/false>,
  "status": "<optimal|bon|attention|risque>",
  "factors": [
    {"icon": "<emoji>", "label": "<texte court>", "type": "<ok|warn|bad>"}
  ],
  "analysis": "<2 phrases en français sur l'état du joueur>",
  "recommendation": "<1 phrase action concrète pour le coach>"
}`;

        const response = await model.generateContent(prompt);
        const text = response.response.text().trim();

        // Clean any markdown code fences
        const clean = text.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(clean);

        return {
            score: Math.min(100, Math.max(0, parseInt(parsed.score))),
            titulaire: parsed.titulaire ?? parsed.score >= 70,
            status: parsed.status ?? this._scoreToStatus(parsed.score),
            factors: parsed.factors ?? [],
            analysis: parsed.analysis ?? '',
            recommendation: parsed.recommendation ?? '',
        };
    }

    // ─── Mathematical Fallback Formula ───────────────────────────────────
    private _analyzeWithFormula(dto: PlayerMetricsDto): Partial<ReadinessResult> {
        let score = 80; // base

        // ACWR impact
        const acwr = dto.acwr ?? 1.0;
        if (acwr > 1.5) score -= 20;
        else if (acwr > 1.3) score -= 10;
        else if (acwr < 0.7) score -= 8;
        else if (acwr >= 0.8 && acwr <= 1.2) score += 5;

        // HRV impact
        const hrv = dto.hrvScore ?? 70;
        if (hrv < 40) score -= 20;
        else if (hrv < 60) score -= 10;
        else if (hrv >= 80) score += 8;

        // Sleep impact
        const sleep = dto.sleepHours ?? 7;
        if (sleep < 5) score -= 15;
        else if (sleep < 6.5) score -= 8;
        else if (sleep >= 8) score += 5;

        // Fatigue
        const fatigue = dto.fatigueLevel ?? 3;
        if (fatigue >= 8) score -= 20;
        else if (fatigue >= 6) score -= 12;
        else if (fatigue <= 2) score += 5;

        // Pain
        const pain = dto.muscularPainLevel ?? 0;
        if (pain >= 7) score -= 25;
        else if (pain >= 5) score -= 15;
        else if (pain >= 3) score -= 8;

        // Injury history
        const daysSinceInjury = dto.daysSinceLastInjury ?? 999;
        if (daysSinceInjury < 7) score -= 25;
        else if (daysSinceInjury < 14) score -= 12;
        else if (daysSinceInjury < 30) score -= 5;

        // Recent form boost
        const rating = dto.lastMatchRating ?? 6.5;
        if (rating >= 8) score += 5;
        else if (rating <= 5) score -= 5;

        score = Math.min(100, Math.max(0, Math.round(score)));
        const status = this._scoreToStatus(score);

        const factors = this._buildFactors(dto, score);

        const analysis = this._buildAnalysis(dto, score);
        const recommendation = score >= 85
            ? `Titulariser ${dto.playerName} sans restriction.`
            : score >= 70
                ? `Peut jouer mais surveiller l'évolution de sa condition.`
                : score >= 60
                    ? `Usage limité recommandé — entrer en jeu après la 60e minute.`
                    : `Ne pas titulariser — risque de blessure trop élevé.`;

        return { score, status, titulaire: score >= 70, factors, analysis, recommendation };
    }

    private _scoreToStatus(score: number): string {
        if (score >= 85) return 'optimal';
        if (score >= 70) return 'bon';
        if (score >= 60) return 'attention';
        return 'risque';
    }

    private _buildFactors(dto: PlayerMetricsDto, score: number): any[] {
        const factors = [];
        const acwr = dto.acwr ?? 1.0;
        const hrv = dto.hrvScore ?? 70;
        const fatigue = dto.fatigueLevel ?? 3;

        factors.push({
            icon: acwr > 1.3 ? '⚡' : acwr < 0.8 ? '😴' : '✅',
            label: `Charge optimale (ACWR ${acwr.toFixed(2)})`,
            type: acwr > 1.3 ? 'bad' : acwr < 0.8 ? 'warn' : 'ok',
        });

        factors.push({
            icon: hrv >= 75 ? '💚' : hrv >= 55 ? '🟡' : '❤️',
            label: `Récupération cardiaque (${hrv}/100)`,
            type: hrv >= 75 ? 'ok' : hrv >= 55 ? 'warn' : 'bad',
        });

        if (dto.sleepHours) {
            factors.push({
                icon: dto.sleepHours >= 7.5 ? '😊' : dto.sleepHours >= 6 ? '😐' : '😴',
                label: `Sommeil ${dto.sleepHours}h (${dto.sleepQuality ?? '?'}%)`,
                type: dto.sleepHours >= 7.5 ? 'ok' : dto.sleepHours >= 6 ? 'warn' : 'bad',
            });
        }

        factors.push({
            icon: fatigue <= 3 ? '⚡' : fatigue <= 6 ? '🟡' : '🔴',
            label: `Fatigue: ${fatigue}/10`,
            type: fatigue <= 3 ? 'ok' : fatigue <= 6 ? 'warn' : 'bad',
        });

        if (dto.daysSinceLastInjury && dto.daysSinceLastInjury < 30) {
            factors.push({
                icon: '🩹',
                label: `Blessure il y a ${dto.daysSinceLastInjury}j`,
                type: dto.daysSinceLastInjury < 7 ? 'bad' : 'warn',
            });
        } else {
            factors.push({ icon: '🎯', label: 'Zéro douleur/fatigue', type: 'ok' });
        }

        return factors;
    }

    private _buildAnalysis(dto: PlayerMetricsDto, score: number): string {
        const name = dto.playerName.split(' ')[0];
        const acwr = dto.acwr ?? 1.0;
        if (score >= 85) {
            return `${name} est en excellente condition physique avec une charge d'entraînement optimale (ACWR ${acwr.toFixed(2)}). Sa récupération et ses indicateurs biométriques sont au vert pour ce match.`;
        }
        if (score >= 70) {
            return `${name} présente une condition satisfaisante avec quelques indicateurs à surveiller. Son niveau de fatigue ou de charge mérite une attention particulière en pré-match.`;
        }
        if (score >= 60) {
            return `${name} montre des signes de fatigue ou de surcharge qui nécessitent une gestion prudente. Une utilisation limitée est recommandée pour préserver son intégrité physique.`;
        }
        return `${name} présente des indicateurs préoccupants (ACWR ${acwr.toFixed(2)}, fatigue élevée) qui font peser un risque de blessure significatif. Une mise au repos est fortement conseillée.`;
    }
}
