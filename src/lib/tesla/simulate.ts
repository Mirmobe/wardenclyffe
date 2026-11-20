import type { CoilModel } from "./formulas";

export type Bang = {
  n: number;
  v1: Float32Array;
  v2: Float32Array;
  i1: Float32Array;
  i2: Float32Array;
  e1: Float32Array;
  e2: Float32Array;
  ed: Float32Array;
  gap: Uint8Array;
  v1Peak: number;
  v2Peak: number;
  i1Peak: number;
  i2Peak: number;
  e0: number;
  quenchAt: number;
  stable: boolean;
};

const y = new Float64Array(4);
const k1 = new Float64Array(4);
const k2 = new Float64Array(4);
const k3 = new Float64Array(4);
const k4 = new Float64Array(4);
const t1 = new Float64Array(4);
const t2 = new Float64Array(4);
const t3 = new Float64Array(4);

function deriv(
  s: Float64Array,
  closed: boolean,
  out: Float64Array,
  L1: number,
  L2: number,
  C1: number,
  C2: number,
  R1: number,
  R2: number,
  M: number,
  det: number,
) {
  const q1 = s[0];
  const i1 = s[1];
  const q2 = s[2];
  const i2 = s[3];
  if (!closed) {
    out[0] = 0;
    out[1] = 0;
    out[2] = i2;
    out[3] = (-R2 * i2 - q2 / C2) / L2;
    return;
  }
  const v1 = -R1 * i1 - q1 / C1;
  const v2 = -R2 * i2 - q2 / C2;
  out[0] = i1;
  out[1] = (L2 * v1 + M * v2) / det;
  out[2] = i2;
  out[3] = (L1 * v2 + M * v1) / det;
}

function axpy(out: Float64Array, a: Float64Array, b: Float64Array, scale: number) {
  out[0] = a[0] + b[0] * scale;
  out[1] = a[1] + b[1] * scale;
  out[2] = a[2] + b[2] * scale;
  out[3] = a[3] + b[3] * scale;
}

export function simulateBang(m: CoilModel, quenchCyclesIn: number): Bang {
  const L1 = m.L1;
  const L2 = m.L2;
  const C1 = m.C1;
  const C2 = m.C2;
  const R1 = m.R1;
  const R2 = m.R2;
  const M = m.M;
  const det = L1 * L2 - M * M;
  const Vgap = Math.sqrt((2 * Math.max(m.bangJ, 0)) / C1);
  const target = 720;

  const make = (n: number): Bang => ({
    n,
    v1: new Float32Array(n),
    v2: new Float32Array(n),
    i1: new Float32Array(n),
    i2: new Float32Array(n),
    e1: new Float32Array(n),
    e2: new Float32Array(n),
    ed: new Float32Array(n),
    gap: new Uint8Array(n),
    v1Peak: Vgap,
    v2Peak: 0,
    i1Peak: 0,
    i2Peak: 0,
    e0: m.bangJ,
    quenchAt: 0,
    stable: false,
  });

  if (!(det > L1 * L2 * 1e-6) || !(C1 > 0) || !(C2 > 0) || !(Vgap > 0)) return make(2);

  const fRef = Math.max(m.f1, m.f2, Number.isFinite(m.fHigh) ? m.fHigh : 0, 5e3);
  const fSlow = Math.max(5e3, Math.min(m.f1, m.f2));
  let dt = 1 / (fRef * 36);
  const beat =
    Number.isFinite(m.fHigh) && Number.isFinite(m.fLow) && m.fHigh > m.fLow
      ? 1 / Math.max(1, m.fHigh - m.fLow)
      : 16 / fSlow;
  const tau = m.Q2 / (Math.PI * Math.max(m.f2, 1));
  const T = Math.min(0.008, Math.max(14 / fSlow, 0.5 * beat, 0.28 * Math.min(tau, 0.02)));
  let steps = Math.ceil(T / dt);
  if (steps > 16000) {
    steps = 16000;
    dt = T / steps;
  }
  if (steps < 240) {
    steps = 240;
    dt = T / steps;
  }

  const stride = Math.max(1, Math.floor(steps / target));
  const nStore = Math.floor(steps / stride) + 2;
  const bang = make(nStore);
  const quenchCycles = Math.max(1, Math.min(40, Math.round(quenchCyclesIn)));

  y[0] = C1 * Vgap;
  y[1] = 0;
  y[2] = 0;
  y[3] = 0;

  let closed = true;
  let prevI = 0;
  let cycles = 0;
  let ed = 0;
  let v2Peak = 0;
  let v1Peak = Vgap;
  let i1Peak = 0;
  let i2Peak = 0;
  let quenchAt = 0;
  let stable = true;
  let stored = 0;

  const energyParts = (q1: number, i1: number, q2: number, i2: number) => {
    const cross = -M * i1 * i2;
    return {
      e1: 0.5 * (q1 * q1) / C1 + 0.5 * L1 * i1 * i1 + 0.5 * cross,
      e2: 0.5 * (q2 * q2) / C2 + 0.5 * L2 * i2 * i2 + 0.5 * cross,
    };
  };

  const push = () => {
    if (stored >= nStore) return;
    const parts = energyParts(y[0], y[1], y[2], y[3]);
    bang.v1[stored] = y[0] / C1;
    bang.v2[stored] = y[2] / C2;
    bang.i1[stored] = y[1];
    bang.i2[stored] = y[3];
    bang.e1[stored] = parts.e1;
    bang.e2[stored] = parts.e2;
    bang.ed[stored] = ed;
    bang.gap[stored] = closed ? 1 : 0;
    stored++;
  };

  push();

  for (let step = 1; step <= steps; step++) {
    const iBefore = y[1];
    const i2Before = y[3];
    deriv(y, closed, k1, L1, L2, C1, C2, R1, R2, M, det);
    axpy(t1, y, k1, dt / 2);
    deriv(t1, closed, k2, L1, L2, C1, C2, R1, R2, M, det);
    axpy(t2, y, k2, dt / 2);
    deriv(t2, closed, k3, L1, L2, C1, C2, R1, R2, M, det);
    axpy(t3, y, k3, dt);
    deriv(t3, closed, k4, L1, L2, C1, C2, R1, R2, M, det);
    const s6 = dt / 6;
    y[0] += s6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    y[1] += s6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    y[2] += s6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
    y[3] += s6 * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]);

    ed += (R1 * ((iBefore + y[1]) * 0.5) ** 2 + R2 * ((i2Before + y[3]) * 0.5) ** 2) * dt;

    if (!Number.isFinite(y[0] + y[1] + y[2] + y[3]) || Math.abs(y[1]) > 5e6 || Math.abs(y[3]) > 5e6) {
      stable = false;
      break;
    }

    if (closed && prevI > 0 && y[1] <= 0) {
      cycles++;
      if (cycles >= quenchCycles) {
        closed = false;
        y[1] = 0;
        quenchAt = stored;
      }
    }
    prevI = y[1];

    const v2abs = Math.abs(y[2] / C2);
    const v1abs = Math.abs(y[0] / C1);
    if (v2abs > v2Peak) v2Peak = v2abs;
    if (v1abs > v1Peak) v1Peak = v1abs;
    if (Math.abs(y[1]) > i1Peak) i1Peak = Math.abs(y[1]);
    if (Math.abs(y[3]) > i2Peak) i2Peak = Math.abs(y[3]);
    if (v2abs > Math.max(m.vCeiling, 1) * 6) {
      stable = false;
      break;
    }

    if (step % stride === 0) push();
  }

  bang.n = Math.max(2, stored);
  bang.v2Peak = v2Peak;
  bang.v1Peak = v1Peak;
  bang.i1Peak = i1Peak;
  bang.i2Peak = i2Peak;
  bang.quenchAt = Math.min(quenchAt, bang.n - 1);
  bang.stable = stable;
  return bang;
}