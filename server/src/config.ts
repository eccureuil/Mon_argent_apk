import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgres://localhost:5432/mon_argent',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
};
