import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import auth from './routes/auth.js';
import store from './routes/store.js';
import categories from './routes/categories.js';
import products from './routes/products.js';
import orders from './routes/orders.js';
import chat from './routes/chat.js';
import images from './routes/images.js';
import summary from './routes/summary.js';
import events from './realtime.js';
import notifications from './notifications.js';
import push from './push.js';
import { warmUp } from './db.js';

const app = express();
app.set('trust proxy', 1);   // para tama ang IP kapag naka-host na
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true }));
app.use(express.json({ limit: '3mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', auth);
app.use('/api/store', store);
app.use('/api/categories', categories);
app.use('/api/products', products);
app.use('/api/events', events);
app.use('/api/notifications', notifications);
app.use('/api/push', push);
app.use('/api/orders', orders);
app.use('/api/chat', chat);
app.use('/api/summary', summary);
app.use('/api', images);

app.use((_req, res) => res.status(404).json({ error: 'Not found.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON.' });
  if (err.status) return res.status(err.status).json({ error: err.message });
  if (err.code === '23503') return res.status(422).json({ error: 'Referenced record does not exist.' });
  console.error(err);
  res.status(500).json({ error: 'Server error.' });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
  warmUp().catch(() => {});
});
