import { Injectable, HttpException, HttpStatus, Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PredictPlayerDto } from './dto/predict-player.dto';
import { TrainPlayerDto } from './dto/train-player.dto';
import { PredictPlayerValueDto } from './dto/predict-player-value.dto';
import { Player, PlayerDocument } from '../players/schemas/player.schema';
import { MedicalRecord, MedicalRecordDocument } from '../medical/schemas/medical-record.schema';
import { MatchPlayer, MatchPlayerDocument } from '../matches/schemas/match-player.schema';
import { LedgerEntry, LedgerEntryDocument } from '../finance/schemas/ledger-entry.schema';
import { Test, TestDocument } from './schemas/test.schema';

@Injectable()
export class AiService {
    private readonly logger = new Logger(AiService.name);
    private readonly aiBaseUrl: string;
    private readonly playerValueAiUrl: string;
    private readonly financeAiUrl: string;
    private readonly readinessCache = new Map<string, any[]>();

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
        @InjectModel(Player.name) private playerModel: Model<PlayerDocument>,
        @InjectModel(MedicalRecord.name) private medicalRecordModel: Model<MedicalRecordDocument>,
        @InjectModel(MatchPlayer.name) private matchPlayerModel: Model<MatchPlayerDocument>,
        @InjectModel(LedgerEntry.name) private ledgerEntryModel: Model<LedgerEntryDocument>,
        @InjectModel(Test.name) private testModel: Model<TestDocument>,
    ) {
        this.aiBaseUrl =
            this.configService.get<string>('AI_SERVICE_URL') ||
            'http://localhost:8000';
        this.playerValueAiUrl =
            this.configService.get<string>('PLAYER_VALUE_AI_URL') ||
            'http://localhost:8300';
        this.financeAiUrl =
            this.configService.get<string>('FINANCE_AI_URL') ||
            'http://localhost:8200';

        this.logger.log(`AI Service URL: ${this.aiBaseUrl}`);
        this.logger.log(`Player Value AI URL: ${this.playerValueAiUrl}`);
        this.logger.log(`Finance AI URL: ${this.financeAiUrl}`);
    }

    getWeights() {
        return {
            performance: {
                rating: 0.5,
                goals: 8,
                assists: 6,
                tackles: 1.5,
                passes: 0.02,
                yellowCard: -5,
                redCard: -15,
            },
            prospect: {
                ageMax: 23,
                minutes: 0.2,
                rating: 4,
            },
            injuryRisk: {
                activeInjury: 20,
                highSeverity: 25,
                recoveryDays: 0.5,
                workloadRatio: 25,
                fatigue: 0.4,
            },
        };
    }

    /**
     * Aggregates medical and performance data for a player.
     */
    async getAggregatedPlayerData(playerId: string): Promise<PredictPlayerValueDto> {
        if (!Types.ObjectId.isValid(playerId)) {
            throw new HttpException('Invalid player ID format', HttpStatus.BAD_REQUEST);
        }

        const player = await this.playerModel.findById(playerId);
        if (!player) {
            throw new NotFoundException('Player not found');
        }

        // 1. Get Medical Stats
        const medicalHistory = await this.medicalRecordModel
            .find({ playerId: new Types.ObjectId(playerId) })
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        const avgRecoveryTime = medicalHistory.length > 0
            ? medicalHistory.reduce((acc, rec) => acc + (rec.recoveryDays || 0), 0) / medicalHistory.length
            : 0;

        // 2. Get Performance Stats
        const matchStats = await this.matchPlayerModel
            .find({ providerPlayerId: player.providerPlayerId })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();

        const totalGoals = matchStats.reduce((acc, match) => acc + (match.goals || 0), 0);
        const totalAssists = matchStats.reduce((acc, match) => acc + (match.assists || 0), 0);
        const totalMinutes = matchStats.reduce((acc, match) => acc + (match.minutes || 0), 0);
        const avgRating = matchStats.length > 0
            ? matchStats.reduce((acc, match) => acc + (match.rating || 0), 0) / matchStats.length
            : 0;

        // Calculate consistency score (inverse of variance)
        const consistencyScore = matchStats.length > 1
            ? 100 - (matchStats.reduce((acc, match) => acc + Math.abs((match.rating || 0) - avgRating), 0) / matchStats.length) * 10
            : 80;

        return {
            userId: player.userId?.toString(),
            firstName: player.firstName || '',
            lastName: player.lastName || '',
            dateOfBirth: player.dateOfBirth?.toISOString(),
            position: player.position,
            strongFoot: player.strongFoot,
            jerseyNumber: player.jerseyNumber,
            height: player.height,
            weight: player.weight,
            photo: player.photo,
            nationality: player.nationality,
            speed: player.speed || 0,
            endurance: player.endurance || 0,
            distance: player.distance || 0,
            dribbles: player.dribbles || 0,
            shots: player.shots || 0,
            injuries: player.injuryHistory || 0,
            heart_rate: player.heart_rate || 0,
            age: player.age,
            // Medical
            recoveryTime: avgRecoveryTime,
            fitnessLevel: player.baseFitness || 75,
            medicalRiskScore: player.lastInjuryProbability || 0,
            // Performance
            goals: totalGoals,
            assists: totalAssists,
            minutesPlayed: totalMinutes,
            ratingPerMatch: avgRating,
            consistencyScore: Math.min(100, Math.max(0, consistencyScore)),
        };
    }

    getReadiness(matchDate: string) {
        return this.readinessCache.get(matchDate) ?? [];
    }

    analyzeReadiness(payload: Record<string, any>) {
        const matchDate = String(payload.matchDate ?? new Date().toISOString().split('T')[0]);
        const fatigue = Number(payload.fatigueLevel ?? 0);
        const pain = Number(payload.muscularPainLevel ?? 0);
        const hrv = Number(payload.hrvScore ?? 75);
        const sleep = Number(payload.sleepQuality ?? 75);
        const acwr = Number(payload.acwr ?? 1);
        const activeInjury = Boolean(payload.activeInjuryZones);

        let score = 100;
        score -= Math.min(30, fatigue * 3);
        score -= Math.min(25, pain * 3);
        score -= Math.max(0, 75 - hrv) * 0.25;
        score -= Math.max(0, 75 - sleep) * 0.2;
        score -= Math.max(0, Math.abs(acwr - 1) * 18);
        if (activeInjury) {
            score -= 25;
        }
        const roundedScore = Math.max(0, Math.min(100, Math.round(score)));
        const status =
            roundedScore >= 85 ? 'optimal' :
            roundedScore >= 70 ? 'bon' :
            roundedScore >= 55 ? 'attention' :
            'risque';

        const factors = [
            { icon: 'fitness_center', label: `Fatigue ${fatigue || 0}/10`, type: fatigue >= 7 ? 'bad' : fatigue >= 4 ? 'warn' : 'ok' },
            { icon: 'hotel', label: `Recuperation ${sleep || 75}`, type: sleep < 50 ? 'bad' : sleep < 70 ? 'warn' : 'ok' },
            { icon: 'favorite', label: `HRV ${hrv || 75}`, type: hrv < 50 ? 'bad' : hrv < 70 ? 'warn' : 'ok' }
        ];

        const result = {
            id: `${payload.playerId ?? 'player'}-${matchDate}`,
            playerId: String(payload.playerId ?? ''),
            playerName: String(payload.playerName ?? ''),
            score: roundedScore,
            status,
            titulaire: roundedScore >= 70,
            factors,
            analysis: `Readiness score ${roundedScore}/100`,
            recommendation: roundedScore >= 70 ? 'Player can be considered for selection.' : 'Reduce load and monitor recovery.',
            usedAi: false,
            analyzedAt: new Date().toISOString()
        };

        const existing = this.readinessCache.get(matchDate) ?? [];
        const next = existing.filter((item) => item.playerId !== result.playerId);
        next.push(result);
        this.readinessCache.set(matchDate, next);
        return result;
    }

    clearReadiness(matchDate: string) {
        this.readinessCache.delete(matchDate);
        return { success: true };
    }

    /**
     * Prediction of player's market value using the specialized Player Value AI.
     */
    async predictPlayerValue(data: PredictPlayerValueDto): Promise<any> {
        try {
            // Map PredictPlayerValueDto to Python's PlayerInput
            const payload = {
                // Base features
                speed: data.speed || 0,
                endurance: data.endurance || 0,
                distance: data.distance || 0,
                dribbles: data.dribbles || 0,
                shots: data.shots || 0,
                injuries: data.injuries || 0,
                heart_rate: data.heart_rate || 0,
                age: data.age || 25,
                
                // Medical features
                recoveryTime: data.recoveryTime || 0,
                fitnessLevel: data.fitnessLevel || 75,
                medicalRiskScore: data.medicalRiskScore || 0,
                
                // Performance features
                goals: data.goals || 0,
                assists: data.assists || 0,
                minutesPlayed: data.minutesPlayed || 0,
                ratingPerMatch: data.ratingPerMatch || 0,
                consistencyScore: data.consistencyScore || 80,
            };

            const response = await firstValueFrom(
                this.httpService.post(`${this.playerValueAiUrl}/predict-player-value`, payload),
            );
            return response.data;
        } catch (error) {
            this.handleAiError(error, 'predict-player-value');
        }
    }

    /**
     * ROI and Financial analysis based on predicted value.
     * Note: In this version, we use the Finance AI for global insights,
     * but we provide a simplified ROI calculation here for the player card.
     */
    async getFinanceInsights(data: { predictedValue: number, acquisitionCost?: number, performanceScore: number }): Promise<any> {
        const cost = data.acquisitionCost || 150000;
        const roi = cost > 0 ? ((data.predictedValue - cost) / cost) * 100 : 0;
        
        return {
            roi_percentage: Math.round(roi * 10) / 10,
            recommendation: roi > 20 ? 'HAUT POTENTIEL D\'INVESTISSEMENT' : 'VALEUR STABLE',
            market_context: 'Stable',
        };
    }

    /**
     * Global Finance Insights: Forecast, Risk, and Simulation.
     * Aggregates LedgerEntry data and calls Finance AI (port 8200).
     */
    async getGlobalFinanceInsights(): Promise<any> {
        try {
            // 1. Aggregate historical data
            const entries = await this.ledgerEntryModel.find().sort({ entryDate: 1 }).lean();
            
            // Group by month
            const monthlyData: Record<string, { revenue: number, expenses: number }> = {};
            
            entries.forEach(entry => {
                const dateKey = entry.entryDate.toISOString().substring(0, 7) + '-01';
                if (!monthlyData[dateKey]) {
                    monthlyData[dateKey] = { revenue: 0, expenses: 0 };
                }
                if (entry.type === 'REVENUE') {
                    monthlyData[dateKey].revenue += entry.amount;
                } else if (entry.type === 'EXPENSE') {
                    monthlyData[dateKey].expenses += entry.amount;
                }
            });

            const records = Object.entries(monthlyData).map(([date, vals]) => ({
                date,
                revenue: vals.revenue,
                expenses: vals.expenses,
            }));

            // 2. Call AI Endpoints
            const forecastPromise = firstValueFrom(
                this.httpService.post(`${this.financeAiUrl}/forecast`, { data: records.length > 0 ? records : null })
            );
            
            const riskPromise = firstValueFrom(
                this.httpService.post(`${this.financeAiUrl}/risk`, { data: records.length > 0 ? records : null })
            );

            const [forecastRes, riskRes] = await Promise.all([forecastPromise, riskPromise]);

            // --- Normalize payload shapes for the mobile app ---
            // Some Finance AI implementations return a raw list for /forecast.
            // The mobile UI expects { forecast: [...], chart: {...} }.
            const rawForecast = forecastRes.data as any;
            const forecastList: Array<any> = Array.isArray(rawForecast)
                ? rawForecast
                : Array.isArray(rawForecast?.forecast)
                    ? rawForecast.forecast
                    : [];

            const dates = forecastList.map((p) => p?.date).filter(Boolean);
            const revenueSeries = forecastList.map((p) => Number(p?.revenue ?? 0));
            const expenseSeries = forecastList.map((p) => Number(p?.expenses ?? 0));
            const netSeries = forecastList.map((p) => Number(p?.net ?? 0));

            const normalizedForecast = {
                forecast: forecastList,
                chart: {
                    dates,
                    revenue: revenueSeries,
                    expenses: expenseSeries,
                    net: netSeries,
                },
            };

            const rawRisk = riskRes.data as any;
            let normalizedRisk: any = rawRisk;

            // If /risk returns a simple shape (risk_score / risk_level / factors),
            // convert it into { risk_alerts: [...], chart: { dates, gap } }.
            if (!rawRisk?.risk_alerts && rawRisk?.risk_score != null) {
                const riskScore = Number(rawRisk.risk_score ?? 0);
                const riskLevel = String(rawRisk.risk_level ?? rawRisk.riskLevel ?? '').toUpperCase();
                const factors: string[] = Array.isArray(rawRisk.factors) ? rawRisk.factors.map(String) : [];

                // Mark alert as RISK_* only for medium/high to avoid permanent "100" score in UI.
                const riskAlerts =
                    riskScore >= 70 || riskLevel.includes('HIGH') || riskLevel.includes('ELEV')
                        ? ['RISK_HIGH', ...factors]
                        : riskScore >= 40 || riskLevel.includes('MED')
                            ? ['RISK_MEDIUM', ...factors]
                            : factors.length > 0
                                ? ['RISK_LOW', ...factors]
                                : [];

                const gap = forecastList.map((p) => Number((p?.expenses ?? 0) - (p?.revenue ?? 0)));
                normalizedRisk = {
                    risk_alerts: riskAlerts,
                    chart: { dates, gap },
                };
            }

            return {
                source: 'finance-ai-ml',
                forecast: normalizedForecast,
                risk: normalizedRisk,
                generatedAt: new Date().toISOString(),
            };
        } catch (error) {
            this.handleAiError(error, 'global-finance-insights');
        }
    }

    /**
     * Predict recruitment decision for a player.
     * Calls Python: POST /predict
     */
    async predict(dto: PredictPlayerDto): Promise<any> {
        try {
            const response = await firstValueFrom(
                this.httpService.post(`${this.aiBaseUrl}/predict`, dto),
            );
            return response.data;
        } catch (error) {
            this.handleAiError(error, 'predict');
        }
    }

    /**
     * Send labeled players for training.
     * Calls Python: POST /train
     */
    async train(players: TrainPlayerDto[]): Promise<any> {
        try {
            const response = await firstValueFrom(
                this.httpService.post(`${this.aiBaseUrl}/train`, players),
            );
            return response.data;
        } catch (error) {
            this.handleAiError(error, 'train');
        }
    }

    /**
     * Get the training dataset.
     * Calls Python: GET /dataset
     */
    async getDataset(): Promise<any> {
        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.aiBaseUrl}/dataset`),
            );
            return response.data;
        } catch (error) {
            this.handleAiError(error, 'roi-analysis');
        }
    }

    /**
     * Dashboard Data: Fetches players and their latest AI predictions from the 'test' collection.
     */
    async getDashboardPlayers(): Promise<any[]> {
        // Keep behavior consistent with PlayersService.findAll(): treat missing status as active.
        const players = await this.playerModel
            .find({
                $or: [
                    { status: { $regex: /^active$/i } },
                    { status: { $exists: false } },
                ],
            })
            .sort({ updatedAt: -1, createdAt: -1 })
            .limit(50)
            .lean();
        const results = [];

        for (const player of players) {
            // Check if we already have a recent prediction in the 'test' collection
            let latestTest = await this.testModel.findOne({ playerId: player._id })
                .sort({ createdAt: -1 })
                .lean();

            if (!latestTest) {
                // If no prediction exists, trigger one (simplified for dashboard)
                try {
                    const aggregated = await this.getAggregatedPlayerData(player._id.toString());
                    const prediction = await this.predictPlayerValue(aggregated);
                    
                    latestTest = await this.testModel.create({
                        playerId: player._id,
                        currentValue: aggregated.acquisitionCost || 150000,
                        predictedValue: prediction.predicted_value,
                        nextSeasonValue: prediction.next_season_value,
                        confidenceScore: prediction.confidence_score,
                        keyFactors: prediction.key_factors,
                        explanation: prediction.explanation,
                    });
                } catch (e) {
                    this.logger.warn(`Failed to predict for player ${player._id}: ${e.message}`);
                }
            }

            results.push({
                ...player,
                aiAnalysis: latestTest,
            });
        }

        return results;
    }

    /**
     * Get model metrics (cross-validation, feature importance, etc.).
     * Calls Python: GET /metrics
     */
    async getMetrics(): Promise<any> {
        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.aiBaseUrl}/metrics`),
            );
            return response.data;
        } catch (error) {
            this.handleAiError(error, 'metrics');
        }
    }

    /**
     * Find similar players from the training dataset.
     * Calls Python: POST /similar
     */
    async findSimilar(dto: PredictPlayerDto, topN: number = 5): Promise<any> {
        try {
            const response = await firstValueFrom(
                this.httpService.post(`${this.aiBaseUrl}/similar?top_n=${topN}`, dto),
            );
            return response.data;
        } catch (error) {
            this.handleAiError(error, 'similar');
        }
    }

    /**
     * Compute development potential score.
     * Calls Python: POST /potential
     */
    async getPotential(dto: PredictPlayerDto): Promise<any> {
        try {
            const response = await firstValueFrom(
                this.httpService.post(`${this.aiBaseUrl}/potential`, dto),
            );
            return response.data;
        } catch (error) {
            this.handleAiError(error, 'potential');
        }
    }

    /**
     * Generate personalized development plan.
     * Calls Python: POST /development-plan
     */
    async getDevelopmentPlan(dto: PredictPlayerDto): Promise<any> {
        try {
            const response = await firstValueFrom(
                this.httpService.post(`${this.aiBaseUrl}/development-plan`, dto),
            );
            return response.data;
        } catch (error) {
            this.handleAiError(error, 'development-plan');
        }
    }

    /**
     * Get model status (trained, dataset size, etc.).
     * Calls Python: GET /status
     */
    async getStatus(): Promise<any> {
        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.aiBaseUrl}/status`),
            );
            return response.data;
        } catch (error) {
            this.handleAiError(error, 'status');
        }
    }

    /**
     * Generate chemistry insights from the Python AI service.
     * Calls Python: POST /chemistry/insights
     *
     * This method is intentionally non-throwing so feature modules can
     * gracefully fall back to local rule-based insights.
     */
    async getChemistryInsights(payload: {
        context: 'best_pairs' | 'conflicts' | 'lineup' | 'player_network' | 'pair_profile';
        season?: string;
        payload: Record<string, unknown>;
    }): Promise<any | null> {
        try {
            const response = await firstValueFrom(
                this.httpService.post(`${this.aiBaseUrl}/chemistry/insights`, payload),
            );
            return response.data;
        } catch (error: any) {
            const status = error?.response?.status;
            const detail =
                error?.response?.data?.detail ||
                error?.response?.data?.message ||
                error?.message ||
                'unknown error';

            this.logger.warn(
                `Chemistry insights endpoint unavailable (${status ?? 'n/a'}): ${detail}`,
            );
            return null;
        }
    }

    /**
     * Health check — verify the Python AI service is reachable.
     */
    async healthCheck(): Promise<any> {
        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.aiBaseUrl}/`),
            );
            return {
                ai_service: 'online',
                message: response.data?.message || 'Connected',
            };
        } catch (error) {
            return {
                ai_service: 'offline',
                message: `Cannot reach AI service at ${this.aiBaseUrl}`,
            };
        }
    }

    private handleAiError(error: any, endpoint: string): never {
        const status =
            error.response?.status || HttpStatus.SERVICE_UNAVAILABLE;
        const message =
            error.response?.data?.detail ||
            error.message ||
            `AI service error on /${endpoint}`;

        this.logger.error(
            `AI Service error [${endpoint}]: ${message}`,
            error.stack,
        );

        throw new HttpException(
            {
                error: `AI Service error`,
                endpoint: `/${endpoint}`,
                detail: message,
            },
            status,
        );
    }
}
