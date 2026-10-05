const sensitiveKey = /token|secret|password|authorization|api[_-]?key/i;
const sensitiveAssignment = /\b((?:access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|llm[_-]?api[_-]?key|api[_-]?key|password|authorization)["']?\s*[:=]\s*)(?:bearer\s+)?("[^"]*"|'[^']*'|[^\s,;&]+)/gi;

export function redactSensitiveValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitiveValue);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
    key,
    sensitiveKey.test(key) ? '[redacted]' : redactSensitiveValue(entry),
  ]));
}

export function redactSensitiveText(value: string): string {
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, 'Bearer [redacted]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[redacted token]')
    .replace(sensitiveAssignment, '$1[redacted]');
}
