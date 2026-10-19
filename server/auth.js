import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import mongoose from 'mongoose';
import { Router } from 'express';

const scrypt = promisify(scryptCallback);
const cookieName = 'gather_session';
const lifetime = 7 * 24 * 60 * 60 * 1000;
export const User = mongoose.model('User', new mongoose.Schema({
  name: { type: String, required: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false }
}, { timestamps: true, versionKey: false }));
export const Session = mongoose.model('Session', new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true, expires: 0 }
}));
const publicUser = user => ({ _id: user._id, name: user.name, email: user.email });
const digest = token => createHash('sha256').update(token).digest('hex');
const cookieOptions = () => ({ httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/' });
function tokenFrom(req) {
  const token = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${(await scrypt(password, salt, 64)).toString('hex')}`;
}
export async function verifyPassword(password, encoded) {
  const [salt, hash] = encoded.split(':');
  const actual = await scrypt(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export async function requireUser(req, res, next) {
  const token = tokenFrom(req);
  if (!token) return res.status(401).json({ message: 'Please log in to continue.' });
  const session = await Session.findOne({ tokenHash: digest(token), expiresAt: { $gt: new Date() } }).populate('user');
  if (!session?.user) return res.status(401).json({ message: 'Your session has expired. Please log in again.' });
  req.user = publicUser(session.user);
  next();
}
async function startSession(req, res, user) {
  const previous = tokenFrom(req);
  const token = randomBytes(32).toString('hex');
  await Session.create({ tokenHash: digest(token), user: user._id, expiresAt: new Date(Date.now() + lifetime) });
  if (previous) await Session.deleteOne({ tokenHash: digest(previous) });
  res.cookie(cookieName, token, { ...cookieOptions(), maxAge: lifetime });
}
export function authRouter() {
  const router = Router();
  // Bound memory and limit password hashing attempts per client in a 15-minute window.
  const attempts = new Map();
  const limit = (req, res, next) => {
    const now = Date.now();
    for (const [key, entry] of attempts) if (entry.until < now) attempts.delete(key);
    const key = req.ip;
    const entry = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
    if (entry.count >= 30 || (attempts.size >= 10000 && !attempts.has(key))) return res.status(429).json({ message: 'Too many attempts. Please try again in 15 minutes.' });
    entry.count++;
    attempts.set(key, entry);
    next();
  };
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.post(['/login', '/register'], limit, async (req, res) => {
    const registering = req.path === '/register';
    const body = req.body || {};
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const errors = {};
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.';
    if (password.length > 128 || password.length < (registering ? 12 : 1)) errors.password = registering ? 'Use a password between 12 and 128 characters.' : 'Enter your password (up to 128 characters).';
    if (registering && (!name || name.length > 80)) errors.name = 'Enter your name (up to 80 characters).';
    if (Object.keys(errors).length) return res.status(400).json({ message: 'Please check your details.', errors });
    let user;
    if (registering) {
      try { user = await User.create({ name, email, passwordHash: await hashPassword(password) }); }
      catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: 'An account with this email already exists. Please log in.' });
        throw error;
      }
    } else {
      user = await User.findOne({ email }).select('+passwordHash');
      // Do equivalent hashing work even for an unknown email.
      const encoded = user?.passwordHash || `00000000000000000000000000000000:${'00'.repeat(64)}`;
      const valid = await verifyPassword(password, encoded);
      if (!user || !valid) return res.status(401).json({ message: 'Email or password is incorrect.' });
    }
    await startSession(req, res, user);
    res.status(registering ? 201 : 200).json({ user: publicUser(user) });
  });
  router.get('/me', requireUser, (req, res) => res.json({ user: req.user }));
  router.post('/logout', async (req, res) => {
    const token = tokenFrom(req);
    if (token) await Session.deleteOne({ tokenHash: digest(token) });
    res.clearCookie(cookieName, cookieOptions());
    res.status(204).end();
  });
  return router;
}
