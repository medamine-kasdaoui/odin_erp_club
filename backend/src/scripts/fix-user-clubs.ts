import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import * as mongoose from 'mongoose';
import { Club, ClubSchema } from '../clubs/schemas/club.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

async function run() {
  loadEnv();
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/odin_backend';
  await mongoose.connect(mongoUri);
  console.log('--- FIXING USER CLUB ASSIGNMENTS ---');

  const clubModel = mongoose.model(Club.name, ClubSchema);
  const userModel = mongoose.model(User.name, UserSchema);

  const club = await clubModel.findOne({ name: 'Real Madrid CF' }).exec();
  if (!club) {
    console.error('Real Madrid CF not found');
    await mongoose.disconnect();
    return;
  }

  const result = await userModel.updateMany(
    { clubId: { $exists: false } },
    { $set: { clubId: club._id } }
  ).exec();

  console.log(`✔ Updated ${result.modifiedCount} users with clubId: ${club._id} (${club.name})`);
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
