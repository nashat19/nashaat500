import type { Request, Response } from 'express';

interface Client { id: number; userId: number; res: Response }

let seq = 0;
const clients = new Map<number, Client>();

export function sseHandler(req: Request, res: Response): void {
  if (!req.user) {
    res.status(401).end();
    return;
  }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(`event: ready\ndata: {"ok":true}\n\n`);

  const id = ++seq;
  clients.set(id, { id, userId: req.user.sub, res });

  const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
  req.on('close', () => {
    clearInterval(ping);
    clients.delete(id);
  });
}

export function emitToUser(userId: number, event: string, data: unknown): void {
  for (const client of clients.values()) {
    if (client.userId !== userId) continue;
    client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }
}

export function broadcast(event: string, data: unknown): void {
  for (const client of clients.values()) {
    client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }
}
