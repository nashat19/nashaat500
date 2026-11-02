import { config } from '../../config.js';
import type { PageRow } from '../pages.js';
import type { Connector, InboundMessage, PublishPayload, PublishResult } from './base.js';

export const telegramConnector: Connector = {
  platform: 'telegram',

  async publish(page: PageRow, token: string, payload: PublishPayload): Promise<PublishResult> {
    const botToken = token || config.telegram.botToken;
    if (config.simulate && !botToken) {
      const id = `sim_tg_${Date.now()}`;
      return { externalId: id, permalink: `https://t.me/${page.handle}/${id}` };
    }
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: page.external_id, text: payload.body, parse_mode: 'HTML' }),
    });
    const json = (await res.json()) as { ok: boolean; result?: { message_id: number }; description?: string };
    if (!json.ok) throw new Error(`Telegram: ${json.description ?? 'فشل الإرسال'}`);
    return {
      externalId: String(json.result?.message_id ?? ''),
      permalink: `https://t.me/${page.handle}/${json.result?.message_id ?? ''}`,
    };
  },

  parseWebhook(body: unknown): InboundMessage[] {
    const update = body as { message?: Record<string, unknown> };
    const msg = update.message;
    if (!msg) return [];
    const from = msg.from as { id?: number; first_name?: string; username?: string } | undefined;
    const chat = msg.chat as { id?: number } | undefined;
    return [{
      externalUserId: String(chat?.id ?? from?.id ?? 'unknown'),
      externalUserName: from?.first_name ?? from?.username ?? 'زائر',
      avatarUrl: '',
      body: String(msg.text ?? ''),
      externalMessageId: String(msg.message_id ?? ''),
      attachments: [],
    }];
  },

  verifyWebhook(): boolean {
    return true;
  },
};
