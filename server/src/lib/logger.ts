type Level = 'debug' | 'info' | 'warn' | 'error';
const COLORS: Record<Level, string> = { debug: '\x1b[90m', info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m' };

function emit(level: Level, msg: string, meta?: unknown) {
  const ts = new Date().toISOString();
  const line = `${COLORS[level]}[${level.toUpperCase()}]\x1b[0m ${ts} ${msg}`;
  const out = level === 'error' || level === 'warn' ? console.error : console.log;
  meta === undefined ? out(line) : out(line, meta);
}

export const log = {
  debug: (m: string, x?: unknown) => emit('debug', m, x),
  info: (m: string, x?: unknown) => emit('info', m, x),
  warn: (m: string, x?: unknown) => emit('warn', m, x),
  error: (m: string, x?: unknown) => emit('error', m, x),
};
