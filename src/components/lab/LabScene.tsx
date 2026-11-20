import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, ToneMapping } from "@react-three/postprocessing";
import * as THREE from "three";
import { analyzeCoil } from "@/lib/tesla/formulas";
import { simulateBang } from "@/lib/tesla/simulate";
import { emitLive, frame, playback, sampleBang, scope } from "@/lib/tesla/runtime";
import { sparkAudio } from "@/lib/tesla/audio";
import { useLab } from "@/lib/tesla/store";
import { CoilView } from "./CoilView";
import { CavityExhibit, LinkExhibit, MotorExhibit, TurbineExhibit } from "./Machines";

export function LabScene() {
  return (
    <Canvas
      camera={{ position: [1.25, 0.78, 1.5], fov: 30, near: 0.02, far: 80 }}
      dpr={[1, 1.7]}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NoToneMapping;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.setClearColor("#09090b");
      }}
    >
      <World />
    </Canvas>
  );
}

function World() {
  const exhibit = useLab((s) => s.exhibit);
  const coil = useLab((s) => s.coil);
  const link = useLab((s) => s.link);
  const model = useMemo(() => analyzeCoil(coil), [coil]);
  const stage = useMemo(() => {
    if (exhibit === "coil" || exhibit === "magnifier") {
      const span = Math.max(
        model.secHeightM + model.toroidTubeR * 2,
        (model.toroidMajorM + model.toroidTubeR) * 2.2,
        Math.min(model.freauM, 3.2) * 0.85,
        0.7,
      );
      return { span, focusY: model.secHeightM * 0.45, watch: `${exhibit}-${span.toFixed(2)}` };
    }
    if (exhibit === "link") {
      const span = Math.max(1.1, link.distanceMm / 1000 + 0.9);
      return { span, focusY: span * 0.35, watch: `link-${span.toFixed(2)}` };
    }
    if (exhibit === "cavity") return { span: 4.4, focusY: 0.15, watch: "cavity" };
    if (exhibit === "turbine") return { span: 1.55, focusY: 0.2, watch: "turbine" };
    return { span: 1.85, focusY: 0.2, watch: "motor" };
  }, [exhibit, model, link.distanceMm]);

  return (
    <>
      <color attach="background" args={["#09090b"]} />
      <fog attach="fog" args={["#09090b", Math.max(3.2, stage.span * 2.4), Math.max(14, stage.span * 8)]} />
      <hemisphereLight args={["#c5ced8", "#14120f", 0.38]} />
      <directionalLight position={[3.2, 5.4, 2.4]} intensity={2.4} color="#d5dde6" />
      <directionalLight position={[-2.4, 1.6, -2]} intensity={0.45} color="#8d7568" />
      <Floor radius={Math.max(2.4, stage.span * 1.8)} />
      {(exhibit === "coil" || exhibit === "magnifier") && (
        <>
          <CoilEngine model={model} quench={coil.quenchCycles} bps={coil.bps} />
          <CoilView model={model} />
        </>
      )}
      {exhibit === "motor" && <MotorExhibit />}
      {exhibit === "turbine" && <TurbineExhibit />}
      {exhibit === "link" && <LinkExhibit />}
      {exhibit === "cavity" && <CavityExhibit />}
      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI / 2.02}
        minDistance={0.25}
        maxDistance={28}
        zoomSpeed={0.7}
      />
      <CameraFit span={stage.span} focusY={stage.focusY} watch={stage.watch} />
      <EffectComposer multisampling={0} frameBufferType={THREE.HalfFloatType} enableNormalPass={false}>
        <Bloom intensity={1.15} luminanceThreshold={0.58} luminanceSmoothing={0.22} mipmapBlur radius={0.72} />
        <Vignette offset={0.18} darkness={0.62} />
        <ToneMapping />
      </EffectComposer>
    </>
  );
}

function CoilEngine({ model, quench, bps }: { model: ReturnType<typeof analyzeCoil>; quench: number; bps: number }) {
  const lens = useLab((s) => s.lens);
  const paused = useLab((s) => s.paused);
  const sound = useLab((s) => s.sound);
  useEffect(() => {
    playback.bang = simulateBang(model, quench);
    playback.play = 0;
    playback.flash = 0;
    frame.vOnset = model.vOnset;
    sampleBang(0);
    emitLive(performance.now() / 1000);
  }, [model, quench]);
  useEffect(() => () => sparkAudio.stopAll(), []);

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    scope.kind = "coil";
    scope.lens = lens;
    if (!paused) {
      playback.play += d / 1.75;
      if (playback.play >= 1) {
        playback.play -= 1;
        playback.fire += 1;
        if (lens && sound) sparkAudio.lensCrack(true);
      }
      if (!lens) {
        playback.strobe += d * Math.max(1, bps);
        while (playback.strobe >= 1) {
          playback.strobe -= 1;
          playback.fire += 1;
          playback.flash = 1;
        }
        playback.flash *= Math.exp(-d * 7);
      }
      sampleBang(playback.play);
      const onset = model.vOnset;
      const peak = Math.max(frame.v2Peak, 1);
      if (lens) {
        frame.breakout = Math.max(0, (Math.abs(frame.v2) - onset) / peak);
        frame.corona = Math.min(1.2, Math.abs(frame.v2) / Math.max(onset, 1));
      } else {
        frame.breakout = peak > onset ? playback.flash : 0;
        frame.corona = Math.min(1, peak / Math.max(onset, 1)) * (0.3 + 0.7 * playback.flash);
        frame.flash = playback.flash;
      }
    }
    sparkAudio.realBps(bps, sound && !paused && !lens);
    sparkAudio.hum(0, false);
    sparkAudio.whirring(0, false);
    emitLive(performance.now() / 1000);
  });
  return null;
}

function Floor({ radius }: { radius: number }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.062, 0]}>
        <circleGeometry args={[radius, 80]} />
        <meshStandardMaterial color="#101218" metalness={0.48} roughness={0.46} />
      </mesh>
      {[0.28, 0.52, 0.78].map((t) => (
        <mesh key={t} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]}>
          <ringGeometry args={[radius * t, radius * t + Math.max(0.004, radius * 0.0025), 80]} />
          <meshBasicMaterial color="#8e97a3" transparent opacity={0.22} />
        </mesh>
      ))}
    </group>
  );
}

function CameraFit({ span, focusY, watch }: { span: number; focusY: number; watch: string }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as {
    target: THREE.Vector3;
    update: () => void;
    addEventListener: (type: string, cb: () => void) => void;
    removeEventListener: (type: string, cb: () => void) => void;
  } | null;
  const start = useRef(new THREE.Vector3());
  const startT = useRef(new THREE.Vector3());
  const desired = useRef(new THREE.Vector3());
  const focus = useRef(new THREE.Vector3());
  const anim = useRef(1);

  useEffect(() => {
    const dist = Math.max(0.9, span * 1.62);
    desired.current.set(dist * 0.7, focusY + dist * 0.16, dist * 0.95);
    focus.current.set(0, focusY, 0);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!controls) return;
    if (reduce) {
      camera.position.copy(desired.current);
      controls.target.copy(focus.current);
      controls.update();
      anim.current = 1;
      return;
    }
    start.current.copy(camera.position);
    startT.current.copy(controls.target);
    anim.current = 0;
  }, [watch, span, focusY, camera, controls]);

  useEffect(() => {
    if (!controls) return;
    const stop = () => {
      anim.current = 1;
    };
    controls.addEventListener("start", stop);
    return () => controls.removeEventListener("start", stop);
  }, [controls]);

  useFrame((_, dt) => {
    if (!controls || anim.current >= 1) return;
    anim.current = Math.min(1, anim.current + Math.min(dt, 0.05) / 0.7);
    const k = 1 - (1 - anim.current) ** 2;
    camera.position.lerpVectors(start.current, desired.current, k);
    controls.target.lerpVectors(startT.current, focus.current, k);
    controls.update();
  });
  return null;
}
