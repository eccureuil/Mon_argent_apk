import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { initDatabase } from './db/init';
import authRoutes from './routes/auth';
import courantRoutes from './routes/courant';
import epargneRoutes from './routes/epargne';
import facturesRoutes from './routes/factures';
import rapportRoutes from './routes/rapport';
import parametresRoutes from './routes/parametres';
import categoriesRoutes from './routes/categories';
import initialSetupRoutes from './routes/initialSetup';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/courant', courantRoutes);
app.use('/api/epargne', epargneRoutes);
app.use('/api/factures', facturesRoutes);
app.use('/api/rapport', rapportRoutes);
app.use('/api/parametres', parametresRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/initial-setup', initialSetupRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function start() {
  try {
    await initDatabase();
    app.listen(config.port, () => {
      console.log(`Mon Argent API running on port ${config.port}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
