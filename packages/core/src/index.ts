export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogEntry = { id: number; timestamp: string; level: LogLevel; scope: string; message: string; details?: unknown };

let captureEnabled = false;
let nextId = 1;
let entries: LogEntry[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export function setLogCaptureEnabled(enabled: boolean) {
  captureEnabled = enabled;
  emit();
}
export const isLogCaptureEnabled = () => captureEnabled;
export const getLogs = () => entries;
export function clearLogs() { entries = []; emit(); }
export function subscribeToLogs(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); }
export function formatLogs() {
  return entries.map((entry) => `${entry.timestamp} ${entry.level.toUpperCase()} [${entry.scope}] ${entry.message}${entry.details === undefined ? '' : ` ${safeJson(entry.details)}`}`).join('\n');
}

function safeJson(value: unknown) {
  try { return JSON.stringify(value); } catch { return '[unserializable]'; }
}

export function createLogger(scope: string) {
  const write = (level: LogLevel, message: string, details?: unknown) => {
    const method = level === 'debug' ? 'debug' : level;
    console[method](`[${scope}] ${message}`, details ?? '');
    if (!captureEnabled) return;
    entries = [...entries.slice(-499), { id: nextId++, timestamp: new Date().toISOString(), level, scope, message, details }];
    emit();
  };
  return {
    debug: (message: string, details?: unknown) => write('debug', message, details),
    info: (message: string, details?: unknown) => write('info', message, details),
    warn: (message: string, details?: unknown) => write('warn', message, details),
    error: (message: string, details?: unknown) => write('error', message, details),
  };
}
