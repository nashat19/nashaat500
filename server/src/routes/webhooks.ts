import { Router } from 'express';
import { db } from '../db/index.js';
import { config } from '../config.js';
import { log } from '../lib/logger.js';
import { getConnector } from '../services/connectors/registry.js';
import { ingestMessage } from '../services/inbox.js';

const router = Router();

router.get('/meta', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === config.meta.verifyToken) {
    res.type('text/plain').send(String(req.query['hub.challenge'] ?? ''));
    return;
  }
  res.status(403).send('forbidden');
});

router.get('/whatsapp', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === config.whatsapp.verifyToken) {
    res.type('text/plain').send(String(req.query['hub.challenge'] ?? ''));
    return;
  }
  res.status(403).send('forbidden');
});

function handle(platform: string) {
  return (req: import('express').Request, res: import('express').Response) => {
    res.json({ ok: true });
    try {
      const connector = getConnector(platform);
      if (!connector) return;

      const raw = (req as import('express').Request & { rawBody?: string }).rawBody ?? JSON.stringify(req.body);
      if (!connector.verifyWebhook(req.headers as Record<string, unknown>, raw)) {
        log.warn(`توقيع webhook غير صالح: ${platform}`);
        return;
      }

      const pageId = Number(req.query.pageId ?? 0);
      const messages = connector.parseWebhook(req.body);
      if (messages.length === 0) return;

      let resolvedPageId = pageId;
      if (!resolvedPageId) {
        const page = db.prepare('SELECT id FROM pages WHERE platform = ? LIMIT 1').get(platform) as { id: number } | undefined;
        if (!page) return;
        resolvedPageId = page.id;
      }

      for (const m of messages) {
        ingestMessage({
          pageId: resolvedPageId,
          externalUserId: m.externalUserId,
          externalUserName: m.externalUserName,
          avatarUrl: m.avatarUrl,
          body: m.body,
          externalMessageId: m.externalMessageId,
          attachments: m.attachments,
        });
      }
    } catch (err) {
      log.error(`خطأ في webhook ${platform}`, err);
    }
  };
}

router.post('/meta', handle('facebook'));
router.post('/instagram', handle('instagram'));
router.post('/whatsapp', handle('whatsapp'));
router.post('/telegram', handle('telegram'));

export default router;
