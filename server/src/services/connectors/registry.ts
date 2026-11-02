import type { Connector } from './base.js';
import { metaConnector } from './meta.js';
import { telegramConnector } from './telegram.js';
import { whatsappConnector } from './whatsapp.js';

const registry = new Map<string, Connector>([
  ['facebook', metaConnector],
  ['instagram', metaConnector],
  ['telegram', telegramConnector],
  ['whatsapp', whatsappConnector],
]);

export function getConnector(platform: string): Connector | null {
  return registry.get(platform) ?? null;
}
