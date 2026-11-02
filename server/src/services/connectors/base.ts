import type { PageRow } from '../pages.js';

export interface PublishPayload {
  body: string;
  title: string;
  media: string[];
}

export interface PublishResult {
  externalId: string;
  permalink: string;
}

export interface InboundMessage {
  externalUserId: string;
  externalUserName: string;
  avatarUrl: string;
  body: string;
  externalMessageId: string;
  attachments: string[];
}

export interface Connector {
  platform: string;
  publish(page: PageRow, token: string, payload: PublishPayload): Promise<PublishResult>;
  parseWebhook(body: unknown): InboundMessage[];
  verifyWebhook(headers: Record<string, unknown>, rawBody: string): boolean;
}
