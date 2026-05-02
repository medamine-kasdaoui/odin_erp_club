import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import * as mongoose from 'mongoose';
import { Player, PlayerSchema } from '../players/schemas/player.schema';

const POSITIONS = ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST'];
const FIRST_NAMES = [
  'Alex',
  'Sam',
  'Jordan',
  'Chris',
  'Taylor',
  'Morgan',
  'Riley',
  'Casey',
  'Jamie',
  'Avery',
  'Logan',
  'Parker',
  'Quinn',
  'Reese',
  'Dylan',
  'Noah',
  'Evan',
  'Leo',
  'Mason',
  'Liam',
];
const LAST_NAMES = [
  'Smith',
  'Johnson',
  'Williams',
  'Brown',
  'Jones',
  'Garcia',
  'Miller',
  'Davis',
  'Rodriguez',
  'Martinez',
  'Hernandez',
  'Lopez',
  'Gonzalez',
  'Wilson',
  'Anderson',
  'Thomas',
  'Moore',
  'Martin',
  'Lee',
  'Perez',
];
const NATIONALITIES = [
  'France',
  'Spain',
  'Portugal',
  'Brazil',
  'Argentina',
  'England',
  'Germany',
  'Italy',
  'Belgium',
  'Netherlands',
];
const STRONG_FEET = ['Right', 'Left'];

const SEED_SOURCE = process.env.SEED_PLAYER_SOURCE || 'seed-random-v1';

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals = 1) {
  const value = Math.random() * (max - min) + min;
  const scale = Math.pow(10, decimals);
  return Math.round(value * scale) / scale;
}

function sample<T>(items: T[]): T {
  return items[randomInt(0, items.length - 1)];
}

function buildPlayer(index: number) {
  const firstName = sample(FIRST_NAMES);
  const lastName = sample(LAST_NAMES);
  const name = `${firstName} ${lastName}`;
  const age = randomInt(17, 35);
  const position = sample(POSITIONS);
  const strongFoot = sample(STRONG_FEET);
  const jerseyNumber = randomInt(1, 99);
  const height = randomInt(165, 200);
  const weight = randomInt(60, 95);
  const nationality = sample(NATIONALITIES);
  const injuries = randomInt(0, 3);
  const injuryHistory = randomInt(0, 8);

  return {
    providerName: SEED_SOURCE,
    providerPlayerId: `${SEED_SOURCE}-${String(index).padStart(3, '0')}`,
    name,
    firstName,
    lastName,
    age,
    position,
    strongFoot,
    jerseyNumber,
    height,
    weight,
    nationality,
    speed: randomInt(45, 95),
    endurance: randomInt(45, 95),
    distance: randomFloat(6.0, 13.0, 1),
    dribbles: randomInt(0, 60),
    shots: randomInt(0, 50),
    injuries,
    heart_rate: randomInt(65, 85),
    baseFitness: randomInt(60, 95),
    injuryHistory,
    isInjured: false,
    status: 'active',
  };
}

async function run() {
  loadEnv();

  const mongoUri =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    'mongodb://localhost:27017/odin_backend';
  const count = Number(process.env.SEED_PLAYER_COUNT || 50);

  await mongoose.connect(mongoUri);

  const playerModel = mongoose.model(Player.name, PlayerSchema);

  let upserted = 0;
  let updated = 0;

  for (let i = 1; i <= count; i += 1) {
    const player = buildPlayer(i);
    const now = new Date();

    const result = await playerModel.updateOne(
      {
        providerName: SEED_SOURCE,
        providerPlayerId: player.providerPlayerId,
      },
      {
        $set: {
          ...player,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true },
    );

    if (result.upsertedCount > 0) {
      upserted += result.upsertedCount;
    } else if (result.modifiedCount > 0) {
      updated += result.modifiedCount;
    }
  }

  const total = await playerModel.countDocuments({ providerName: SEED_SOURCE });
  console.log(
    `Seed complete. Source: ${SEED_SOURCE}. Inserted: ${upserted}. Updated: ${updated}. Total: ${total}.`,
  );

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
