import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const common = {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
};

const useSsl = process.env.DATABASE_SSL === 'true'
  || (process.env.NODE_ENV === 'production' && process.env.DATABASE_SSL !== 'false');

const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      ...common,
      ...(useSsl ? { dialectOptions: { ssl: { require: true, rejectUnauthorized: false } } } : {}),
    })
  : new Sequelize(
      process.env.DB_NAME || 'kandoo',
      process.env.DB_USER || 'postgres',
      process.env.DB_PASS || '',
      {
        ...common,
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 5432),
      },
    );

export default sequelize;

