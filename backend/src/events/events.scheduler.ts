import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventsService } from './events.service';

@Injectable()
export class EventsScheduler {
    private readonly logger = new Logger(EventsScheduler.name);

    constructor(private readonly eventsService: EventsService) {}

    /**
     * Tourne toutes les heures.
     * Vérifie les événements du lendemain (rappel J-1)
     * et ceux dans les 2 prochaines heures (rappel 2h avant).
     */
    @Cron(CronExpression.EVERY_HOUR)
    async handleReminders() {
        this.logger.log('⏰ Cron — vérification des rappels événements...');
        try {
            await this.eventsService.sendPendingReminders();
        } catch (err) {
            this.logger.error('Erreur cron rappels:', err.message);
        }
    }
}
