import { config } from '../../config.js';
import { hmacSha256, safeEqualHex } from '../../lib/crypto.js';
import type { PageRow } from '../pages.js';
import type { Connector, InboundMessage, PublishPayload, PublishResult } from './base.js';

async function graph(path: string, token: string, body: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch(`${config.meta.graph}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...body, access_token: token }).toString(),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw new Error(`Meta API: ${JSON.stringify(json)}`);
  return json;
}

export const metaConnector: Connector = {
  platform: 'meta',

  async publish(page: PageRow, token: string, payload: PublishPayload): Promise<PublishResult> {
    if (config.simulate && !token) {
      const id = `sim_${page.platform}_${Date.now()}`;
      return { externalId: id, permalink: `https://example.com/${id}` };
    }

    if (page.platform === 'instagram') {
      const media = payload.media[0];
      if (!media) throw new Error('منشور إنستغرام يتطلب صورة واحدة على الأقل');
      const container = await graph(`/${page.external_id}/media`, token, {
        image_url: media,
        caption: payload.body,
      });
      const published = await graph(`/${page.external_id}/media_publish`, token, {
        creation_id: String(container.id),
      });
      return { externalId: String(published.id), permalink: `https://instagram.com/p/${published.id}` };
    }

    const result = await graph(`/${page.external_id}/feed`, token, {
      message: payload.body,
      ...(payload.media[0] ? { link: payload.media[0] } : {}),
    });
    return { externalId: String(result.id), permalink: `https://facebook.com/${result.id}` };
  },

  parseWebhook(body: unknown): InboundMessage[] {
    const out: InboundMessage[] = [];
    const entries = (body as { entry?: unknown[] })?.entry ?? [];
    for (const entry of entries as Record<string, unknown>[]) {
      const messaging = (entry.messaging ?? []) as Record<string, unknown>[];
      for (const event of messaging) {
        const message = event.message as Record<string, unknown> | undefined;
        if (!message || message.is_echo) continue;
        const sender = event.sender as { id?: string } | undefined;
        out.push({
          externalUserId: String(sender?.id ?? 'unknown'),
          externalUserName: 'زائر',
          avatarUrl: '',
          body: String(message.text ?? ''),
          externalMessageId: String(message.mid ?? ''),
          attachments: [],
        });
      }
    }
    return out;
  },

  verifyWebhook(headers, rawBody): boolean {
    if (!config.meta.appSecret) return true;
    const signature = String(headers['x-hub-signature-256'] ?? '');
    if (!signature.startsWith('sha256=')) return false;
    return safeEqualHex(signature.slice(7), hmacSha256(config.meta.appSecret, rawBody));
  },
};
