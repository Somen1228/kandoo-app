import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import sequelize from './config/database.js';
import './models/User.js';
import './models/Workspace.js';
import authRoutes from './routes/auth.js';
import workspaceRoutes from './routes/workspace.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);
const browserOrigins = new Set(
  (process.env.FRONTEND_URL || 'http://localhost:5176,http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);
const nativeOrigins = new Set(['tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost']);

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || browserOrigins.has(origin) || nativeOrigins.has(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  },
}));
app.use(express.json({ limit: '25mb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 240, standardHeaders: true, legacyHeaders: false }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api/workspace', workspaceRoutes);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.type === 'entity.too.large' ? 413 : 500).json({
    error: error.type === 'entity.too.large' ? 'Workspace payload is too large' : 'Unexpected server error',
  });
});

async function start() {
  await sequelize.authenticate();
  await sequelize.sync();
  app.listen(port, () => console.log(`Kandoo API listening on http://localhost:${port}`));
}

start().catch((error) => {
  console.error('Kandoo API failed to start:', error);
  process.exit(1);
});

