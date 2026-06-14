import { Router, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { query } from '../db/pool';
import { config } from '../config';
import { authenticate, AuthRequest } from '../middleware/auth';
import type { User } from '../types';

const router = Router();

function generateToken(userId: number): string {
  return jwt.sign({ userId }, config.jwtSecret, { expiresIn: '30d' });
}

router.post('/register', async (req: AuthRequest, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis' });
      return;
    }

    const hash = crypto.createHash('sha256').update(password).digest('hex');

    const result = await query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
      [username, hash]
    );

    const user = result.rows[0];
    const token = generateToken(user.id);

    res.status(201).json({ user, token });
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'Nom d\'utilisateur déjà pris' });
      return;
    }
    console.error('Register error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/login', async (req: AuthRequest, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis' });
      return;
    }

    const hash = crypto.createHash('sha256').update(password).digest('hex');

    const result = await query<User>(
      'SELECT * FROM users WHERE username = $1 AND password_hash = $2',
      [username, hash]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
      return;
    }

    const user = result.rows[0];
    const token = generateToken(user.id);

    res.json({ user, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query<User>(
      'SELECT id, username, created_at FROM users WHERE id = $1',
      [req.userId!]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Utilisateur introuvable' });
      return;
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/username', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { username } = req.body;
    await query('UPDATE users SET username = $1 WHERE id = $2', [username, req.userId!]);
    res.json({ success: true });
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'Nom d\'utilisateur déjà pris' });
      return;
    }
    console.error('Update username error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/password', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { oldPassword, newPassword } = req.body;

    const result = await query<User>('SELECT * FROM users WHERE id = $1', [req.userId!]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Utilisateur introuvable' });
      return;
    }

    const oldHash = crypto.createHash('sha256').update(oldPassword).digest('hex');
    if (result.rows[0].password_hash !== oldHash) {
      res.status(401).json({ error: 'Ancien mot de passe incorrect' });
      return;
    }

    const newHash = crypto.createHash('sha256').update(newPassword).digest('hex');
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.userId!]);

    res.json({ success: true });
  } catch (err) {
    console.error('Update password error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
