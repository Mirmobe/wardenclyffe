export const MU0 = 4 * Math.PI * 1e-7;
export const RHO_CU = 1.724e-8;
export const C_LIGHT = 299_792_458;

export type CoilDesign = {
  secDiameterMm: number;
  secHeightMm: number;
  secTurns: number;
  wireMm: number;
  toroidOuterMm: number;
  toroidTubeMm: number;
  mountingReduction: number;
  priInnerMm: number;
  priTurns: number;
  priPitchMm: number;
  priConeDeg: number;
  priCapNf: number;
  gapKv: number;
  gapOhm: number;
  bps: number;
  quenchCycles: number;
  kLock: number | null;
};

export type CoilModel = {
  L1: number;
  L2: number;
  C1: number;
  C2: number;
  Cmed: number;
  Ctor: number;
  R1: number;
  R2: number;
  Rdc: number;
  M: number;
  k: number;
  kGeom: number;
  f1: number;
  f2: number;
  detune: number;
  fLow: number;
  fHigh: number;
  Q1: number;
  Q2: number;
  bangJ: number;
  powerW: number;
  vCeiling: number;
  vOnset: number;
  freauM: number;
  wireM: number;
  quarterWaveRatio: number;
  crestCycles: number;
  warnings: string[];
  secRadiusM: number;
  secHeightM: number;
  toroidMajorM: number;
  toroidTubeR: number;
  priInnerR: number;
  priWidthM: number;
  priRiseM: number;
  priTurns: number;
  visualTurns: number;
};

const EMPTY: CoilModel = {
  L1: 1e-6,
  L2: 1e-3,
  C1: 1e-9,
  C2: 1e-11,
  Cmed: 0,
  Ctor: 0,
  R1: 1,
  R2: 10,
  Rdc: 1,
  M: 0,
  k: 0.1,
  kGeom: 0.1,
  f1: 1e5,
  f2: 1e5,
  detune: 0,
  fLow: 9e4,
  fHigh: 1.1e5,
  Q1: 10,
  Q2: 50,
  bangJ: 0,
  powerW: 0,
  vCeiling: 0,
  vOnset: 1e9,
  freauM: 0,
  wireM: 0,
  quarterWaveRatio: 0,
  crestCycles: 4,
  warnings: ["Geometry is outside the model."],
  secRadiusM: 0.05,
  secHeightM: 0.3,
  toroidMajorM: 0.1,
  toroidTubeR: 0.02,
  priInnerR: 0.08,
  priWidthM: 0.04,
  priRiseM: 0,
  priTurns: 4,
  visualTurns: 40,
};

function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n));
}

/** Complete elliptic integrals K(κ) and E(κ) via AGM and the power series. */
export function ellipticKE(kappa: number): { K: number; E: number } {
  const m = clamp(kappa * kappa, 0, 0.999999);
  let a = 1;
  let g = Math.sqrt(1 - m);
  for (let i = 0; i < 14; i++) {
    const an = (a + g) / 2;
    const gn = Math.sqrt(a * g);
    a = an;
    g = gn;
  }
  const K = Math.PI / 2 / a;
  let coeff = 1;
  let mm = 1;
  let sum = 1;
  for (let n = 1; n <= 28; n++) {
    coeff *= ((2 * n - 1) / (2 * n)) ** 2;
    mm *= m;
    sum -= (coeff * mm) / (2 * n - 1);
  }
  return { K, E: (Math.PI / 2) * sum };
}

/** Wheeler 1928 single-layer solenoid. Radius and length in inches. Result in µH. */
export function wheelerSolenoidUH(radiusIn: number, lengthIn: number, turns: number) {
  const b = Math.max(lengthIn, 1e-4);
  return (radiusIn * radiusIn * turns * turns) / (9 * radiusIn + 10 * b);
}

/** Wheeler flat spiral. Mean radius and radial width in inches. Result in µH. */
export function wheelerSpiralUH(meanRadiusIn: number, widthIn: number, turns: number) {
  const w = Math.max(widthIn, 1e-4);
  return (meanRadiusIn * meanRadiusIn * turns * turns) / (8 * meanRadiusIn + 11 * w);
}

/**
 * Medhurst self-capacitance, inch form that reproduces the 1947 tables:
 * C(pF) = 0.29 l + 0.41 r + 1.94 √(r³ / l)
 */
export function medhurstPF(lengthIn: number, radiusIn: number) {
  const l = Math.max(lengthIn, 1e-4);
  const r = Math.max(radiusIn, 1e-4);
  return 0.29 * l + 0.41 * r + 1.94 * Math.sqrt((r * r * r) / l);
}

/** Isolated toroid, Bert Pool / Denicolai. Outside and tube diameters in inches. pF. */
export function toroidPF(outerIn: number, tubeIn: number) {
  const D = Math.max(outerIn, 1e-3);
  const d = clamp(tubeIn, 1e-3, D * 0.92);
  const ratio = d / D;
  return 2.8 * (1.2781 - ratio) * Math.sqrt((Math.PI * d * (D - d)) / 4);
}

/** Mutual inductance of two coaxial circular filaments, henries. */
export function mutualHenry(r1: number, z1: number, r2: number, z2: number) {
  const z = z2 - z1;
  const sumR = r1 + r2;
  const denom = sumR * sumR + z * z;
  if (denom < 1e-16 || r1 < 1e-7 || r2 < 1e-7) return 0;
  let kappa = Math.sqrt((4 * r1 * r2) / denom);
  if (!Number.isFinite(kappa) || kappa < 1e-6) return 0;
  if (kappa > 0.999) kappa = 0.999;
  const { K, E } = ellipticKE(kappa);
  const term = (2 / kappa - kappa) * K - (2 / kappa) * E;
  const m = MU0 * Math.sqrt(r1 * r2) * term;
  return Number.isFinite(m) ? m : 0;
}

/**
 * Magnetic field of a circular filament, cylindrical components.
 * I in amperes, lengths in meters. On-axis limit is handled separately.
 */
export function loopField(a: number, rho: number, z: number, I: number): { br: number; bz: number } {
  const axis = (MU0 * I * a * a) / (2 * Math.pow(a * a + z * z, 1.5));
  if (rho < Math.abs(a) * 1e-3 + 1e-6) return { br: 0, bz: axis };
  const denomSqrt = Math.sqrt((a + rho) * (a + rho) + z * z);
  let kappa = Math.sqrt((4 * a * rho) / ((a + rho) * (a + rho) + z * z));
  if (kappa > 0.999) kappa = 0.999;
  if (kappa < 1e-6 || !Number.isFinite(kappa)) return { br: 0, bz: axis };
  const { K, E } = ellipticKE(kappa);
  const alpha = (a - rho) * (a - rho) + z * z;
  if (alpha < 1e-16) return { br: 0, bz: axis };
  const bz =
    ((MU0 * I) / (2 * Math.PI * denomSqrt)) *
    (((a * a - rho * rho - z * z) / alpha) * E + K);
  const br =
    ((MU0 * I * z) / (2 * Math.PI * rho * denomSqrt)) *
    (((a * a + rho * rho + z * z) / alpha) * E - K);
  if (!Number.isFinite(br) || !Number.isFinite(bz)) return { br: 0, bz: axis };
  return { br, bz };
}

export function coupledPoles(L1: number, C1: number, L2: number, C2: number, k: number) {
  const kk = clamp(k, 0, 0.9);
  const A = L1 * L2 * C1 * C2 * (1 - kk * kk);
  const B = L1 * C1 + L2 * C2;
  const disc = B * B - 4 * A;
  if (!(A > 0) || disc < 0) return { fLow: NaN, fHigh: NaN };
  const s = Math.sqrt(disc);
  const x1 = (B - s) / (2 * A);
  const x2 = (B + s) / (2 * A);
  return {
    fLow: Math.sqrt(Math.max(1e-30, Math.min(x1, x2))) / (2 * Math.PI),
    fHigh: Math.sqrt(Math.max(1e-30, Math.max(x1, x2))) / (2 * Math.PI),
  };
}

function skinFactor(radiusM: number, freq: number) {
  if (!(freq > 1) || !(radiusM > 0)) return 1;
  const delta = Math.sqrt((2 * RHO_CU) / (2 * Math.PI * freq * MU0));
  const ratio = radiusM / (2 * delta);
  return Math.max(1, ratio);
}

export function analyzeCoil(d: CoilDesign): CoilModel {
  const warnings: string[] = [];
  const turns = Math.max(2, d.secTurns);
  const secRadiusM = Math.max(0.005, d.secDiameterMm / 2000);
  const secHeightM = Math.max(0.02, d.secHeightMm / 1000);
  const aIn = secRadiusM / 0.0254;
  const bIn = secHeightM / 0.0254;
  if (secHeightM < secRadiusM * 1.6) {
    warnings.push("Secondary is short for Wheeler's solenoid formula (best above about 0.8 diameters tall).");
  }

  const L2 = wheelerSolenoidUH(aIn, bIn, turns) * 1e-6;
  const Cmed = medhurstPF(bIn, aIn) * 1e-12;
  const outerIn = Math.max(d.toroidOuterMm / 25.4, d.toroidTubeMm / 25.4 + 0.2);
  const tubeIn = clamp(d.toroidTubeMm / 25.4, 0.05, outerIn * 0.9);
  if (d.toroidTubeMm >= d.toroidOuterMm * 0.92) {
    warnings.push("Toroid tube was limited so it stays inside the outside diameter.");
  }
  const Ctor = toroidPF(outerIn, tubeIn) * 1e-12;
  const reduction = clamp(d.mountingReduction, 0, 0.45);
  const C2 = Math.max(1e-13, (Cmed + Ctor) * (1 - reduction));

  const priTurns = Math.max(1, Math.round(d.priTurns));
  const priInnerR = Math.max(0.01, d.priInnerMm / 2000);
  const pitchM = Math.max(0.002, d.priPitchMm / 1000);
  const priWidthM = Math.max(pitchM * 0.25, (priTurns - 1) * pitchM);
  const cone = clamp(d.priConeDeg, 0, 55) * (Math.PI / 180);
  const priRiseM = priWidthM * Math.tan(cone);
  const meanRIn = (priInnerR + priWidthM / 2) / 0.0254;
  const widthIn = priWidthM / 0.0254;
  const Lspiral = wheelerSpiralUH(meanRIn, widthIn, priTurns) * 1e-6;
  const heightIn = Math.max(priRiseM / 0.0254, 0);
  const Lhelix = heightIn > 0.15 ? wheelerSolenoidUH(meanRIn, heightIn, priTurns) * 1e-6 : Lspiral;
  const L1 = Math.max(
    1e-8,
    Math.sqrt((Lhelix * Math.sin(cone)) ** 2 + (Lspiral * Math.cos(cone)) ** 2),
  );
  const C1 = Math.max(1e-12, d.priCapNf * 1e-9);

  if (priInnerR < secRadiusM * 1.05) {
    warnings.push("Primary inner diameter cuts into the secondary. Coupling and the spark gap get unrealistic.");
  }

  const nS = Math.min(36, Math.max(10, Math.round(turns / 18)));
  const turnsPer = turns / nS;
  let Mgeom = 0;
  for (let i = 0; i < nS; i++) {
    const z = ((i + 0.5) / nS) * secHeightM;
    for (let j = 0; j < priTurns; j++) {
      const t = priTurns === 1 ? 0 : j / (priTurns - 1);
      const r = priInnerR + t * priWidthM;
      const zp = t * priRiseM;
      Mgeom += turnsPer * mutualHenry(secRadiusM, z, r, zp);
    }
  }
  Mgeom = Math.abs(Mgeom);
  const kGeomRaw = L1 > 0 && L2 > 0 ? Mgeom / Math.sqrt(L1 * L2) : 0;
  const kGeom = Number.isFinite(kGeomRaw) ? kGeomRaw : 0;
  if (kGeom > 0.62) {
    warnings.push("Filament coupling is very high. The integrator caps k at 0.62 unless you set a lower override.");
  }
  const kWanted = d.kLock == null ? kGeom : d.kLock;
  const k = clamp(kWanted, 0.02, 0.62);
  const M = k * Math.sqrt(L1 * L2);

  const f1 = 1 / (2 * Math.PI * Math.sqrt(L1 * C1));
  const f2 = 1 / (2 * Math.PI * Math.sqrt(L2 * C2));
  const detune = (f1 - f2) / f2;
  const poles = coupledPoles(L1, C1, L2, C2, k);

  const wireR = Math.max(1e-5, d.wireMm / 2000);
  const wireM = turns * Math.PI * (secRadiusM * 2);
  const Rdc = (RHO_CU * wireM) / (Math.PI * wireR * wireR);
  const R2 = Rdc * skinFactor(wireR, f2) * 2.2;
  const tubeR = 0.003;
  const priLen = priTurns * 2 * Math.PI * (priInnerR + priWidthM / 2);
  const Rcu = (RHO_CU * priLen) / (Math.PI * tubeR * tubeR);
  const R1 = Math.max(0.05, d.gapOhm) + Rcu * skinFactor(tubeR, f1);
  const Q1 = (2 * Math.PI * f1 * L1) / R1;
  const Q2 = (2 * Math.PI * f2 * L2) / R2;

  const Vgap = Math.max(100, d.gapKv * 1000);
  const bangJ = 0.5 * C1 * Vgap * Vgap;
  const bps = clamp(d.bps, 1, 2000);
  const powerW = bangJ * bps;
  const vCeiling = Math.sqrt((2 * bangJ) / C2);
  const freauM = 1.7 * Math.sqrt(Math.max(0, powerW)) * 0.0254;

  const rCm = (tubeIn * 0.0254 * 100) / 2;
  const Rcm = Math.max(((outerIn - tubeIn) * 0.0254 * 100) / 2, rCm * 1.3);
  const roughness = 0.72;
  const Ec = 30 * roughness * (1 + 0.301 / Math.sqrt(Math.max(rCm, 0.05)));
  const geom = Math.log(Math.max(8 * (Rcm / rCm), 1.2));
  const vOnset = Ec * rCm * geom * 0.55 * 1000;

  const lambda4 = C_LIGHT / (4 * f2);
  const quarterWaveRatio = wireM / lambda4;
  const crestCycles = 1 / (2 * Math.max(k, 0.03));

  if (Math.abs(detune) > 0.03) {
    warnings.push("Primary and secondary are off tune. Energy transfer falls apart away from a shared frequency.");
  }
  if (Q2 < 40) {
    warnings.push("Secondary Q is low. Thicker wire or a taller coil usually raises it; the form factor here is already pessimistic.");
  }

  const visualTurns = Math.max(28, Math.min(78, Math.round(turns / 14)));

  return {
    L1,
    L2,
    C1,
    C2,
    Cmed,
    Ctor,
    R1,
    R2,
    Rdc,
    M,
    k,
    kGeom,
    f1,
    f2,
    detune,
    fLow: poles.fLow,
    fHigh: poles.fHigh,
    Q1,
    Q2,
    bangJ,
    powerW,
    vCeiling,
    vOnset,
    freauM,
    wireM,
    quarterWaveRatio,
    crestCycles,
    warnings,
    secRadiusM,
    secHeightM,
    toroidMajorM: Math.max(0.01, ((outerIn - tubeIn) * 0.0254) / 2),
    toroidTubeR: Math.max(0.004, (tubeIn * 0.0254) / 2),
    priInnerR,
    priWidthM,
    priRiseM,
    priTurns,
    visualTurns,
  };
}

export function tunePrimary(d: CoilDesign): CoilDesign {
  const m = analyzeCoil(d);
  if (!(m.L1 > 0) || !(m.f2 > 0)) return d;
  const C = 1 / ((2 * Math.PI * m.f2) ** 2 * m.L1);
  return { ...d, priCapNf: clamp(C * 1e9, 0.4, 800) };
}

export function quenchAtCrest(d: CoilDesign): CoilDesign {
  const m = analyzeCoil(d);
  return { ...d, quenchCycles: clamp(Math.round(m.crestCycles), 1, 30) };
}

export function fitQuarterWave(d: CoilDesign): CoilDesign {
  let lo = Math.max(d.toroidTubeMm * 1.4, d.secDiameterMm * 0.9);
  let hi = 3600;
  let best = { ...d };
  let bestErr = Infinity;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const m = analyzeCoil({ ...d, toroidOuterMm: mid });
    const err = m.quarterWaveRatio - 1;
    if (Math.abs(err) < Math.abs(bestErr)) {
      bestErr = err;
      best = { ...d, toroidOuterMm: Math.round(mid) };
    }
    if (m.quarterWaveRatio > 1) lo = mid;
    else hi = mid;
  }
  return best;
}

export type LinkDesign = {
  distanceMm: number;
  radiusMm: number;
  turns: number;
  wireMm: number;
  freqKhz: number;
};

export type LinkModel = {
  L: number;
  C: number;
  R: number;
  Q: number;
  k: number;
  U: number;
  eta: number;
  f: number;
  radiusM: number;
  heightM: number;
};

export function analyzeLink(d: LinkDesign): LinkModel {
  const turns = Math.max(2, Math.round(d.turns));
  const radiusM = Math.max(0.02, d.radiusMm / 1000);
  const pitch = Math.max(d.wireMm * 1.7, 1.2) / 1000;
  const heightM = Math.max(pitch * (turns - 1), radiusM * 0.08);
  const aIn = radiusM / 0.0254;
  const bIn = heightM / 0.0254;
  const L = Math.max(1e-8, wheelerSolenoidUH(aIn, bIn, turns) * 1e-6);
  const f = Math.max(10_000, d.freqKhz * 1000);
  const wireR = Math.max(1e-5, d.wireMm / 2000);
  const len = turns * 2 * Math.PI * radiusM;
  const Rdc = (RHO_CU * len) / (Math.PI * wireR * wireR);
  const R = Rdc * skinFactor(wireR, f) * 1.6;
  const Q = (2 * Math.PI * f * L) / Math.max(R, 1e-6);
  const C = 1 / ((2 * Math.PI * f) ** 2 * L);

  const n = Math.min(turns, 16);
  const per = turns / n;
  const gap = Math.max(0.005, d.distanceMm / 1000);
  let M = 0;
  for (let i = 0; i < n; i++) {
    const z1 = (i / Math.max(1, n - 1)) * heightM;
    for (let j = 0; j < n; j++) {
      const z2 = gap + heightM + (j / Math.max(1, n - 1)) * heightM;
      M += per * per * mutualHenry(radiusM, z1, radiusM, z2);
    }
  }
  M = Math.abs(M);
  const k = clamp(M / Math.max(L, 1e-12), 0, 0.85);
  const U = k * Q;
  const eta = (U * U) / (1 + Math.sqrt(1 + U * U)) ** 2;
  return { L, C, R, Q, k, U, eta, f, radiusM, heightM };
}

export type TurbineDesign = {
  rpm: number;
  disks: number;
  radiusMm: number;
  spacingMm: number;
  fluid: "air" | "steam" | "oil";
};

export type TurbineModel = {
  nu: number;
  omega: number;
  deltaM: number;
  spacingM: number;
  ratio: number;
  adhesion: number;
  choke: number;
  index: number;
  radiusM: number;
  disks: number;
};

const NU: Record<TurbineDesign["fluid"], number> = {
  air: 1.51e-5,
  steam: 2.1e-5,
  oil: 4.8e-5,
};

export function analyzeTurbine(d: TurbineDesign): TurbineModel {
  const disks = Math.round(clamp(d.disks, 3, 28));
  const radiusM = clamp(d.radiusMm, 40, 400) / 1000;
  const spacingM = clamp(d.spacingMm, 0.15, 8) / 1000;
  const omega = (clamp(d.rpm, 200, 40000) * 2 * Math.PI) / 60;
  const nu = NU[d.fluid];
  const deltaM = 3.6 * Math.sqrt(nu / Math.max(omega, 1));
  const ratio = spacingM / deltaM;
  const adhesion = 1 - Math.exp(-deltaM / Math.max(spacingM, 1e-6));
  const choke = spacingM < deltaM ? spacingM / deltaM : 1;
  return {
    nu,
    omega,
    deltaM,
    spacingM,
    ratio,
    adhesion,
    choke,
    index: adhesion * choke,
    radiusM,
    disks,
  };
}

/** Measured-looking Schumann peaks, and the ideal cavity scaled to the 7.83 Hz fundamental. */
export const SCHUMANN_MEASURED = [7.83, 14.3, 20.8, 27.3, 33.8];

export function schumannIdeal(n: number) {
  return 7.83 * Math.sqrt((n * (n + 1)) / 2);
}

export function fmtSi(n: number, unit: string, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a < 1e-15) return `0 ${unit}`;
  const prefs: [number, string][] = [
    [1e12, "T"],
    [1e9, "G"],
    [1e6, "M"],
    [1e3, "k"],
    [1, ""],
    [1e-3, "m"],
    [1e-6, "µ"],
    [1e-9, "n"],
    [1e-12, "p"],
    [1e-15, "f"],
  ];
  let scale = 1;
  let p = "";
  for (const [s, name] of prefs) {
    if (a >= s) {
      scale = s;
      p = name;
      break;
    }
  }
  const m = a / scale;
  const d = m >= 100 ? Math.min(digits, 1) : digits;
  let body = m.toFixed(d);
  if (body.includes(".")) body = body.replace(/0+$/, "").replace(/\.$/, "");
  return `${sign}${body} ${p}${unit}`;
}

export function fmtPct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const p = n * 100;
  const sign = p > 0 ? "+" : "";
  const d = Math.abs(p) >= 10 ? 1 : 2;
  return `${sign}${p.toFixed(d)}%`;
}
