import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { CoilModel } from "@/lib/tesla/formulas";
import { frame } from "@/lib/tesla/runtime";
import { helixTube, spiralTube } from "./geometry";
import { traceFieldLines } from "./fields";

const helixVert = /* glsl */ `
  varying vec3 vN;
  varying vec3 vW;
  varying float vAlong;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    vAlong = uv.x;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const helixFrag = /* glsl */ `
  varying vec3 vN;
  varying vec3 vW;
  varying float vAlong;
  uniform float uI;
  uniform float uV;
  void main() {
    vec3 view = normalize(cameraPosition - vW);
    float fres = pow(1.0 - max(dot(normalize(vN), view), 0.0), 2.4);
    vec3 copper = vec3(0.72, 0.32, 0.14);
    vec3 col = copper * (0.22 + 1.05 * fres);
    float current = uI * pow(1.0 - vAlong, 1.35);
    float voltage = uV * pow(vAlong, 1.45);
    vec3 hot = vec3(0.85, 1.05, 1.45);
    col += hot * (current * 2.4 + voltage * 3.6);
    col += vec3(1.7, 1.95, 2.4) * fres * voltage;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const MOTE_COUNT = 160;

function useDisposed<T extends THREE.BufferGeometry>(geo: T) {
  useEffect(() => () => geo.dispose(), [geo]);
  return geo;
}

export function CoilView({ model }: { model: CoilModel }) {
  const wirePitch = model.secHeightM / model.visualTurns;
  const wireVis = Math.min(wirePitch * 0.26, Math.max(0.002, model.secRadiusM * 0.045));
  const secGeo = useDisposed(
    useMemo(
      () => helixTube(model.secRadiusM + wireVis * 0.2, model.secHeightM, model.visualTurns, wireVis),
      [model.secRadiusM, model.secHeightM, model.visualTurns, wireVis],
    ),
  );
  const priTube = Math.min(0.012, Math.max(0.0035, model.priWidthM * 0.09));
  const priGeo = useDisposed(
    useMemo(
      () => spiralTube(model.priInnerR, model.priWidthM, model.priRiseM, model.priTurns, priTube),
      [model.priInnerR, model.priWidthM, model.priRiseM, model.priTurns, priTube],
    ),
  );
  const lines = useMemo(() => traceFieldLines(model), [model]);
  const helixMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uI: { value: 0 }, uV: { value: 0 } },
        vertexShader: helixVert,
        fragmentShader: helixFrag,
      }),
    [],
  );
  const toroidMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#c5ccd2",
        metalness: 1,
        roughness: 0.22,
        clearcoat: 0.65,
        clearcoatRoughness: 0.28,
        emissive: new THREE.Color(0.75, 0.86, 1),
        emissiveIntensity: 0,
      }),
    [],
  );
  const coronaMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(1.5, 1.8, 2.3),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );
  const fieldMat = useMemo(
    () =>
      new THREE.LineDashedMaterial({
        color: "#aeb6c0",
        transparent: true,
        opacity: 0.45,
        dashSize: 0.035,
        gapSize: 0.028,
      }),
    [],
  );
  const fieldLines = useMemo(() => {
    return lines.map((pts) => {
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(g, fieldMat);
      line.computeLineDistances();
      return line;
    });
  }, [lines, fieldMat]);
  useEffect(
    () => () => fieldLines.forEach((line) => line.geometry.dispose()),
    [fieldLines],
  );

  const light = useRef<THREE.PointLight>(null);
  const gapLight = useRef<THREE.PointLight>(null);
  const stream = useRef<THREE.Group>(null);
  const builtFire = useRef(-1);
  const builtAt = useRef(0);
  const linger = useRef(0);
  const mainGeo = useRef<THREE.TubeGeometry | null>(null);
  const branchGeo = useRef<THREE.BufferGeometry | null>(null);
  const motePos = useRef<Float32Array | null>(null);
  const moteGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(MOTE_COUNT * 3);
    motePos.current = pos;
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  const moteMat = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: new THREE.Color(1.6, 1.9, 2.4),
        size: 0.012,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        sizeAttenuation: true,
      }),
    [],
  );
  const floorGlow = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.55, 0.72, 1.1),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );
  const priMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#8c4e2b",
        metalness: 1,
        roughness: 0.34,
        emissive: new THREE.Color(1.1, 0.72, 0.42),
        emissiveIntensity: 0,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      helixMat.dispose();
      toroidMat.dispose();
      coronaMat.dispose();
      fieldMat.dispose();
      moteMat.dispose();
      moteGeo.dispose();
      floorGlow.dispose();
      priMat.dispose();
    };
  }, [helixMat, toroidMat, coronaMat, fieldMat, moteMat, moteGeo, floorGlow, priMat]);

  const topY = model.secHeightM + model.toroidTubeR * 0.2;
  const breakX = model.toroidMajorM + model.toroidTubeR * 0.92;
  const origin = useMemo(() => new THREE.Vector3(breakX, topY, 0), [breakX, topY]);
  const rod = useMemo(() => new THREE.Vector3(breakX + 0.55, Math.max(0.28, topY * 0.72), 0.02), [breakX, topY]);

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    const vAmount = Math.min(1, Math.abs(frame.v2) / Math.max(frame.v2Peak, 1));
    helixMat.uniforms.uI.value = frame.iFrac;
    helixMat.uniforms.uV.value = Math.max(vAmount, frame.corona * 0.4);
    toroidMat.emissiveIntensity = frame.corona * 1.1 + frame.breakout * 4.4;
    coronaMat.opacity = Math.min(0.9, frame.corona * 0.22 + frame.breakout * 0.7);
    fieldMat.opacity = 0.28 + 0.4 * frame.iFrac * (1 - frame.breakout * 0.7);
    priMat.emissiveIntensity = frame.gap ? 1.4 : frame.iFrac * 0.55;
    if (frame.breakout > 0.08) linger.current = 1;
    else linger.current *= Math.exp(-d * 2.2);
    const shown = Math.max(frame.breakout, linger.current * 0.8);
    floorGlow.opacity = Math.min(0.55, frame.corona * 0.08 + shown * 0.42);
    moteMat.opacity = Math.min(0.9, frame.corona * 0.35 + shown * 0.7);
    const motes = motePos.current;
    if (motes && frame.corona > 0.08) {
      const now = performance.now() * 0.001;
      for (let i = 0; i < MOTE_COUNT; i++) {
        const a = (i / MOTE_COUNT) * Math.PI * 2 + now * (0.4 + (i % 5) * 0.05);
        const lift = ((i * 17) % 11) / 11;
        const rad = breakX * (0.82 + 0.22 * lift) + Math.sin(now * 6 + i) * model.toroidTubeR * 0.35;
        motes[i * 3] = Math.cos(a) * rad;
        motes[i * 3 + 1] = topY + Math.sin(now * 3.2 + i * 0.7) * model.toroidTubeR * (0.4 + lift);
        motes[i * 3 + 2] = Math.sin(a) * rad;
      }
      moteGeo.attributes.position.needsUpdate = true;
    }
    if (light.current) {
      light.current.intensity = 2 + frame.corona * 10 + shown * 48;
      light.current.position.set(origin.x * 0.7, origin.y, 0);
    }
    if (gapLight.current) {
      gapLight.current.intensity = frame.gap ? 14 : frame.flash * 6;
    }
    if (stream.current) {
      stream.current.scale.setScalar(1);
      stream.current.visible = shown > 0.04 && model.freauM > 0.02;
      const now = performance.now() * 0.001;
      if (shown > 0.12 && frame.fire !== builtFire.current && now - builtAt.current > 0.14) {
        builtFire.current = frame.fire;
        builtAt.current = now;
        rebuildBolt(
          origin,
          Math.min(Math.max(model.freauM, 0.2), 4.2),
          frame.fire + model.f2,
          mainGeo,
          branchGeo,
          stream.current,
          rod,
        );
      }
    }
  });

  const plinthR = Math.max(model.priInnerR + model.priWidthM + 0.08, model.toroidMajorM + model.toroidTubeR);
  const railR = model.priInnerR + model.priWidthM + priTube;
  const gapX = model.priInnerR + model.priWidthM * 0.72;

  return (
    <group>
      <mesh position={[0, -0.03, 0]}>
        <cylinderGeometry args={[plinthR * 0.92, plinthR, 0.06, 64]} />
        <meshStandardMaterial color="#14161c" metalness={0.35} roughness={0.62} />
      </mesh>
      <mesh position={[0, model.secHeightM / 2, 0]}>
        <cylinderGeometry args={[model.secRadiusM * 0.98, model.secRadiusM * 0.98, model.secHeightM, 48, 1, true]} />
        <meshStandardMaterial color="#1c1714" roughness={0.78} metalness={0.04} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={secGeo} material={helixMat} />
      <mesh geometry={priGeo} material={priMat} />
      <mesh position={[0, topY, 0]} material={toroidMat}>
        <torusGeometry args={[model.toroidMajorM, model.toroidTubeR, 28, 80]} />
      </mesh>
      <mesh position={[0, topY, 0]} material={coronaMat}>
        <torusGeometry args={[model.toroidMajorM, model.toroidTubeR * 1.12, 16, 64]} />
      </mesh>
      <mesh position={[0, Math.max(0.03, model.priRiseM * 0.5 + 0.02), 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[railR, Math.max(0.003, priTube * 0.45), 8, 64]} />
        <meshStandardMaterial color="#8d939c" metalness={0.85} roughness={0.35} />
      </mesh>
      <mesh position={[gapX, 0.045, 0.012]}>
        <sphereGeometry args={[0.012, 16, 16]} />
        <meshStandardMaterial color="#b9a48a" metalness={1} roughness={0.32} />
      </mesh>
      <mesh position={[gapX + 0.03, 0.045, -0.012]}>
        <sphereGeometry args={[0.012, 16, 16]} />
        <meshStandardMaterial color="#b9a48a" metalness={1} roughness={0.32} />
      </mesh>
      <mesh position={[0, -0.058, 0]} rotation={[-Math.PI / 2, 0, 0]} material={floorGlow}>
        <circleGeometry args={[Math.max(plinthR * 1.35, 0.8), 48]} />
      </mesh>
      <group position={[rod.x, 0, rod.z]}>
        <mesh position={[0, rod.y * 0.5, 0]}>
          <cylinderGeometry args={[0.007, 0.011, Math.max(0.24, rod.y), 12]} />
          <meshStandardMaterial color="#8d939c" metalness={0.9} roughness={0.32} />
        </mesh>
        <mesh position={[0, rod.y, 0]}>
          <sphereGeometry args={[0.016, 16, 16]} />
          <meshStandardMaterial color="#d7e4f2" metalness={1} roughness={0.18} emissive="#b7cbe4" emissiveIntensity={0.65} />
        </mesh>
      </group>
      <points geometry={moteGeo} material={moteMat} />
      <GapArc x={gapX + 0.015} />
      {fieldLines.map((line, i) => (
        <primitive key={i} object={line} />
      ))}
      <group ref={stream} position={origin} />
      <pointLight ref={light} color="#d5e7ff" distance={8} decay={2} />
      <pointLight ref={gapLight} position={[gapX, 0.06, 0]} color="#f2d2b0" distance={1.4} decay={2} />
    </group>
  );
}

function GapArc({ x }: { x: number }) {
  const geo = useMemo(() => {
    const pts = [new THREE.Vector3(-0.014, 0, 0.01), new THREE.Vector3(0, 0.008, 0), new THREE.Vector3(0.016, 0, -0.01)];
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);
  const mat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: new THREE.Color(2.4, 1.8, 1.2),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  );
  const line = useMemo(() => new THREE.Line(geo, mat), [geo, mat]);
  useEffect(() => () => {
    geo.dispose();
    mat.dispose();
  }, [geo, mat]);
  useFrame(() => {
    const on = frame.gap || frame.flash > 0.15;
    mat.opacity = on ? 0.9 : 0;
    line.visible = on;
  });
  return <primitive object={line} position={[x, 0.045, 0]} />;
}

function rebuildBolt(
  origin: THREE.Vector3,
  length: number,
  seed: number,
  mainGeo: MutableRefObject<THREE.TubeGeometry | null>,
  branchGeo: MutableRefObject<THREE.BufferGeometry | null>,
  group: THREE.Group,
  rod: THREE.Vector3,
) {
  let s = (Math.abs(Math.floor(seed * 17 + length * 100)) % 2147483646) + 1;
  const rnd = () => {
    s = (s * 48271) % 2147483647;
    return s / 2147483647;
  };
  const grow = (dir: THREE.Vector3, len: number, steps: number, start = new THREE.Vector3()) => {
    const pts = [start.clone()];
    const p = start.clone();
    const d = dir.clone().normalize();
    for (let i = 0; i < steps; i++) {
      d.x += (rnd() - 0.46) * 0.7;
      d.y += (rnd() - 0.42) * 0.48;
      d.z += (rnd() - 0.5) * 0.7;
      d.normalize();
      p.addScaledVector(d, (len / steps) * (0.62 + rnd() * 0.7));
      pts.push(p.clone());
    }
    return pts;
  };
  const toward = rod.clone().sub(origin);
  const dist = Math.max(toward.length(), 0.05);
  const reach = Math.min(length * 0.92, dist);
  const strike: THREE.Vector3[] = [new THREE.Vector3()];
  const steps = 16;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const p = toward.clone().multiplyScalar((reach / dist) * t);
    if (i !== steps || reach < dist * 0.97) {
      const wobble = length * 0.045 * Math.sin(t * Math.PI);
      p.x += (rnd() - 0.5) * wobble;
      p.y += (rnd() - 0.5) * wobble;
      p.z += (rnd() - 0.5) * wobble;
    }
    strike.push(p);
  }
  const bx = origin.x;
  const anchor = (a: number) => new THREE.Vector3((Math.cos(a) - 1) * bx, 0.01, Math.sin(a) * bx);
  const leaders = [
    strike,
    grow(new THREE.Vector3(Math.cos(2.2), 0.28, Math.sin(2.2)), length * 0.58, 12, anchor(2.2)),
    grow(new THREE.Vector3(Math.cos(-1.9), 0.4, Math.sin(-1.9)), length * 0.46, 10, anchor(-1.9)),
  ];
  const branches = [
    grow(new THREE.Vector3(0.7, 0.5, 0.4), length * 0.34, 7),
    grow(new THREE.Vector3(0.55, -0.15, -0.55), length * 0.28, 6),
  ];
  while (group.children.length) {
    const child = group.children[0] as THREE.Mesh | THREE.LineSegments;
    group.remove(child);
    child.geometry.dispose();
    const mat = child.material;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat.dispose();
  }
  const addTube = (pts: THREE.Vector3[], radius: number, color: THREE.Color, opacity: number) => {
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.TubeGeometry(curve, 40, radius, 5, false);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      depthWrite: false,
    });
    group.add(new THREE.Mesh(tube, mat));
    return tube;
  };
  mainGeo.current = addTube(leaders[0], Math.max(0.007, length * 0.012), new THREE.Color(2.2, 2.45, 2.8), 0.95);
  addTube(leaders[0], Math.max(0.003, length * 0.004), new THREE.Color(3.2, 3.4, 3.8), 0.85);
  addTube(leaders[1], Math.max(0.004, length * 0.007), new THREE.Color(1.5, 1.85, 2.5), 0.8);
  addTube(leaders[2], Math.max(0.0035, length * 0.006), new THREE.Color(1.35, 1.7, 2.4), 0.72);
  const positions: number[] = [];
  for (const b of branches) {
    for (let i = 1; i < b.length; i++) {
      positions.push(b[i - 1].x, b[i - 1].y, b[i - 1].z, b[i].x, b[i].y, b[i].z);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  branchGeo.current = g;
  const lineMat = new THREE.LineBasicMaterial({
    color: new THREE.Color(1.5, 1.85, 2.4),
    transparent: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    depthWrite: false,
  });
  group.add(new THREE.LineSegments(g, lineMat));
  group.position.copy(origin);
}
