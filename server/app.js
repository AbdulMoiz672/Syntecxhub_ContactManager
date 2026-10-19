import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { Contact, validateContact } from './contact.js';
import { authRouter, requireUser } from './auth.js';

export function createApp(Model = Contact, authenticate = requireUser) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5175', credentials: true }));
  app.use(express.json({ limit: '32kb' }));
  app.use('/api', (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.headers.origin;
      const allowed = process.env.CLIENT_ORIGIN || 'http://localhost:5175';
      if ((origin && origin !== allowed) || req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).json({ message: 'Request origin is not allowed.' });
    }
    next();
  });
  app.use('/api/auth', authRouter());
  app.use('/api/contacts', authenticate, (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.get('/api/health', (_req, res) => res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({ status: mongoose.connection.readyState === 1 ? 'ready' : 'database unavailable' }));
  app.param('id', (req, res, next, id) => {
    if (!/^[a-f\d]{24}$/i.test(id)) return res.status(400).json({ message: 'Invalid contact ID.' });
    next();
  });
  app.get('/api/contacts', async (req, res) => res.json({ contacts: await Model.find({ owner: req.user._id }).sort({ firstName: 1, lastName: 1 }) }));
  app.get('/api/contacts/:id', async (req, res) => {
    const contact = await Model.findOne({ _id: req.params.id, owner: req.user._id });
    if (!contact) return res.status(404).json({ message: 'Contact not found.' });
    res.json({ contact });
  });
  const save = async (req, res) => {
    const { errors, value } = validateContact(req.body);
    if (Object.keys(errors).length) return res.status(400).json({ message: 'Please check the contact details.', errors });
    const contact = req.params.id
      ? await Model.findOneAndUpdate({ _id: req.params.id, owner: req.user._id }, value, { new: true, runValidators: true })
      : await Model.create({ ...value, owner: req.user._id });
    if (!contact) return res.status(404).json({ message: 'Contact not found.' });
    res.status(req.params.id ? 200 : 201).json({ contact });
  };
  app.post('/api/contacts', save);
  app.put('/api/contacts/:id', save);
  app.delete('/api/contacts/:id', async (req, res) => {
    const contact = await Model.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!contact) return res.status(404).json({ message: 'Contact not found.' });
    res.status(204).end();
  });
  app.use((_req, res) => res.status(404).json({ message: 'Endpoint not found.' }));
  app.use((error, _req, res, _next) => {
    if (error.code === 11000) return res.status(409).json({ message: 'A contact with this email already exists.', errors: { email: 'This email is already in your contacts.' } });
    if (error.type === 'entity.parse.failed') return res.status(400).json({ message: 'Request body must be valid JSON.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ message: 'Contact data is too large.' });
    if (error.name === 'ValidationError') return res.status(400).json({ message: 'Invalid contact details.' });
    console.error('Contact API error:', error.message);
    res.status(500).json({ message: 'Unable to complete the request. Please try again.' });
  });
  return app;
}
