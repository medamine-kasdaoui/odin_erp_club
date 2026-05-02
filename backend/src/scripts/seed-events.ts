import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import * as mongoose from 'mongoose';
import { ErpEvent, ErpEventSchema, EventType, EventStatus, EventVisibility } from '../events/schemas/event.schema';
import { Club, ClubSchema } from '../clubs/schemas/club.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

async function run() {
  loadEnv();
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/odin_backend';
  await mongoose.connect(mongoUri);
  console.log('--- EVENT SEEDING STARTED ---');

  const eventModel = mongoose.model(ErpEvent.name, ErpEventSchema);
  const clubModel = mongoose.model(Club.name, ClubSchema);
  const userModel = mongoose.model(User.name, UserSchema);

  // 1. Find a club and a coach
  const club = await clubModel.findOne().exec();
  const coach = await userModel.findOne({ role: 'STAFF_TECHNIQUE' }).exec();

  if (!club || !coach) {
    console.error('Error: You must run "npm run seed" (seed-complete-system.ts) first to create a club and a coach.');
    await mongoose.disconnect();
    return;
  }

  console.log(`Seeding events for club: ${club.name} and coach: ${coach.lastName}`);

  // 2. Clear existing events for this club (optional, but cleaner for testing)
  await eventModel.deleteMany({ clubId: club._id }).exec();

  const now = new DateTimeHelper();

  const eventData = [
    {
      title: 'Match Amical vs FC Paris',
      description: 'Dernier match de préparation avant la saison régulière.',
      eventType: EventType.MATCH,
      startDate: now.addDays(1, 20), // Tomorrow at 8 PM
      endDate: now.addDays(1, 22),
      location: 'Stade Municipal',
      opponent: 'FC Paris',
      isAway: false,
    },
    {
      title: 'Entraînement Tactique',
      description: 'Mise en place du 4-3-3 et exercices de transition.',
      eventType: EventType.TRAINING,
      startDate: now.addDays(2, 10),
      endDate: now.addDays(2, 12),
      location: 'Terrain 1 (Synthétique)',
    },
    {
      title: 'Réunion Staff Technique',
      description: 'Analyse vidéo du dernier match et planification de la semaine.',
      eventType: EventType.MEETING,
      startDate: now.addDays(3, 9),
      endDate: now.addDays(3, 10),
      location: 'Salle de réunion 2',
    },
    {
      title: 'Test Physique Trimestriel',
      description: 'VMA, accélération et détente verticale.',
      eventType: EventType.PHYSICAL_TEST,
      startDate: now.addDays(4, 14),
      endDate: now.addDays(4, 17),
      location: 'Piste d athlétisme',
    },
    {
      title: 'Match de Championnat J1',
      description: 'Premier match officiel de la saison !',
      eventType: EventType.MATCH,
      startDate: now.addDays(6, 15),
      endDate: now.addDays(6, 17),
      location: 'Stade de l Aube',
      opponent: 'ES Troyes',
      isAway: true,
    },
    {
      title: 'Scouting : Jeunes Talents U17',
      description: 'Observation de 3 joueurs ciblés lors du tournoi régional.',
      eventType: EventType.DETECTION,
      startDate: now.addDays(8, 9),
      endDate: now.addDays(8, 18),
      location: 'Stade Jean Bouin',
    },
    {
      title: 'Entraînement Récupération',
      description: 'Séance légère, étirements et balnéo.',
      eventType: EventType.TRAINING,
      startDate: now.addDays(7, 10),
      endDate: now.addDays(7, 11),
      location: 'Centre de Performance',
    },
    {
      title: 'Séance Spécifique Gardiens',
      description: 'Travail sur les sorties aériennes et le jeu au pied.',
      eventType: EventType.TRAINING,
      startDate: now.addDays(9, 14),
      endDate: now.addDays(9, 16),
      location: 'Terrain 2',
    },
    {
      title: 'Réunion Parents-Joueurs',
      description: 'Présentation des objectifs de la saison et charte du club.',
      eventType: EventType.MEETING,
      startDate: now.addDays(10, 18),
      endDate: now.addDays(10, 20),
      location: 'Auditorium',
    }
  ];

  for (const data of eventData) {
    await eventModel.create({
      ...data,
      clubId: club._id,
      createdBy: coach._id,
      status: EventStatus.SCHEDULED,
      visibility: EventVisibility.CLUB,
    });
    console.log(`✔ Created: ${data.title} (${data.eventType})`);
  }

  console.log('--- EVENT SEEDING COMPLETED SUCCESSFULLY ---');
  await mongoose.disconnect();
}

class DateTimeHelper {
  addDays(days: number, hour: number): Date {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    return d;
  }
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
