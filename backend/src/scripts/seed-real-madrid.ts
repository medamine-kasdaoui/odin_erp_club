import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import * as mongoose from 'mongoose';
import { Types } from 'mongoose';
import { Player, PlayerSchema } from '../players/schemas/player.schema';
import { Test, TestSchema } from '../ai/schemas/test.schema';

async function run() {
  loadEnv();
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/odin_backend';
  
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);

  const playerModel = mongoose.model(Player.name, PlayerSchema);
  const testModel = mongoose.model(Test.name, TestSchema);

  // Clear existing data for a fresh start with the XI
  console.log('Clearing existing players and valuations...');
  await playerModel.deleteMany({});
  await testModel.deleteMany({});

  const realMadridPlayers = [
    {
      firstName: 'Thibaut',
      lastName: 'Courtois',
      position: 'GK',
      age: 32,
      photo: 'https://img.a.transfermarkt.technology/portrait/header/108390-1665067964.jpg',
      currentValue: 30000000,
      predictedValue: 28000000,
      nextSeasonValue: 25000000,
      confidenceScore: 0.95,
      explanation: 'Le meilleur gardien au monde, mais sa valeur décroît légèrement en raison de son âge et de son récent retour de blessure.',
      keyFactors: ['Mur infranchissable', 'Expérience', 'Envergure'],
      stats: { speed: 50, endurance: 60, heart_rate: 45, shots: 10, dribbles: 20 }
    },
    {
      firstName: 'Dani',
      lastName: 'Carvajal',
      position: 'RB',
      age: 32,
      photo: 'https://img.a.transfermarkt.technology/portrait/header/138927-1665067756.jpg',
      currentValue: 12000000,
      predictedValue: 12000000,
      nextSeasonValue: 10000000,
      confidenceScore: 0.90,
      explanation: 'Pilier défensif et leader. Valeur stable malgré l\'âge grâce à ses performances en grands matchs.',
      keyFactors: ['Grinta', 'Leadership', 'Tactique'],
      stats: { speed: 80, endurance: 88, heart_rate: 68, shots: 55, dribbles: 72 }
    },
    {
      firstName: 'Éder',
      lastName: 'Militão',
      position: 'CB',
      age: 26,
      photo: 'https://img.a.transfermarkt.technology/portrait/header/401530-1665068427.jpg',
      currentValue: 60000000,
      predictedValue: 65000000,
      nextSeasonValue: 70000000,
      confidenceScore: 0.88,
      explanation: 'Retour en force après blessure. Un des meilleurs défenseurs centraux au monde.',
      keyFactors: ['Athlétique', 'Vitesse', 'Anticipation'],
      stats: { speed: 88, endurance: 85, heart_rate: 62, shots: 40, dribbles: 60 }
    },
    {
      firstName: 'Antonio',
      lastName: 'Rüdiger',
      position: 'CB',
      age: 31,
      photo: 'https://img.a.transfermarkt.technology/portrait/header/86202-1665068133.jpg',
      currentValue: 25000000,
      predictedValue: 25000000,
      nextSeasonValue: 22000000,
      confidenceScore: 0.96,
      explanation: 'Le "fou" de la défense. Impact physique et psychologique immense.',
      keyFactors: ['Agressivité positive', 'Force physique', 'Vitesse'],
      stats: { speed: 91, endurance: 82, heart_rate: 60, shots: 50, dribbles: 55 }
    },
    {
      firstName: 'Ferland',
      lastName: 'Mendy',
      position: 'LB',
      age: 29,
      photo: 'https://img.a.transfermarkt.technology/portrait/header/291417-1665068532.jpg',
      currentValue: 22000000,
      predictedValue: 22000000,
      nextSeasonValue: 20000000,
      confidenceScore: 0.85,
      explanation: 'Indispensable défensivement. Robustesse physique unique sur son côté.',
      keyFactors: ['Solide défensivement', 'Puissance', 'Fiabilité'],
      stats: { speed: 89, endurance: 90, heart_rate: 58, shots: 45, dribbles: 78 }
    },
    {
      firstName: 'Aurélien',
      lastName: 'Tchouaméni',
      position: 'DM',
      age: 24,
      photo: 'https://img.a.transfermarkt.technology/portrait/header/350365-1665068612.jpg',
      currentValue: 100000000,
      predictedValue: 100000000,
      nextSeasonValue: 110000000,
      confidenceScore: 0.91,
      explanation: 'Le futur du milieu madrilène. Interception et relance de classe mondiale.',
      keyFactors: ['Lecture de jeu', 'Interceptions', 'Précision'],
      stats: { speed: 78, endurance: 94, heart_rate: 60, shots: 70, dribbles: 75 }
    },
    {
      firstName: 'Federico',
      lastName: 'Valverde',
      position: 'CM',
      age: 26,
      photo: 'https://img.a.transfermarkt.technology/portrait/header/369081-1689665851.jpg',
      currentValue: 120000000,
      predictedValue: 125000000,
      nextSeasonValue: 135000000,
      confidenceScore: 0.94,
      explanation: 'Infatigable, il est le coeur battant de l\'équipe. Capacités physiques hors normes.',
      keyFactors: ['Volume de jeu immense', 'Frappe lointaine', 'Vitesse'],
      stats: { speed: 91, endurance: 98, heart_rate: 55, shots: 88, dribbles: 82 }
    },
    {
      firstName: 'Jude',
      lastName: 'Bellingham',
      position: 'AM',
      age: 21,
      photo: 'https://img.a.transfermarkt.technology/portrait/header/624698-1689665809.jpg',
      currentValue: 180000000,
      predictedValue: 190000000,
      nextSeasonValue: 220000000,
      confidenceScore: 0.96,
      explanation: 'Phénomène total. Décisif, leader et encore très jeune. Futur Ballon d\'Or.',
      keyFactors: ['Génie créatif', 'Efficacité', 'Âge d\'or'],
      stats: { speed: 82, endurance: 92, heart_rate: 65, shots: 85, dribbles: 90 }
    },
    {
      firstName: 'Rodrygo',
      lastName: 'Goes',
      position: 'RW',
      age: 23,
      photo: 'https://img.a.transfermarkt.technology/portrait/header/412363-1665042407.jpg',
      currentValue: 110000000,
      predictedValue: 115000000,
      nextSeasonValue: 125000000,
      confidenceScore: 0.92,
      explanation: 'Talent pur sur l\'aile. Capacité à briller dans les moments critiques.',
      keyFactors: ['Technique soyeuse', 'Clutch', 'Adaptabilité'],
      stats: { speed: 88, endurance: 85, heart_rate: 68, shots: 84, dribbles: 92 }
    },
    {
      firstName: 'Kylian',
      lastName: 'Mbappé',
      position: 'ST',
      age: 25,
      photo: 'https://img.a.transfermarkt.technology/portrait/header/342229-1682683067.jpg',
      currentValue: 180000000,
      predictedValue: 180000000,
      nextSeasonValue: 200000000,
      confidenceScore: 0.98,
      explanation: 'Meilleur joueur du monde individuellement. Impact marketing et sportif total.',
      keyFactors: ['Vitesse supersonique', 'Finition', 'Génie'],
      stats: { speed: 98, endurance: 85, heart_rate: 62, shots: 95, dribbles: 93 }
    },
    {
      firstName: 'Vinícius',
      lastName: 'Júnior',
      position: 'LW',
      age: 24,
      photo: 'https://img.a.transfermarkt.technology/portrait/header/371998-1665042457.jpg',
      currentValue: 180000000,
      predictedValue: 180000000,
      nextSeasonValue: 195000000,
      confidenceScore: 0.97,
      explanation: 'Dribbleur le plus déstabilisant du monde. Favori pour les titres individuels.',
      keyFactors: ['Dribbles explosifs', 'Inarrêtable', 'Créativité'],
      stats: { speed: 97, endurance: 88, heart_rate: 72, shots: 88, dribbles: 98 }
    }
  ];

  console.log(`Seeding ${realMadridPlayers.length} Real Madrid players...`);
  
  for (const data of realMadridPlayers) {
    const { currentValue, predictedValue, nextSeasonValue, confidenceScore, explanation, keyFactors, stats, ...playerInfo } = data;
    
    // 1. Create or Update Player
    const player = await playerModel.findOneAndUpdate(
      { firstName: playerInfo.firstName, lastName: playerInfo.lastName },
      { 
        ...playerInfo,
        ...stats,
        status: 'active'
      },
      { upsert: true, new: true }
    );

    // 2. Create AI Prediction Result
    await testModel.findOneAndUpdate(
      { playerId: player._id },
      {
        playerId: player._id,
        currentValue: currentValue,
        predictedValue: predictedValue,
        nextSeasonValue: nextSeasonValue,
        confidenceScore: confidenceScore,
        explanation: explanation,
        keyFactors: keyFactors,
        metadata: { club: 'Real Madrid', scenario: 'baseline_2024' }
      },
      { upsert: true }
    );
    
    console.log(`✓ Seeded ${player.firstName} ${player.lastName}`);
  }

  console.log('Seed complete!');
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error('Seed failed:', error);
  await mongoose.disconnect();
  process.exit(1);
});
