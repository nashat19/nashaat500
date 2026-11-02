import 'dotenv/config';
import path from 'node:path';

const bool = (v: string | undefined, d = false) =>
  v === undefined ? d : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  webBase: process.env.WEB_BASE ?? 'http://localhost:5173',
  apiBase: process.env.API_BASE ?? 'http://localhost:4000',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me-please-now',
  masterKey: process.env.MASTER_KEY ?? 'dev-master-key-change-me-please-now',
  dbPath: path.resolve(process.env.DB_PATH ?? './data/loansocial.db'),
  uploadDir: path.resolve(process.env.UPLOAD_DIR ?? './data/uploads'),
  simulate: bool(process.env.SIMULATE_PUBLISH, true),
  meta: {
    appId: process.env.META_APP_ID ?? '',
    appSecret: process.env.META_APP_SECRET ?? '',
    verifyToken: process.env.META_VERIFY_TOKEN ?? 'loansocial_verify',
    graph: process.env.META_GRAPH ?? 'https://graph.facebook.com/v20.0',
  },
  telegram: { botToken: process.env.TELEGRAM_BOT_TOKEN ?? '' },
  whatsapp: {
    phoneId: process.env.WA_PHONE_ID ?? '',
    token: process.env.WA_TOKEN ?? '',
    verifyToken: process.env.WA_VERIFY_TOKEN ?? 'loansocial_wa_verify',
  },
} as const;

export const isProd = config.env === 'production';
