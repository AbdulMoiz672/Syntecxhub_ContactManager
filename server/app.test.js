import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from './app.js';

const authenticate = (req, _res, next) => { req.user = { _id: '507f1f77bcf86cd799439012' }; next(); };
const id = '507f1f77bcf86cd799439011';
const sample = { firstName: ' Ada ', lastName: 'Lovelace', email: 'ADA@example.com', group: 'Work' };
test('contact lifecycle validates, creates, reads, updates and deletes', async () => {
  const records = new Map();
  const model = {
    find: () => ({ sort: async () => [...records.values()] }),
    findOne: async ({ _id: key }) => records.get(key),
    create: async value => { const contact = { ...value, _id: id }; records.set(id, contact); return contact; },
    findOneAndUpdate: async ({ _id: key }, value) => { if (!records.has(key)) return null; const contact = { ...value, _id: key }; records.set(key, contact); return contact; },
    findOneAndDelete: async ({ _id: key }) => { const contact = records.get(key); records.delete(key); return contact; }
  };
  const app = createApp(model, authenticate);
  const invalid = await request(app).post('/api/contacts').send({ firstName: '', email: 'bad', group: 'Bad' });
  assert.equal(invalid.status, 400);
  assert.ok(invalid.body.errors.email);
  const created = await request(app).post('/api/contacts').send(sample);
  assert.equal(created.status, 201);
  assert.equal(created.body.contact.firstName, 'Ada');
  assert.equal(created.body.contact.email, 'ada@example.com');
  assert.equal((await request(app).get('/api/contacts')).body.contacts.length, 1);
  assert.equal((await request(app).get(`/api/contacts/${id}`)).status, 200);
  const updated = await request(app).put(`/api/contacts/${id}`).send({ ...sample, firstName: 'Grace' });
  assert.equal(updated.body.contact.firstName, 'Grace');
  assert.equal((await request(app).delete(`/api/contacts/${id}`)).status, 204);
  assert.equal((await request(app).get(`/api/contacts/${id}`)).status, 404);
  assert.equal((await request(app).put(`/api/contacts/${id}`).send(sample)).status, 404);
  assert.equal((await request(app).get('/api/contacts/bad')).status, 400);
});

test('API handles duplicate emails, malformed JSON and missing endpoints', async () => {
  const app = createApp({ create: async () => { throw Object.assign(new Error('duplicate'), { code: 11000 }); } }, authenticate);
  assert.equal((await request(app).post('/api/contacts').send(sample)).status, 409);
  assert.equal((await request(app).post('/api/contacts').set('Content-Type', 'application/json').send('{')).status, 400);
  assert.equal((await request(app).get('/missing')).status, 404);
});

test('anonymous contact access is denied and cross-site mutations rejected', async () => {
  const app = createApp();
  assert.equal((await request(app).get('/api/contacts')).status, 401);
  assert.equal((await request(app).post('/api/contacts').send(sample)).status, 401);
  assert.equal((await request(app).post('/api/auth/register').set('Origin', 'https://example.org').send({})).status, 403);
  assert.equal((await request(app).get('/api/auth/me')).status, 401);
});
