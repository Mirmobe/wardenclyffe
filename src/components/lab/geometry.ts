import * as THREE from "three";

export function helixTube(radius: number, height: number, turns: number, tube: number) {
  const safeTurns = Math.max(1, turns);
  const segs = Math.max(12, Math.round(safeTurns * 9));
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const a = t * safeTurns * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, t * height, Math.sin(a) * radius));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  return new THREE.TubeGeometry(curve, segs, Math.max(0.0008, tube), 5, false);
}

export function spiralTube(
  inner: number,
  width: number,
  rise: number,
  turns: number,
  tube: number,
) {
  const safeTurns = Math.max(1, turns);
  const segs = Math.max(24, Math.round(safeTurns * 28));
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const a = t * safeTurns * Math.PI * 2;
    const r = inner + t * width;
    pts.push(new THREE.Vector3(Math.cos(a) * r, 0.012 + t * rise, Math.sin(a) * r));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  return new THREE.TubeGeometry(curve, segs, Math.max(0.002, tube), 6, false);
}
