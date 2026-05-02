import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import * as mongoose from 'mongoose';
import { Role } from '../common/enums/role.enum';
import { UserStatus } from '../common/enums/user-status.enum';
import { hashValue } from '../common/utils/hash.util';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Player, PlayerSchema } from '../players/schemas/player.schema';
import { Club, ClubSchema } from '../clubs/schemas/club.schema';
import { Test, TestSchema } from '../ai/schemas/test.schema';

async function run() {
  loadEnv();
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/odin_backend';
  await mongoose.connect(mongoUri);
  console.log('--- MASTER SEEDING STARTED ---');

  const userModel = mongoose.model(User.name, UserSchema);
  const clubModel = mongoose.model(Club.name, ClubSchema);
  const playerModel = mongoose.model(Player.name, PlayerSchema);
  const testModel = mongoose.model(Test.name, TestSchema);

  // 0. CLEAR PREVIOUS DATA
  await Promise.all([
    userModel.deleteMany({}),
    clubModel.deleteMany({}),
    playerModel.deleteMany({}),
    testModel.deleteMany({})
  ]);
  console.log('✔ Database cleared');

  const passwordHash = await hashValue('12345678');

  // 1. CREATE ROLES ACCOUNT
  const roles = Object.values(Role);
  const staffUsers = [];
  for (const role of roles) {
    const user = await userModel.create({
      email: `${role.toLowerCase()}@odin.com`,
      passwordHash,
      firstName: 'ODIN',
      lastName: role,
      role: role,
      status: UserStatus.ACTIVE,
      isEmailVerified: true,
      isActive: true,
      isApprovedByAdmin: true
    });
    staffUsers.push(user);
    console.log(`✔ Created User: ${role}`);
  }

  const adminId = staffUsers.find(u => u.role === Role.ADMIN)?._id;

  // 2. CREATE CLUBS
  const realMadrid = await clubModel.create({
    name: 'Real Madrid CF',
    league: 'La Liga',
    country: 'Spain',
    city: 'Madrid',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/5/56/Real_Madrid_CF.svg/1200px-Real_Madrid_CF.svg.png',
    status: 'ACTIVE',
    createdByUserId: adminId
  });

  const manCity = await clubModel.create({
    name: 'Manchester City',
    league: 'Premier League',
    country: 'England',
    city: 'Manchester',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/e/eb/Manchester_City_FC_badge.svg/1200px-Manchester_City_FC_badge.svg.png',
    status: 'ACTIVE',
    createdByUserId: adminId
  });
  console.log('✔ Clubs created (RM, City)');

  // 3. DEFINE PLAYERS (20 per club)
  const rmSquad = [
    { firstName: 'Thibaut', lastName: 'Courtois', position: 'Gardien', val: 30, speed: 65, end: 70, dri: 40, sho: 30, fit: 85, photo: 'https://img.a.transfermarkt.technology/portrait/header/108390-1665471694.jpg' },
    { firstName: 'Dani', lastName: 'Carvajal', position: 'Défenseur', val: 12, speed: 82, end: 90, dri: 75, sho: 60, fit: 88, photo: 'https://img.a.transfermarkt.technology/portrait/header/138927-1665472017.jpg' },
    { firstName: 'Éder', lastName: 'Militão', position: 'Défenseur', val: 60, speed: 85, end: 85, dri: 70, sho: 55, fit: 82, photo: 'https://img.a.transfermarkt.technology/portrait/header/401530-1665472314.jpg' },
    { firstName: 'Antonio', lastName: 'Rüdiger', position: 'Défenseur', val: 25, speed: 88, end: 88, dri: 65, sho: 55, fit: 92, photo: 'https://img.a.transfermarkt.technology/portrait/header/86202-1665472492.jpg' },
    { firstName: 'Ferland', lastName: 'Mendy', position: 'Défenseur', val: 22, speed: 90, end: 92, dri: 78, sho: 50, fit: 85, photo: 'https://img.a.transfermarkt.technology/portrait/header/291417-1665472651.jpg' },
    { firstName: 'Aurélien', lastName: 'Tchouaméni', position: 'Milieu', val: 100, speed: 78, end: 92, dri: 82, sho: 75, fit: 90, photo: 'https://img.a.transfermarkt.technology/portrait/header/354519-1665472851.jpg' },
    { firstName: 'Federico', lastName: 'Valverde', position: 'Milieu', val: 120, speed: 92, end: 98, dri: 85, sho: 85, fit: 95, photo: 'https://img.a.transfermarkt.technology/portrait/header/369081-1665473063.jpg' },
    { firstName: 'Jude', lastName: 'Bellingham', position: 'Milieu', val: 180, speed: 84, end: 95, dri: 92, sho: 88, fit: 93, photo: 'https://img.a.transfermarkt.technology/portrait/header/581678-1665473214.jpg' },
    { firstName: 'Rodrygo', lastName: 'Goes', position: 'Attaquant', val: 110, speed: 93, end: 80, dri: 95, sho: 85, fit: 82, photo: 'https://img.a.transfermarkt.technology/portrait/header/412363-1665473451.jpg' },
    { firstName: 'Kylian', lastName: 'Mbappé', position: 'Attaquant', val: 180, speed: 98, end: 85, dri: 96, sho: 94, fit: 88, photo: 'https://img.a.transfermarkt.technology/portrait/header/342229-1665473631.jpg' },
    { firstName: 'Vinícius', lastName: 'Júnior', position: 'Attaquant', val: 180, speed: 97, end: 88, dri: 98, sho: 84, fit: 86, photo: 'https://img.a.transfermarkt.technology/portrait/header/371998-1665473851.jpg' },
    { firstName: 'Arda', lastName: 'Güler', position: 'Milieu', val: 45, speed: 78, end: 75, dri: 90, sho: 80, fit: 75, photo: 'https://img.a.transfermarkt.technology/portrait/header/844714-1665474012.jpg' },
    { firstName: 'Brahim', lastName: 'Díaz', position: 'Attaquant', val: 40, speed: 86, end: 82, dri: 92, sho: 78, fit: 80, photo: 'https://img.a.transfermarkt.technology/portrait/header/312674-1665474214.jpg' },
    { firstName: 'Eduardo', lastName: 'Camavinga', position: 'Milieu', val: 100, speed: 85, end: 94, dri: 88, sho: 70, fit: 91, photo: 'https://img.a.transfermarkt.technology/portrait/header/640428-1665474415.jpg' },
    { firstName: 'David', lastName: 'Alaba', position: 'Défenseur', val: 20, speed: 78, end: 80, dri: 80, sho: 75, fit: 70, photo: 'https://img.a.transfermarkt.technology/portrait/header/59016-1665474614.jpg' },
    { firstName: 'Lunin', lastName: 'Andriy', position: 'Gardien', val: 25, speed: 60, end: 65, dri: 30, sho: 20, fit: 82, photo: 'https://img.a.transfermarkt.technology/portrait/header/404839-1665474812.jpg' },
    { firstName: 'Fran', lastName: 'García', position: 'Défenseur', val: 15, speed: 92, end: 85, dri: 75, sho: 60, fit: 80, photo: 'https://img.a.transfermarkt.technology/portrait/header/340058-1665475012.jpg' },
    { firstName: 'Lucas', lastName: 'Vázquez', position: 'Défenseur', val: 4, speed: 82, end: 94, dri: 80, sho: 70, fit: 85, photo: 'https://img.a.transfermarkt.technology/portrait/header/221316-1665475214.jpg' },
    { firstName: 'Dani', lastName: 'Ceballos', position: 'Milieu', val: 6, speed: 70, end: 75, dri: 88, sho: 72, fit: 75, photo: 'https://img.a.transfermarkt.technology/portrait/header/319745-1665475412.jpg' },
    { firstName: 'Endrick', lastName: 'Felipe', position: 'Attaquant', val: 60, speed: 94, end: 80, dri: 90, sho: 88, fit: 85, photo: 'https://img.a.transfermarkt.technology/portrait/header/971510-1665475614.jpg' }
  ];

  const mcSquad = [
    { firstName: 'Erling', lastName: 'Haaland', position: 'Attaquant', val: 200, speed: 96, end: 88, dri: 82, sho: 98, fit: 95, photo: 'https://img.a.transfermarkt.technology/portrait/header/418560-1665475812.jpg' },
    { firstName: 'Phil', lastName: 'Foden', position: 'Milieu', val: 150, speed: 88, end: 85, dri: 95, sho: 88, fit: 84, photo: 'https://img.a.transfermarkt.technology/portrait/header/406635-1665476012.jpg' },
    { firstName: 'Kevin', lastName: 'De Bruyne', position: 'Milieu', val: 45, speed: 74, end: 78, dri: 88, sho: 90, fit: 75, photo: 'https://img.a.transfermarkt.technology/portrait/header/88755-1665476214.jpg' },
    { firstName: 'Rodri', lastName: 'Hernández', position: 'Milieu', val: 130, speed: 72, end: 98, dri: 84, sho: 80, fit: 98, photo: 'https://img.a.transfermarkt.technology/portrait/header/357565-1665476412.jpg' },
    { firstName: 'Bernardo', lastName: 'Silva', position: 'Milieu', val: 70, speed: 80, end: 99, dri: 96, sho: 78, fit: 85, photo: 'https://img.a.transfermarkt.technology/portrait/header/241641-1665476612.jpg' },
    { firstName: 'Ruben', lastName: 'Dias', position: 'Défenseur', val: 80, speed: 78, end: 88, dri: 68, sho: 50, fit: 96, photo: 'https://img.a.transfermarkt.technology/portrait/header/258004-1665476812.jpg' },
    { firstName: 'Josko', lastName: 'Gvardiol', position: 'Défenseur', val: 75, speed: 85, end: 88, dri: 82, sho: 65, fit: 90, photo: 'https://img.a.transfermarkt.technology/portrait/header/539744-1665477012.jpg' },
    { firstName: 'Ederson', lastName: 'Moraes', position: 'Gardien', val: 35, speed: 64, end: 60, dri: 80, sho: 60, fit: 85, photo: 'https://img.a.transfermarkt.technology/portrait/header/238223-1665477212.jpg' },
    { firstName: 'Kyle', lastName: 'Walker', position: 'Défenseur', val: 15, speed: 95, end: 92, dri: 78, sho: 60, fit: 94, photo: 'https://img.a.transfermarkt.technology/portrait/header/95424-1665477412.jpg' },
    { firstName: 'Manuel', lastName: 'Akanji', position: 'Défenseur', val: 45, speed: 85, end: 88, dri: 74, sho: 50, fit: 90, photo: 'https://img.a.transfermarkt.technology/portrait/header/284730-1665477612.jpg' },
    { firstName: 'Jeremy', lastName: 'Doku', position: 'Attaquant', val: 65, speed: 97, end: 72, dri: 98, sho: 75, fit: 74, photo: 'https://img.a.transfermarkt.technology/portrait/header/486049-1665477812.jpg' },
    { firstName: 'Jack', lastName: 'Grealish', position: 'Attaquant', val: 55, speed: 82, end: 85, dri: 92, sho: 80, fit: 80, photo: 'https://img.a.transfermarkt.technology/portrait/header/203460-1665478012.jpg' },
    { firstName: 'Savinho', lastName: 'Moreira', position: 'Attaquant', val: 50, speed: 92, end: 78, dri: 94, sho: 78, fit: 75, photo: 'https://img.a.transfermarkt.technology/portrait/header/689885-1665478212.jpg' },
    { firstName: 'John', lastName: 'Stones', position: 'Défenseur', val: 38, speed: 78, end: 82, dri: 84, sho: 55, fit: 80, photo: 'https://img.a.transfermarkt.technology/portrait/header/186590-1665478412.jpg' },
    { firstName: 'Nathan', lastName: 'Ake', position: 'Défenseur', val: 40, speed: 82, end: 88, dri: 75, sho: 65, fit: 88, photo: 'https://img.a.transfermarkt.technology/portrait/header/177476-1665478612.jpg' },
    { firstName: 'Mateo', lastName: 'Kovacic', position: 'Milieu', val: 30, speed: 82, end: 85, dri: 92, sho: 70, fit: 84, photo: 'https://img.a.transfermarkt.technology/portrait/header/131971-1665478812.jpg' },
    { firstName: 'Matheus', lastName: 'Nunes', position: 'Milieu', val: 40, speed: 88, end: 88, dri: 88, sho: 75, fit: 86, photo: 'https://img.a.transfermarkt.technology/portrait/header/606594-1665479012.jpg' },
    { firstName: 'Rico', lastName: 'Lewis', position: 'Défenseur', val: 40, speed: 85, end: 94, dri: 88, sho: 65, fit: 82, photo: 'https://img.a.transfermarkt.technology/portrait/header/701057-1665479212.jpg' },
    { firstName: 'Oscar', lastName: 'Bobb', position: 'Milieu', val: 25, speed: 88, end: 80, dri: 92, sho: 78, fit: 75, photo: 'https://img.a.transfermarkt.technology/portrait/header/539757-1665479412.jpg' },
    { firstName: 'Stefan', lastName: 'Ortega', position: 'Gardien', val: 9, speed: 55, end: 60, dri: 35, sho: 20, fit: 88, photo: 'https://img.a.transfermarkt.technology/portrait/header/63748-1665479612.jpg' }
  ];

  const seedSquad = async (club, squad) => {
    for (const p of squad) {
      const player = await playerModel.create({
        clubId: club._id,
        firstName: p.firstName,
        lastName: p.lastName,
        email: `${p.firstName.toLowerCase()}.${p.lastName.toLowerCase()}@${club.name === 'Manchester City' ? 'city' : 'real'}.com`,
        phone: '000000000',
        photo: p.photo,
        position: p.position,
        height: 180 + Math.floor(Math.random() * 15),
        weight: 70 + Math.floor(Math.random() * 20),
        status: 'active',
        speed: p.speed,
        endurance: p.end,
        distance: Math.floor(Math.random() * 5) + 10,
        dribbles: p.dri,
        shots: p.sho,
        heart_rate: 60 + Math.floor(Math.random() * 20),
        baseFitness: p.fit
      });

      // AI Pred
      const growth = (Math.random() * 15 + 5).toFixed(1);
      const nextVal = Math.floor(p.val * (1 + parseFloat(growth) / 100));
      
      await testModel.create({
        playerId: player._id,
        currentValue: p.val,
        nextSeasonValue: nextVal,
        predictedValue: p.val, // AI calculated current
        confidenceScore: 0.85 + (Math.random() * 0.1),
        keyFactors: ['Performance Physique', 'Âge', 'Demande Marché', 'Stabilité Médicale'],
        explanation: `Analyse de performance ODIN pour ${p.firstName}: Progression de ${growth}% attendue basée sur une endurance de ${p.end}% et une maîtrise technique de ${p.dri}%. Ses statistiques physiques (${p.fit}) confirment un potentiel de valorisation élevé sur le marché européen.`,
        isVerified: true
      });
    }
  };

  await seedSquad(realMadrid, rmSquad);
  console.log('✔ Real Madrid Squad (20) & AI Data created');
  
  await seedSquad(manCity, mcSquad);
  console.log('✔ Man City Squad (20) & AI Data created');

  console.log('--- MASTER SEEDING COMPLETED SUCCESSFULLY ---');
  console.log('Login: admin@odin.com, scout@odin.com, etc.');
  console.log('Password: 12345678');
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
