import type { Bang } from "./simulate";

export type ScopeKind = "coil" | "motor" | "turbine" | "link" | "cavity";

export type Live = {
  v1: number;
  v2: number;
  e1: number;
  e2: number;
  ed: number;
  e0: number;
  gap: boolean;
  play: number;
  stream: number;
  iFrac: number;
  flash: number;
  breakout: number;
  corona: number;
  v2Peak: number;
  vOnset: number;
  fire: number;
  stable: boolean;
};

export const frame: Live = {
  v1: 0,
  v2: 0,
  e1: 0,
  e2: 0,
  ed: 0,
  e0: 1,
  gap: false,
  play: 0,
  stream: 0,
  iFrac: 0,
  flash: 0,
  breakout: 0,
  corona: 0,
  v2Peak: 0,
  vOnset: 1,
  fire: 0,
  stable: true,
};

export const playback = {
  play: 0,
  fire: 0,
  flash: 0,
  strobe: 0,
  bang: null as Bang | null,
};

export const scope = {
  kind: "coil" as ScopeKind,
  play: 0,
  lens: true,
  wt: 0,
  eta: 0,
  k: 0,
  mode: 1,
  adhesion: 0,
  ratio: 1,
  rpm: 0,
};

let snapshot: Live = { ...frame };
const listeners = new Set<() => void>();
let lastEmit = 0;

export function emitLive(nowSec: number) {
  if (nowSec - lastEmit < 0.05) return;
  lastEmit = nowSec;
  snapshot = { ...frame };
  listeners.forEach((l) => l());
}

export function subscribeLive(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getLive(): Live {
  return snapshot;
}

export function sampleBang(play: number) {
  const b = playback.bang;
  frame.play = play;
  frame.fire = playback.fire;
  frame.flash = playback.flash;
  if (!b || b.n < 2) {
    frame.stream = 0;
    frame.iFrac = 0;
    frame.breakout = 0;
    return;
  }
  const x = Math.min(b.n - 1, Math.max(0, play * (b.n - 1)));
  const i = Math.floor(x);
  const f = x - i;
  const j = Math.min(b.n - 1, i + 1);
  const lerp = (a: Float32Array) => a[i] * (1 - f) + a[j] * f;
  frame.v1 = lerp(b.v1);
  frame.v2 = lerp(b.v2);
  frame.e1 = lerp(b.e1);
  frame.e2 = lerp(b.e2);
  frame.ed = lerp(b.ed);
  frame.e0 = b.e0 || 1;
  frame.gap = b.gap[i] === 1;
  frame.v2Peak = b.v2Peak;
  frame.stable = b.stable;
  const peak = Math.max(b.v2Peak, 1);
  frame.stream = Math.min(1, Math.abs(frame.v2) / peak);
  frame.iFrac = Math.min(1, Math.abs(lerp(b.i2)) / Math.max(b.i2Peak, 1e-6));
  scope.play = play;
}
