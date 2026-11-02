import { config } from '../../config.js';
import type { PageRow } from '../pages.js';
import type { Connector, InboundMessage, PublishPayload, PublishResult } from './base.js';

export const whatsappConnector: Connector = {
  platform: 'whatsapp',

  async publish(page: PageRow, token: string, payload: PublishPayload): Promise<PublishResult> {
    const waToken = token || config.whatsapp.token;
    const phoneId = page.external_id || config.whatsapp.phoneId;
    if (config.simulate && !waToken) {
      const id = `sim_wa_${Date.now()}`;
      return { externalId: id, permalink: `https://wa.me/${page.handle}` };
    }
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${waToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: page.handle.replace(/\D/g, ''),
        type: 'text',
        text: { body: payload.body },
      }),
    });
    const json = (await res.json()) as { messages?: { id: string }[]; error?: { message: string } };
    if (!res.ok) throw new Error(`WhatsApp: ${json.error?.message ?? 'فشل الإرسال'}`);
    return { externalId: json.messages?.[0]?.id ?? '', permalink: `https://wa.me/${page.handle}` };
  },

  parseWebhook(body: unknown): InboundMessage[] {
    const out: InboundMessage[] = [];
    const entries = (body as { entry?: unknown[] })?.entry ?? [];
    for (const entry of entries as Record<string, unknown>[]) {
      const changes = (entry.changes ?? []) as Record<string, unknown>[];
      for (const change of changes) {
        const value = change.value as Record<string, unknown> | undefined;
        const messages = (value?.messages ?? []) as Record<string, unknown>[];
        const contacts = (value?.contacts ?? []) as Record<string, unknown>[];
        for (const m of messages) {
          out.push({
            externalUserId: String(m.from ?? 'unknown'),
            externalUserName: String((contacts[0]?.profile as { name?: string } | undefined)?.name ?? 'زائر'),
            avatarUrl: '',
            body: String((m.text as { body?: string } | undefined)?.body ?? ''),
            externalMessageId: String(m.id ?? ''),
            attachments: [],
          });
        }
      }
    }
    return out;
  },

  verifyWebhook(): boolean {
    return true;
  },
};
