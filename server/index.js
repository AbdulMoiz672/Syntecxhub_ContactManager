import mongoose from 'mongoose';
import { createApp } from './app.js';
import { Contact } from './contact.js';
import { User, Session } from './auth.js';

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is required. Copy .env.example to .env and configure MongoDB.');
  process.exit(1);
}
try {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  await Contact.init();
  await Promise.all([User.init(), Session.init()]);
  // Replace the legacy global email constraint with per-user uniqueness.
  const indexes = await Contact.collection.indexes();
  if (indexes.some(index => index.name === 'email_1' && index.unique)) await Contact.collection.dropIndex('email_1');
  const server = createApp().listen(process.env.PORT || 4000, () => console.log(`Contact API listening on http://localhost:${process.env.PORT || 4000}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(async () => { await mongoose.disconnect(); process.exit(0); }));
} catch (error) {
  console.error('Unable to start Contact API:', error.message);
  process.exit(1);
}
