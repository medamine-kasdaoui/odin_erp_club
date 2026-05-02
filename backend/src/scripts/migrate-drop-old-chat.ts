import mongoose from 'mongoose';

const OLD_CHAT_COLLECTIONS = ['conversations', 'messages'];

async function run() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/odin_backend';
  const confirm = process.env.CONFIRM_DROP_OLD_CHAT;

  if (confirm !== 'YES_DROP_OLD_CHAT') {
    throw new Error(
      'Refusing to drop old chat collections. Set CONFIRM_DROP_OLD_CHAT=YES_DROP_OLD_CHAT to continue.'
    );
  }

  await mongoose.connect(uri);

  try {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not ready');
    }

    for (const collectionName of OLD_CHAT_COLLECTIONS) {
      const exists = await db.listCollections({ name: collectionName }).hasNext();
      if (!exists) {
        console.log(`- ${collectionName}: already absent`);
        continue;
      }

      await db.collection(collectionName).drop();
      console.log(`- ${collectionName}: dropped`);
    }

    console.log('Old chat collections cleanup completed.');
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
