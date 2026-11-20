import { create } from "zustand";
import type { CoilDesign, LinkDesign, TurbineDesign } from "./formulas";
import { benchCoil, defaultLink, defaultTurbine } from "./presets";

export type Exhibit = "coil" | "magnifier" | "motor" | "turbine" | "link" | "cavity";

export type MotorDesign = {
  frequencyHz: number;
  poles: 2 | 4 | 6;
  slip: number;
};

type LabState = {
  exhibit: Exhibit;
  coil: CoilDesign;
  motor: MotorDesign;
  turbine: TurbineDesign;
  link: LinkDesign;
  cavityMode: 1 | 2 | 3 | 4 | 5;
  paused: boolean;
  lens: boolean;
  sound: boolean;
  setExhibit: (exhibit: Exhibit) => void;
  setCoil: (patch: Partial<CoilDesign>) => void;
  replaceCoil: (coil: CoilDesign) => void;
  setMotor: (patch: Partial<MotorDesign>) => void;
  setTurbine: (patch: Partial<TurbineDesign>) => void;
  setLink: (patch: Partial<LinkDesign>) => void;
  setCavityMode: (mode: 1 | 2 | 3 | 4 | 5) => void;
  setPaused: (paused: boolean) => void;
  setLens: (lens: boolean) => void;
  setSound: (sound: boolean) => void;
};

export const useLab = create<LabState>((set) => ({
  exhibit: "coil",
  coil: benchCoil,
  motor: { frequencyHz: 60, poles: 2, slip: 0.06 },
  turbine: defaultTurbine,
  link: defaultLink,
  cavityMode: 1,
  paused: false,
  lens: true,
  sound: false,
  setExhibit: (exhibit) => set({ exhibit }),
  setCoil: (patch) => set((s) => ({ coil: { ...s.coil, ...patch } })),
  replaceCoil: (coil) => set({ coil }),
  setMotor: (patch) => set((s) => ({ motor: { ...s.motor, ...patch } })),
  setTurbine: (patch) => set((s) => ({ turbine: { ...s.turbine, ...patch } })),
  setLink: (patch) => set((s) => ({ link: { ...s.link, ...patch } })),
  setCavityMode: (cavityMode) => set({ cavityMode }),
  setPaused: (paused) => set({ paused }),
  setLens: (lens) => set({ lens }),
  setSound: (sound) => set({ sound }),
}));

const KEY = "wardenclyffe.v1";

function sanitizeCoil(base: CoilDesign, patch: Partial<CoilDesign>): CoilDesign {
  const next: CoilDesign = { ...base, ...patch };
  const keys: (keyof CoilDesign)[] = [
    "secDiameterMm",
    "secHeightMm",
    "secTurns",
    "wireMm",
    "toroidOuterMm",
    "toroidTubeMm",
    "mountingReduction",
    "priInnerMm",
    "priTurns",
    "priPitchMm",
    "priConeDeg",
    "priCapNf",
    "gapKv",
    "gapOhm",
    "bps",
    "quenchCycles",
  ];
  for (const key of keys) {
    const value = next[key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      const fallback = base[key];
      if (typeof fallback === "number") next[key] = fallback;
    }
  }
  if (next.kLock != null && (typeof next.kLock !== "number" || !Number.isFinite(next.kLock))) next.kLock = null;
  return next;
}

export function bindLabPersistence() {
  if (typeof window === "undefined") return () => {};
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw) as {
        coil?: Partial<CoilDesign>;
        exhibit?: Exhibit;
        lens?: boolean;
      };
      const exhibits: Exhibit[] = ["coil", "magnifier", "motor", "turbine", "link", "cavity"];
      useLab.setState((s) => ({
        coil: data.coil ? sanitizeCoil(s.coil, data.coil) : s.coil,
        exhibit: data.exhibit && exhibits.includes(data.exhibit) ? data.exhibit : s.exhibit,
        lens: typeof data.lens === "boolean" ? data.lens : s.lens,
      }));
    }
  } catch {
    /* ignore broken saves */
  }
  return useLab.subscribe((s) => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ coil: s.coil, exhibit: s.exhibit, lens: s.lens }),
    );
  });
}
