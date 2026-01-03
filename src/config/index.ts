import dotenv from 'dotenv';
import * as path from 'path';

// .env dosyasını backend klasöründen oku
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',

  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-this-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'yol_asistan',
  },

  cors: {
    // CORS origin ayarları - birden fazla origin'i destekler
    // Virgülle ayrılmış string veya tek bir origin kabul eder
    origin: '*',
    credentials: true,
  },

  paytr: {
    merchantId: process.env.PAYTR_MERCHANT_ID || '',
    merchantKey: process.env.PAYTR_MERCHANT_KEY || '',
    merchantSalt: process.env.PAYTR_MERCHANT_SALT || '',
    baseUrl: process.env.PAYTR_BASE_URL || 'https://www.paytr.com',
    notificationUrl: process.env.PAYTR_NOTIFICATION_URL || '',
  },
};
