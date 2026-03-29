import { Module } from '@nestjs/common';
import { EventsModule } from './events/events.module';
import { TestTypesModule } from './test-types/test-types.module';
import { EventPlayersModule } from './event-players/event-players.module';
import { TestResultsModule } from './test-results/test-results.module';
import { ScoringModule } from './scoring/scoring.module';
import { ReportsModule } from './reports/reports.module';
import { ExercisesModule } from './exercises/exercises.module';
import { CognitiveLabModule } from './cognitive-lab/cognitive-lab.module';

@Module({
    imports: [
        EventsModule,
        TestTypesModule,
        EventPlayersModule,
        TestResultsModule,
        ScoringModule,
        ReportsModule,
        ExercisesModule,
        CognitiveLabModule,
    ],
    exports: [
        EventsModule,
        TestTypesModule,
        EventPlayersModule,
        TestResultsModule,
        ScoringModule,
        ReportsModule,
        ExercisesModule,
        CognitiveLabModule,
    ],
})
export class SportsPerformanceModule { }
