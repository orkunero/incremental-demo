// Browser storage adapter. Every call is wrapped: storage can be missing or blocked
// (private windows, embedded previews), and the game must still run without it.
export function readJSON(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked: the game keeps running, it just will not persist
  }
}

export function remove(...keys: string[]): void {
  try {
    for (const k of keys) localStorage.removeItem(k);
  } catch {
    // ignore
  }
}
