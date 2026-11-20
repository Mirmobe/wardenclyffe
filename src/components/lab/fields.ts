import * as THREE from "three";
import { loopField, type CoilModel } from "@/lib/tesla/formulas";

export function traceFieldLines(m: CoilModel): THREE.Vector3[][] {
  const nS = 12;
  const loops: { r: number; z: number }[] = [];
  for (let i = 0; i < nS; i++) {
    loops.push({ r: m.secRadiusM, z: ((i + 0.5) / nS) * m.secHeightM });
  }

  const B = (p: THREE.Vector3) => {
    let br = 0;
    let bz = 0;
    const rho = Math.hypot(p.x, p.z);
    for (const loop of loops) {
      const f = loopField(loop.r, rho, p.y - loop.z, 1);
      br += f.br;
      bz += f.bz;
    }
    const inv = rho > 1e-5 ? 1 / rho : 0;
    return new THREE.Vector3(br * p.x * inv, bz, br * p.z * inv);
  };

  const mid = B(new THREE.Vector3(0.0001, m.secHeightM * 0.5, 0));
  if (!(mid.y > 0)) return [];

  const h = m.secHeightM;
  const step = Math.max(0.012, h / 34);
  const seeds = [
    new THREE.Vector3(m.secRadiusM * 0.25, h * 0.15, 0),
    new THREE.Vector3(m.secRadiusM * 1.25, h * 0.5, 0),
    new THREE.Vector3(0, h * 0.5, m.secRadiusM * 1.25),
    new THREE.Vector3(-m.secRadiusM * 1.45, h * 0.32, m.secRadiusM * 0.2),
    new THREE.Vector3(m.secRadiusM * 0.7, h * 0.82, m.secRadiusM * 0.7),
  ];

  const walk = (start: THREE.Vector3, sign: number) => {
    const acc: THREE.Vector3[] = [];
    const q = start.clone();
    for (let i = 0; i < 48; i++) {
      const b = B(q);
      const mag = b.length();
      if (!(mag > 1e-9)) break;
      q.addScaledVector(b, (sign * step) / mag);
      if (q.y < -0.08 || q.y > h * 2.6 || Math.hypot(q.x, q.z) > h * 2.4) break;
      acc.push(q.clone());
    }
    return acc;
  };

  const lines: THREE.Vector3[][] = [];
  for (const seed of seeds) {
    const back = walk(seed, -1).reverse();
    const fwd = walk(seed, 1);
    const line = back.concat(fwd);
    if (line.length > 6) lines.push(line);
  }
  return lines;
}
