// Saves: plain JSON of the game state, with migrations for older saves and offline catch-up.
import type { GameState } from './types.ts';
import { createState, tick } from './engine.ts';

export interface SaveFile {
  savedAt: number;
  state: GameState;
}

export function toSave(s: GameState, now: number): SaveFile {
  return { savedAt: now, state: { ...s, events: [] } };
}

/** Rebuild a game state from a parsed save. Throws if it does not look like a Git Rich save. */
export function fromSave(data: unknown): GameState {
  const file = data as Partial<SaveFile> | null;
  const saved = file?.state as Partial<GameState> | undefined;
  if (!saved || typeof saved.loc !== 'number' || typeof saved.money !== 'number') throw new Error('Not a Git Rich save');
  const s: GameState = Object.assign(createState({ perks: saved.perks }), saved);
  // saves from before parallel goals only had a counter: mark that many goals as done
  if (!saved.goalsDone) for (let i = 0; i < (s.goal || 0); i++) s.goalsDone[i] = true;
  s.events = [];
  s.rev++;
  return s;
}

/** Run the economy for the time the player was away (capped). Returns the money earned. */
export function catchUp(s: GameState, secondsAway: number): number {
  const cap = (s.perks.night ? 8 : 2) * 3600;
  const away = Math.min(cap, Math.max(0, secondsAway));
  const before = s.money;
  for (let i = 0; i < away; i++) tick(s, 1, () => 0.999, { offline: true });
  s.viral = null;
  s.events = [];
  return s.money - before;
}

/** Saves as text, for export and import. */
export const encodeSave = (file: SaveFile) => btoa(unescape(encodeURIComponent(JSON.stringify(file))));
export const decodeSave = (text: string): unknown => JSON.parse(decodeURIComponent(escape(atob(text.trim()))));
