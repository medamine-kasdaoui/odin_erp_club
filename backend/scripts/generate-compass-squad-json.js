const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('seed_real_players.js', 'utf8');
const match = source.match(/const players = (\[[\s\S]*?\n\]);/);

if (!match) {
  throw new Error('Unable to find players array in seed_real_players.js');
}

const players = vm.runInNewContext(match[1]);

const ids = [
  '69c713cac739d6d8686246af',
  '69c713cac739d6d8686246b0',
  '69c713cac739d6d8686246b1',
  '69c713cac739d6d8686246b2',
  '69c713cac739d6d8686246b3',
  '69c713cac739d6d8686246b4',
  '69c713cac739d6d8686246b5',
  '69c713cac739d6d8686246b6',
  '69c713cac739d6d8686246b7',
  '69c713cac739d6d8686246b8',
  '69c713cac739d6d8686246b9',
  '69c713cac739d6d8686246ba',
  '69c713cac739d6d8686246bb',
  '69c713cac739d6d8686246bc',
  '69c713cac739d6d8686246bd',
  '69c713cac739d6d8686246be',
  '69c713cac739d6d8686246bf',
  '69c713cac739d6d8686246c0',
  '69c713cac739d6d8686246c1',
  '69c713cac739d6d8686246c2',
  '69c713cac739d6d8686246c3',
  '69c713cac739d6d8686246c4',
  '69c713cac739d6d8686246c5',
  '69c713cac739d6d8686246c6',
];

const oid = (value) => ({ $oid: value });
const date = (value) => ({ $date: value });
const now = '2026-05-11T00:00:00.000Z';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value.toFixed(2))));
}

function bucket(position = '') {
  const upper = position.toUpperCase();
  if (upper.includes('GK')) return 'GK';
  if (['CB', 'LB', 'RB', 'LWB', 'RWB'].some((token) => upper.includes(token))) return 'DEF';
  if (['CDM', 'CM', 'CAM', 'DM', 'AM', 'LM', 'RM'].some((token) => upper.includes(token))) return 'MID';
  if (['LW', 'RW', 'ST', 'CF', 'FW'].some((token) => upper.includes(token))) return 'ATT';
  return 'OTHER';
}

function corridor(position = '') {
  const upper = position.toUpperCase();
  if (upper.includes('L')) return 'LEFT';
  if (upper.includes('R')) return 'RIGHT';
  return 'CENTER';
}

function buildStyleProfile(player) {
  const role = bucket(player.position);
  const speed = Number(player.speed || 0);
  const dribbles = Number(player.dribbles || 0);
  const shots = Number(player.shots || 0);
  const foot = (player.strongFoot || '').toLowerCase();

  const base = {
    possessionPlay: 5.5,
    selfishness: 4.8,
    oneTouchPreference: 5.5,
    directPlay: 5.4,
    riskTaking: 5.1,
    pressingIntensity: 5.6,
    offBallMovement: 5.7,
    communication: 5.9,
    defensiveDiscipline: 5.7,
    creativity: 5.1,
  };

  if (role === 'GK') {
    Object.assign(base, {
      possessionPlay: 5.2,
      selfishness: 2.5,
      oneTouchPreference: 6.3,
      directPlay: 6.1,
      riskTaking: 4.2,
      pressingIntensity: 2.5,
      offBallMovement: 2.1,
      communication: 8.2,
      defensiveDiscipline: 8.8,
      creativity: 3.6,
    });
  } else if (role === 'DEF') {
    Object.assign(base, {
      possessionPlay: 5.8,
      selfishness: 3.8,
      oneTouchPreference: 6.2,
      directPlay: 5.3,
      riskTaking: 4.9,
      pressingIntensity: 6.5,
      offBallMovement: 5.1,
      communication: 6.9,
      defensiveDiscipline: 8.4,
      creativity: corridor(player.position) === 'CENTER' ? 4.2 : 5.6,
    });
  } else if (role === 'MID') {
    Object.assign(base, {
      possessionPlay: 7.3,
      selfishness: 4.4,
      oneTouchPreference: 7.1,
      directPlay: 6.4,
      riskTaking: 6.1,
      pressingIntensity: 7.1,
      offBallMovement: 6.8,
      communication: 7.4,
      defensiveDiscipline: player.position?.toUpperCase().includes('CDM') ? 8.1 : 6.3,
      creativity: player.position?.toUpperCase().includes('CAM') ? 8.4 : 7.1,
    });
  } else if (role === 'ATT') {
    Object.assign(base, {
      possessionPlay: 6.4,
      selfishness: 5.9,
      oneTouchPreference: 6.3,
      directPlay: 7.8,
      riskTaking: 7.2,
      pressingIntensity: 6.2,
      offBallMovement: 8.2,
      communication: 6.2,
      defensiveDiscipline: 4.2,
      creativity: corridor(player.position) === 'CENTER' ? 6.5 : 8.5,
    });
  }

  base.directPlay = clamp(base.directPlay + (speed - 75) / 25, 0, 10);
  base.creativity = clamp(base.creativity + (dribbles - 20) / 20, 0, 10);
  base.selfishness = clamp(base.selfishness + (shots - 15) / 25, 0, 10);
  base.oneTouchPreference = clamp(base.oneTouchPreference + (foot === 'left' ? 0.2 : 0), 0, 10);

  return Object.fromEntries(
    Object.entries(base).map(([key, value]) => [key, clamp(value, 0, 10)])
  );
}

const playersForCompass = players.map((player, index) => ({
  _id: oid(ids[index]),
  ...player,
  providerName: 'manual-real-seed-v1',
  status: 'active',
  injuryHistory: 0,
  isInjured: false,
  label: 1,
  createdAt: date(now),
  updatedAt: date(now),
}));

const squad = {
  season: '2026-2027',
  label: 'Squad principal seed',
  playerIds: ids.map(oid),
  starterIds: [
    '69c713cac739d6d8686246af',
    '69c713cac739d6d8686246b2',
    '69c713cac739d6d8686246b3',
    '69c713cac739d6d8686246b4',
    '69c713cac739d6d8686246b7',
    '69c713cac739d6d8686246b9',
    '69c713cac739d6d8686246ba',
    '69c713cac739d6d8686246bb',
    '69c713cac739d6d8686246c3',
    '69c713cac739d6d8686246c0',
    '69c713cac739d6d8686246c1',
  ].map(oid),
  benchIds: [
    '69c713cac739d6d8686246b1',
    '69c713cac739d6d8686246b5',
    '69c713cac739d6d8686246b8',
    '69c713cac739d6d8686246be',
    '69c713cac739d6d8686246bc',
    '69c713cac739d6d8686246bd',
    '69c713cac739d6d8686246c2',
    '69c713cac739d6d8686246c5',
  ].map(oid),
  reserveIds: [
    '69c713cac739d6d8686246b0',
    '69c713cac739d6d8686246b6',
    '69c713cac739d6d8686246bf',
    '69c713cac739d6d8686246c4',
    '69c713cac739d6d8686246c6',
  ].map(oid),
  targetSquadSize: 24,
  createdAt: date(now),
  updatedAt: date(now),
};

const playerStyleProfiles = playersForCompass.map((player) => ({
  season: '2026-2027',
  playerId: player._id,
  ...buildStyleProfile(player),
  preferredStyles: [bucket(player.position), corridor(player.position)],
  notes: `Manual Compass profile for ${player.name}.`,
  updatedBy: 'manual-compass-seed',
  createdAt: date(now),
  updatedAt: date(now),
}));

fs.writeFileSync('mongo_compass_players.json', JSON.stringify(playersForCompass, null, 2));
fs.writeFileSync('mongo_compass_squad.json', JSON.stringify(squad, null, 2));
fs.writeFileSync('mongo_compass_player_style_profiles.json', JSON.stringify(playerStyleProfiles, null, 2));
fs.writeFileSync(
  'mongo_compass_full_payload.json',
  JSON.stringify({ players: playersForCompass, squad, playerStyleProfiles }, null, 2)
);

console.log('Generated Compass JSON files.');
