import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import * as mongoose from 'mongoose';
import { Role } from '../common/enums/role.enum';
import { UserStatus } from '../common/enums/user-status.enum';
import { hashValue } from '../common/utils/hash.util';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Club, ClubSchema } from '../clubs/schemas/club.schema';

async function run() {
  loadEnv();

  const email = (process.env.COACH_EMAIL || '').toLowerCase().trim();
  const password = process.env.COACH_PASSWORD || '';
  const firstName = process.env.COACH_FIRST_NAME || 'Coach';
  const lastName = process.env.COACH_LAST_NAME || 'Staff';
  const phone = process.env.COACH_PHONE || '0000000000';
  const jobTitle = process.env.COACH_JOB_TITLE || 'Coach';
  const clubName = (process.env.SEED_CLUB_NAME || 'realmadrid').trim();
  const explicitClubId = process.env.COACH_CLUB_ID || '';

  if (!email || !password) {
    throw new Error('COACH_EMAIL and COACH_PASSWORD are required');
  }

  const mongoUri =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    'mongodb://localhost:27017/odin_backend';

  await mongoose.connect(mongoUri);

  const userModel = mongoose.model(User.name, UserSchema);
  const clubModel = mongoose.model(Club.name, ClubSchema);

  let clubId = explicitClubId;
  if (!clubId) {
    const club = await clubModel.findOne({
      name: new RegExp(`^${clubName}$`, 'i'),
    });
    if (!club) {
      const fallback = await clubModel.findOne({ status: 'ACTIVE' });
      if (!fallback) {
        throw new Error('No ACTIVE club found to attach the coach account');
      }
      clubId = String(fallback._id);
    } else {
      clubId = String(club._id);
    }
  }

  const passwordHash = await hashValue(password);

  const existing = await userModel.findOne({ email });
  if (existing) {
    existing.clubId = new mongoose.Types.ObjectId(clubId);
    existing.firstName = firstName;
    existing.lastName = lastName;
    existing.phone = phone;
    existing.role = Role.STAFF_TECHNIQUE;
    existing.status = UserStatus.ACTIVE;
    existing.jobTitle = jobTitle;
    existing.isEmailVerified = true;
    existing.isActive = true;
    existing.isApprovedByAdmin = true;
    existing.passwordHash = passwordHash;
    await existing.save();
    console.log(`Updated coach user: ${email}`);
  } else {
    await userModel.create({
      clubId: new mongoose.Types.ObjectId(clubId),
      email,
      passwordHash,
      firstName,
      lastName,
      phone,
      role: Role.STAFF_TECHNIQUE,
      status: UserStatus.ACTIVE,
      jobTitle,
      isEmailVerified: true,
      isActive: true,
      isApprovedByAdmin: true,
    });
    console.log(`Created coach user: ${email}`);
  }

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
