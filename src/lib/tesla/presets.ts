import type { CoilDesign, LinkDesign, TurbineDesign } from "./formulas";

export const benchCoil: CoilDesign = {
  secDiameterMm: 110,
  secHeightMm: 500,
  secTurns: 1000,
  wireMm: 0.5,
  toroidOuterMm: 500,
  toroidTubeMm: 120,
  mountingReduction: 0,
  priInnerMm: 170,
  priTurns: 8,
  priPitchMm: 8,
  priConeDeg: 12,
  priCapNf: 30,
  gapKv: 15,
  gapOhm: 1.3,
  bps: 140,
  quenchCycles: 4,
  kLock: null,
};

export const doorwayCoil: CoilDesign = {
  secDiameterMm: 260,
  secHeightMm: 1200,
  secTurns: 1100,
  wireMm: 0.8,
  toroidOuterMm: 1100,
  toroidTubeMm: 220,
  mountingReduction: 0.08,
  priInnerMm: 400,
  priTurns: 10,
  priPitchMm: 14,
  priConeDeg: 16,
  priCapNf: 90,
  gapKv: 20,
  gapOhm: 1.1,
  bps: 100,
  quenchCycles: 5,
  kLock: null,
};

export const magnifierCoil: CoilDesign = {
  secDiameterMm: 300,
  secHeightMm: 1500,
  secTurns: 480,
  wireMm: 1,
  toroidOuterMm: 640,
  toroidTubeMm: 140,
  mountingReduction: 0,
  priInnerMm: 480,
  priTurns: 5,
  priPitchMm: 18,
  priConeDeg: 6,
  priCapNf: 48,
  gapKv: 22,
  gapOhm: 0.9,
  bps: 80,
  quenchCycles: 6,
  kLock: null,
};

export const coilPresets: { id: string; label: string; coil: CoilDesign }[] = [
  { id: "bench", label: "Bench", coil: benchCoil },
  { id: "door", label: "Doorway", coil: doorwayCoil },
  { id: "magnifier", label: "Magnifier", coil: magnifierCoil },
];

export const defaultLink: LinkDesign = {
  distanceMm: 180,
  radiusMm: 160,
  turns: 12,
  wireMm: 2,
  freqKhz: 180,
};

export const defaultTurbine: TurbineDesign = {
  rpm: 9000,
  disks: 12,
  radiusMm: 140,
  spacingMm: 0.6,
  fluid: "steam",
};
