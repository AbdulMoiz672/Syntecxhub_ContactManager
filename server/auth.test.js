import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from './auth.js';
import { createApp } from './app.js';
import request from 'supertest';

test('password hashes are salted and verify without storing the password', async () => {
  const password = 'a long test password';
  const first = await hashPassword(password);
  assert.notEqual(first, await hashPassword(password));
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword('wrong', first), false);
});

test('auth validates fields and limits repeated attempts before reaching the database', async () => {
  const app = createApp();
  const invalid = await request(app).post('/api/auth/register').send({ name: ' ', email: 'bad', password: 'short' });
  assert.equal(invalid.status, 400);
  assert.ok(invalid.body.errors.name);
  assert.ok(invalid.body.errors.email);
  assert.ok(invalid.body.errors.password);
  for (let i = 0; i < 29; i++) await request(app).post('/api/auth/login').send({});
  assert.equal((await request(app).post('/api/auth/login').send({})).status, 429);
});
