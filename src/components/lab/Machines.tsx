import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  analyzeLink,
  analyzeTurbine,
} from "@/lib/tesla/formulas";
import { sparkAudio } from "@/lib/tesla/audio";
import { scope } from "@/lib/tesla/runtime";
import { useLab } from "@/lib/tesla/store";
import { helixTube } from "./geometry";

const up = new THREE.Vector3(0, 1, 0);
const dir = new THREE.Vector3();
const quat = new THREE.Quaternion();

export function MotorExhibit() {
  const motor = useLab((s) => s.motor);
  const sound = useLab((s) => s.sound);
  const paused = useLab((s) => s.paused);
  const rotor = useRef<THREE.Group>(null);
  const arrow = useRef<THREE.Group>(null);
  const coils = useRef<THREE.Mesh[]>([]);
  const wt = useRef(0);
  const spin = useRef(0);

  useEffect(() => () => sparkAudio.stopAll(), []);

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    scope.kind = "motor";
    const m = motor;
    if (!paused) {
      wt.current += d * m.frequencyHz * Math.PI * 2;
      const mech = m.frequencyHz * Math.PI * 2 * (2 / m.poles) * (1 - m.slip);
      spin.current += d * mech;
    }
    scope.wt = wt.current;
    const ia = Math.sin(wt.current);
    const ib = Math.sin(wt.current - (2 * Math.PI) / 3);
    const ic = Math.sin(wt.current + (2 * Math.PI) / 3);
    const bx = ia + ib * -0.5 + ic * -0.5;
    const bz = ib * (Math.sqrt(3) / 2) + ic * (-Math.sqrt(3) / 2);
    if (arrow.current) {
      dir.set(bx, 0, bz);
      if (dir.lengthSq() > 1e-6) {
        quat.setFromUnitVectors(up, dir.normalize());
        arrow.current.quaternion.copy(quat);
      }
    }
    if (rotor.current) rotor.current.rotation.y = spin.current;
    const glow = [ia, ic, ib, ia, ic, ib];
    coils.current.forEach((mesh, i) => {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const a = Math.abs(glow[i] ?? 0);
      mat.emissiveIntensity = 0.15 + a * 1.6;
    });
    sparkAudio.hum(m.frequencyHz, sound && !paused);
    sparkAudio.whirring(0, false);
    sparkAudio.realBps(0, false);
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <cylinderGeometry args={[0.92, 0.98, 0.06, 48]} />
        <meshStandardMaterial color="#14161c" metalness={0.4} roughness={0.55} />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2;
        const x = Math.cos(a) * 0.62;
        const z = Math.sin(a) * 0.62;
        return (
          <group key={i} position={[x, 0.16, z]} rotation={[0, -a, 0]}>
            <mesh
              ref={(el) => {
                if (el) coils.current[i] = el;
              }}
            >
              <torusGeometry args={[0.11, 0.028, 10, 24]} />
              <meshStandardMaterial color="#8c4e2b" metalness={1} roughness={0.38} emissive="#e7f0f8" emissiveIntensity={0.2} />
            </mesh>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[0.05, 0.16, 0.05]} />
              <meshStandardMaterial color="#2a241f" roughness={0.7} />
            </mesh>
          </group>
        );
      })}
      <group ref={rotor}>
        <mesh position={[0, 0.16, 0]}>
          <cylinderGeometry args={[0.28, 0.28, 0.06, 40]} />
          <meshStandardMaterial color="#1a1d22" metalness={0.6} roughness={0.42} />
        </mesh>
        <mesh position={[0.16, 0.2, 0]}>
          <boxGeometry args={[0.08, 0.02, 0.03]} />
          <meshStandardMaterial color="#c5ccd2" metalness={0.8} roughness={0.3} />
        </mesh>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.2, 0.2, Math.sin(a) * 0.2]}>
              <boxGeometry args={[0.015, 0.05, 0.015]} />
              <meshStandardMaterial color="#b4683c" metalness={1} roughness={0.35} />
            </mesh>
          );
        })}
      </group>
      <mesh position={[0, 0.16, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.28, 16]} />
        <meshStandardMaterial color="#9aa3ad" metalness={0.85} roughness={0.3} />
      </mesh>
      <group ref={arrow} position={[0, 0.42, 0]}>
        <mesh position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.36, 10]} />
          <meshBasicMaterial color="#e7eef5" />
        </mesh>
        <mesh position={[0, 0.44, 0]}>
          <coneGeometry args={[0.04, 0.1, 12]} />
          <meshBasicMaterial color="#e7eef5" />
        </mesh>
      </group>
    </group>
  );
}

export function TurbineExhibit() {
  const design = useLab((s) => s.turbine);
  const sound = useLab((s) => s.sound);
  const paused = useLab((s) => s.paused);
  const model = useMemo(() => analyzeTurbine(design), [design]);
  const disks = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const parts = useRef<{ r: number; th: number; w: number; gap: number }[]>([]);
  const spin = useRef(0);

  useEffect(() => () => sparkAudio.stopAll(), []);

  const count = 160;
  if (parts.current.length !== count) {
    parts.current = Array.from({ length: count }, (_, i) => ({
      r: 0.25 + ((i * 37) % 100) / 140,
      th: (i / count) * Math.PI * 2,
      w: 0,
      gap: i % Math.max(1, model.disks - 1),
    }));
  }

  const visualGap = Math.max(model.spacingM * 6, model.radiusM * 0.045);
  const R = 0.72;

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    scope.kind = "turbine";
    scope.adhesion = model.adhesion;
    scope.ratio = model.ratio;
    scope.rpm = design.rpm;
    const visualOmega = model.omega * 0.015;
    if (!paused && disks.current) {
      spin.current += d * visualOmega;
      disks.current.rotation.y = spin.current;
    }
    const diskW = paused ? 0 : visualOmega;
    const pull = 2 + model.adhesion * 8;
    const inst = mesh.current;
    if (!inst) return;
    parts.current.forEach((p, i) => {
      if (!paused) {
        p.w += (diskW - p.w) * (1 - Math.exp(-d * pull));
        p.th += p.w * d * 1.4;
        p.r -= d * (0.12 + 0.2 * model.choke);
        if (p.r < 0.16) {
          p.r = 0.9 + Math.random() * 0.08;
          p.w = diskW * 0.15;
        }
      }
      const y = ((p.gap % Math.max(1, model.disks - 1)) - (model.disks - 2) / 2) * visualGap;
      dummy.position.set(Math.cos(p.th) * p.r * R, y, Math.sin(p.th) * p.r * R);
      dummy.scale.setScalar(0.035);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
    sparkAudio.whirring(model.index, sound && !paused);
    sparkAudio.hum(0, false);
    sparkAudio.realBps(0, false);
  });

  return (
    <group position={[0, 0.35, 0]}>
      <mesh position={[0, -0.28, 0]}>
        <cylinderGeometry args={[0.18, 0.22, 0.5, 20]} />
        <meshStandardMaterial color="#16181d" metalness={0.45} roughness={0.5} />
      </mesh>
      <group ref={disks}>
        <mesh>
          <cylinderGeometry args={[0.035, 0.035, visualGap * model.disks + 0.08, 16]} />
          <meshStandardMaterial color="#c5ccd2" metalness={0.9} roughness={0.28} />
        </mesh>
        {Array.from({ length: model.disks }, (_, i) => (
          <mesh key={i} position={[0, (i - (model.disks - 1) / 2) * visualGap, 0]}>
            <cylinderGeometry args={[R, R, 0.008, 48]} />
            <meshStandardMaterial color="#8d94a0" metalness={0.85} roughness={0.32} transparent opacity={0.82} />
          </mesh>
        ))}
      </group>
      <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial color="#d5e4f2" />
      </instancedMesh>
    </group>
  );
}

export function LinkExhibit() {
  const design = useLab((s) => s.link);
  const sound = useLab((s) => s.sound);
  const paused = useLab((s) => s.paused);
  const model = useMemo(() => analyzeLink(design), [design]);
  const a = useRef<THREE.MeshStandardMaterial>(null);
  const b = useRef<THREE.MeshStandardMaterial>(null);
  const phase = useRef(0);
  const turns = Math.min(16, Math.max(4, design.turns));
  const tube = Math.max(0.004, model.radiusM * 0.035);
  const geo = useMemo(
    () => helixTube(model.radiusM, Math.max(model.heightM, tube * 3), turns, tube),
    [model.radiusM, model.heightM, turns, tube],
  );
  useEffect(() => () => geo.dispose(), [geo]);
  useEffect(() => () => sparkAudio.stopAll(), []);

  const gap = Math.max(0.05, design.distanceMm / 1000);
  const h = Math.max(model.heightM, tube * 3);

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    scope.kind = "link";
    scope.eta = model.eta;
    scope.k = model.k;
    if (!paused) phase.current += d * Math.min(8, model.f / 40000);
    scope.wt = phase.current;
    const tx = 0.5 + 0.5 * Math.sin(phase.current);
    const rx = tx * Math.min(1, model.k * model.Q * 0.02 + model.k * 3);
    if (a.current) a.current.emissiveIntensity = 0.2 + tx * 1.8;
    if (b.current) b.current.emissiveIntensity = 0.05 + rx * 1.6;
    const tone = 140 + (model.f / 200000) * 220;
    sparkAudio.hum(sound && !paused ? tone * model.eta : 0, sound && !paused && model.eta > 0.05);
    sparkAudio.whirring(0, false);
    sparkAudio.realBps(0, false);
  });

  return (
    <group position={[0, 0.05, 0]}>
      <mesh position={[0, -0.04, 0]}>
        <cylinderGeometry args={[model.radiusM * 1.3, model.radiusM * 1.4, 0.05, 40]} />
        <meshStandardMaterial color="#14161c" metalness={0.4} roughness={0.55} />
      </mesh>
      <mesh geometry={geo} position={[0, 0.02, 0]}>
        <meshStandardMaterial ref={a} color="#b4683c" metalness={1} roughness={0.34} emissive="#d5e4f2" emissiveIntensity={0.4} />
      </mesh>
      <mesh geometry={geo} position={[0, 0.02 + h + gap, 0]}>
        <meshStandardMaterial ref={b} color="#b4683c" metalness={1} roughness={0.34} emissive="#d5e4f2" emissiveIntensity={0.1} />
      </mesh>
      <LinkFlow gap={gap} h={h} />
    </group>
  );
}

function LinkFlow({ gap, h }: { gap: number; h: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const inst = ref.current;
    if (!inst) return;
    const eta = scope.eta;
    const n = 14;
    for (let i = 0; i < n; i++) {
      const u = (scope.wt * 0.15 + i / n) % 1;
      const y = h + gap * u;
      const rad = (1 - eta) * 0.02 + 0.04 + (i % 3) * 0.03;
      const a = i * 1.7;
      dummy.position.set(Math.cos(a) * rad, y, Math.sin(a) * rad);
      dummy.scale.setScalar(eta > 0.04 ? 0.02 + eta * 0.02 : 0.0001);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, 14]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color="#e7f2ff" transparent opacity={0.85} />
    </instancedMesh>
  );
}

const shellVert = /* glsl */ `
  varying vec3 vN;
  varying vec3 vP;
  void main() {
    vN = normalize(normalMatrix * normal);
    vP = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const shellFrag = /* glsl */ `
  varying vec3 vN;
  varying vec3 vP;
  uniform float uN;
  uniform float uTime;
  void main() {
    float lat = asin(clamp(vP.y / length(vP), -1.0, 1.0));
    float zonal = sin(uN * (lat + 1.5707963));
    float fres = pow(1.0 - abs(dot(normalize(vN), vec3(0.0, 0.0, 1.0))), 1.7);
    float pulse = 0.62 + 0.38 * sin(uTime * 0.7);
    float a = (0.05 + 0.5 * abs(zonal) * pulse) * (0.25 + fres);
    gl_FragColor = vec4(vec3(0.74, 0.84, 0.92), a);
  }
`;

export function CavityExhibit() {
  const mode = useLab((s) => s.cavityMode);
  const sound = useLab((s) => s.sound);
  const paused = useLab((s) => s.paused);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uN: { value: mode }, uTime: { value: 0 } },
        vertexShader: shellVert,
        fragmentShader: shellFrag,
      }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  useEffect(() => () => sparkAudio.stopAll(), []);

  const normal = useMemo(() => {
    const lat = (41 * Math.PI) / 180;
    const lon = -0.55;
    return new THREE.Vector3(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)).normalize();
  }, []);
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal), [normal]);
  const time = useRef(0);

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    scope.kind = "cavity";
    scope.mode = mode;
    if (!paused) time.current += d;
    scope.wt = time.current;
    mat.uniforms.uN.value = mode;
    mat.uniforms.uTime.value = time.current;
    const audible = 70 + mode * 8;
    sparkAudio.hum(audible, sound && !paused);
    sparkAudio.whirring(0, false);
    sparkAudio.realBps(0, false);
  });

  const towerPos = normal.clone().multiplyScalar(1.16);

  return (
    <group>
      <mesh>
        <sphereGeometry args={[1.15, 64, 48]} />
        <meshStandardMaterial color="#12151a" roughness={0.88} metalness={0.18} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.158, 28, 18]} />
        <meshBasicMaterial color="#b7c4ce" wireframe transparent opacity={0.14} />
      </mesh>
      <mesh material={mat}>
        <sphereGeometry args={[1.48, 64, 48]} />
      </mesh>
      <group position={towerPos} quaternion={q}>
        <mesh position={[0, 0.16, 0]}>
          <cylinderGeometry args={[0.02, 0.045, 0.32, 8]} />
          <meshStandardMaterial color="#3a342c" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.36, 0]}>
          <sphereGeometry args={[0.07, 20, 16]} />
          <meshStandardMaterial color="#b4683c" metalness={0.85} roughness={0.32} emissive="#d5e4f2" emissiveIntensity={0.35} />
        </mesh>
      </group>
    </group>
  );
}
