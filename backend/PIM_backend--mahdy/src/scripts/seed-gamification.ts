import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { GamificationService } from '../gamification/gamification.service';
import { UsersService } from '../users/users.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const gamificationService = app.get(GamificationService);
  const usersService = app.get(UsersService);

  console.log('--- SEEDING GAMIFICATION POINTS ---');

  try {
    // 1. Récupérer tous les utilisateurs (joueurs)
    const users = await usersService.findAll();

    if (users.length === 0) {
      console.log('Aucun utilisateur trouvé pour le seeding.');
      await app.close();
      return;
    }

    for (const user of users) {
      console.log(`Ajout de points pour: ${user.firstName} ${user.lastName}`);

      // Ajouter une action "Test de performance"
      await gamificationService.addAction({
        userId: user._id.toString(),
        actionType: 'Test Physique',
        points: 150,
        moduleId: 'performance',
        description: 'Excellente performance au test de VMA',
      });

      // Ajouter une action "Discipline"
      await gamificationService.addAction({
        userId: user._id.toString(),
        actionType: 'Discipline',
        points: 50,
        moduleId: 'core',
        description: 'Ponctualité exemplaire ce mois-ci',
      });

      // Ajouter une action "Voyage"
      await gamificationService.addAction({
        userId: user._id.toString(),
        actionType: 'Déplacement complété',
        points: 15,
        moduleId: 'travel',
        description: 'Voyage à Madrid effectué',
      });
    }

    console.log('✅ Seeding terminé avec succès !');
  } catch (error) {
    console.error('❌ Erreur lors du seeding:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
