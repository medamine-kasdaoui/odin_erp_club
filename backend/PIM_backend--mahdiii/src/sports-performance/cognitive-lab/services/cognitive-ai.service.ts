import { Injectable } from '@nestjs/common';
import { CreateCognitiveSessionDto } from '../dto/create-cognitive-session.dto';

@Injectable()
export class CognitiveAiService {

    public calculateScores(dto: CreateCognitiveSessionDto) {
        // --- Reaction Score (40%) ---
        let reactionScore = 100;
        if (dto.reaction.avgMs > 400) reactionScore = 30;
        else if (dto.reaction.avgMs > 320) reactionScore = 60;
        else if (dto.reaction.avgMs > 250) reactionScore = 80;

        // --- Focus Score (30%) ---
        let focusScore = 100;
        if (dto.focus.errors > 3) focusScore = 20;
        else if (dto.focus.errors > 1) focusScore = 50;
        else if (dto.focus.errors === 1) focusScore = 80;

        // --- Memory Score (30%) ---
        let memoryScore = 100;
        if (dto.memory.maxLevel < 4) memoryScore = 50;
        else if (dto.memory.maxLevel < 5) memoryScore = 75;
        memoryScore -= (dto.memory.failures * 10);
        if (memoryScore < 0) memoryScore = 0;

        const mentalScore = Math.round((reactionScore * 0.4) + (focusScore * 0.3) + (memoryScore * 0.3));

        // --- Decision Score (optional) ---
        let decisionScore: number | undefined;
        if (dto.decision) {
            const d = dto.decision;
            const accuracy = d.accuracy ?? 0;
            // speed score: 500ms = 100pts, slower = less
            const speedScore = Math.max(0, 100 - Math.round(((d.avgDecisionTime ?? 4000) - 500) / 35));
            decisionScore = Math.round((accuracy * 0.6) + (speedScore * 0.4));
            if (decisionScore < 0) decisionScore = 0;
            if (decisionScore > 100) decisionScore = 100;
        }

        // --- Wellness Score (optional) ---
        let wellnessScore: number | undefined;
        if (dto.wellness) {
            const w = dto.wellness;
            const map = (val: string, map: Record<string, number>) => map[val] ?? 60;

            const sleepQualityScore = map(w.sleepQuality ?? 'Normal', {
                'Very Good': 100, 'Good': 80, 'Normal': 60, 'Poor': 40, 'Very Poor': 20
            });
            const soreScore = map(w.muscleSoreness ?? 'None', {
                'None': 100, 'Light': 80, 'Moderate': 50, 'Heavy': 20
            });
            const stressScore = map(w.stressLevel ?? 'Low', {
                'Low': 100, 'Moderate': 60, 'High': 20
            });
            const energyScore = map(w.energyLevel ?? 'Normal', {
                'High': 100, 'Normal': 60, 'Low': 20
            });
            const moodScore = map(w.mood ?? 'Normal', {
                'Excellent': 100, 'Good': 80, 'Normal': 60, 'Bad': 30
            });
            const motivationScore = map(w.motivation ?? 'Normal', {
                'High': 100, 'Normal': 60, 'Low': 20
            });
            const painScore = w.generalPain != null ? Math.round(100 - (w.generalPain * 10)) : 100;

            wellnessScore = Math.round(
                (sleepQualityScore + soreScore + stressScore + energyScore + moodScore + motivationScore + painScore) / 7
            );
        }

        // --- Training Readiness ---
        let trainingReadiness: string | undefined;
        if (decisionScore != null && wellnessScore != null) {
            if (decisionScore > 80 && wellnessScore > 80) {
                trainingReadiness = 'FULL TRAINING';
            } else if (decisionScore < 50 && wellnessScore < 50) {
                trainingReadiness = 'RECOVERY DAY';
            } else if (decisionScore < 60 || wellnessScore < 60) {
                trainingReadiness = 'LIGHT TRAINING';
            } else {
                trainingReadiness = 'NORMAL TRAINING';
            }
        }

        return { reactionScore, focusScore, memoryScore, mentalScore, decisionScore, wellnessScore, trainingReadiness };
    }

    public generateAiAssessment(currentScores: any, baselineScores?: any, dto?: CreateCognitiveSessionDto) {
        let aiStatus = 'NORMAL';
        let trainingSuggestion = 'Full training allowed.';
        let aiRecommendationText = 'Player cognitive performance stable.';
        let riskLevel = 'LOW';

        const mentalScore = currentScores.mentalScore;

        if (mentalScore >= 90) {
            aiStatus = 'READY';
            aiRecommendationText = 'Elite readiness. Nervous system is perfectly primed.';
        } else if (mentalScore < 40) {
            aiStatus = 'CRITICAL';
            riskLevel = 'CRITICAL';
            trainingSuggestion = 'Recovery only.';
            aiRecommendationText = 'Severe cognitive fatigue. High injury risk. Recommend full rest.';
        } else if (currentScores.reactionScore < 50) {
            aiStatus = 'FATIGUED';
            riskLevel = 'HIGH';
            trainingSuggestion = 'Technical session only. No neuromuscular overload.';
            aiRecommendationText = 'Reaction time is significantly slower than baseline. Suspect nervous fatigue or sleep issues.';
        } else if (currentScores.memoryScore < 40 && currentScores.focusScore < 40) {
            aiStatus = 'OVERLOADED';
            riskLevel = 'MEDIUM';
            trainingSuggestion = 'Reduce intensity 20%. Tactical review.';
            aiRecommendationText = 'Memory and focus metrics dropped. Player is experiencing cognitive overload.';
        } else if (mentalScore < 75) {
            aiStatus = 'FATIGUED';
            riskLevel = 'MEDIUM';
            trainingSuggestion = 'Reduce intensity 10-20%.';
            aiRecommendationText = 'Moderate cognitive fatigue observed. Monitor player load.';
        }

        // Decision-making override
        if (currentScores.decisionScore != null && currentScores.decisionScore < 50) {
            aiRecommendationText += ' Decision speed notably reduced — suspect decision fatigue or cognitive overload.';
            if (riskLevel === 'LOW') riskLevel = 'MEDIUM';
        }

        // Wellness override
        if (currentScores.wellnessScore != null && currentScores.wellnessScore < 50) {
            aiRecommendationText += ' Player wellness indicators are below threshold — active recovery is recommended.';
            if (riskLevel === 'LOW') riskLevel = 'MEDIUM';
        }

        // Training Readiness override on suggestion
        if (currentScores.trainingReadiness) {
            trainingSuggestion = `${currentScores.trainingReadiness}. ${trainingSuggestion}`;
        }

        if (baselineScores && (baselineScores.mentalScore - mentalScore) > 15) {
            aiStatus = 'RECOVERY REQUIRED';
            riskLevel = 'HIGH';
            trainingSuggestion = 'Recovery or Technical session only.';
            aiRecommendationText = `Mental readiness dropped significantly (-${Math.round(baselineScores.mentalScore - mentalScore)} points vs average). Recovery alert.`;
        }

        return { aiStatus, riskLevel, aiRecommendationText, trainingSuggestion };
    }
}
