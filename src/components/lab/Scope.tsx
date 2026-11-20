import { useEffect, useRef } from "react";
import { SCHUMANN_MEASURED, schumannIdeal } from "@/lib/tesla/formulas";
import { playback, scope } from "@/lib/tesla/runtime";
import { useLab } from "@/lib/tesla/store";

export function Scope() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frameId = 0;

    const draw = () => {
      frameId = requestAnimationFrame(draw);
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const css = getComputedStyle(document.documentElement);
      const bg = css.getPropertyValue("--bg-elevated").trim() || "#121214";
      const grid = "rgba(242,240,234,0.08)";
      const muted = css.getPropertyValue("--fg-muted").trim() || "#9a978f";
      const pri = css.getPropertyValue("--trace-pri").trim() || "#c4896a";
      const sec = css.getPropertyValue("--trace-sec").trim() || "#d5e4f2";
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = grid;
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        const y = (h * i) / 4;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      const exhibit = useLab.getState().exhibit;
      ctx.font = "11px 'IBM Plex Mono', ui-monospace, monospace";
      ctx.fillStyle = muted;
      if (exhibit === "coil" || exhibit === "magnifier") drawCoil(ctx, w, h, pri, sec, muted);
      else if (exhibit === "motor") drawMotor(ctx, w, h, pri, sec, muted);
      else if (exhibit === "turbine") drawTurbine(ctx, w, h, sec, muted);
      else if (exhibit === "link") drawLink(ctx, w, h, pri, sec, muted);
      else drawCavity(ctx, w, h, sec, muted);
    };
    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <div className="scope">
      <canvas ref={ref} />
    </div>
  );
}

function drawCoil(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pri: string,
  sec: string,
  muted: string,
) {
  const bang = playback.bang;
  const split = Math.floor(w * 0.74);
  ctx.fillStyle = muted;
  ctx.fillText("Primary", 12, 16);
  ctx.fillStyle = sec;
  ctx.fillText("Secondary", 84, 16);
  ctx.fillStyle = muted;
  ctx.fillText("I₁ / I₂", split + 12, 16);
  if (!bang || bang.n < 2) {
    ctx.fillStyle = muted;
    ctx.fillText("Integrating the bang…", 12, h / 2);
    return;
  }
  const n = bang.n;
  if (bang.gap) {
    ctx.fillStyle = "rgba(242,240,234,0.04)";
    for (let i = 0; i < n; i++) {
      if (bang.gap[i]) {
        const x = (i / (n - 1)) * (split - 16);
        ctx.fillRect(8 + x, 22, Math.max(1, (split - 16) / n), h - 32);
      }
    }
  }
  stroke(ctx, pri, (i) => bang.v1[i] / (bang.v1Peak || 1), n, 8, 22, split - 16, h - 36);
  stroke(ctx, sec, (i) => bang.v2[i] / (bang.v2Peak || 1), n, 8, 22, split - 16, h - 36);
  const play = playback.play;
  if (useLab.getState().lens) {
    ctx.strokeStyle = "rgba(242,240,234,0.45)";
    ctx.beginPath();
    const x = 8 + play * (split - 16);
    ctx.moveTo(x, 22);
    ctx.lineTo(x, h - 12);
    ctx.stroke();
  }
  const cx = split + (w - split) / 2;
  const cy = h / 2 + 6;
  const rad = Math.min(w - split, h) * 0.32;
  ctx.strokeStyle = "rgba(242,240,234,0.16)";
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.strokeStyle = sec;
  const step = Math.max(1, Math.floor(n / 280));
  for (let i = 0; i < n; i += step) {
    const x = cx + (bang.i1[i] / (bang.i1Peak || 1)) * rad;
    const y = cy - (bang.i2[i] / (bang.i2Peak || 1)) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawMotor(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pri: string,
  sec: string,
  muted: string,
) {
  const colors = [sec, pri, "rgba(242,240,234,0.55)"];
  ctx.fillStyle = muted;
  ctx.fillText("Phase A    B    C", 12, 16);
  const wt = scope.wt;
  for (let p = 0; p < 3; p++) {
    ctx.beginPath();
    ctx.strokeStyle = colors[p];
    for (let x = 0; x < w - 90; x++) {
      const t = wt + (x / (w - 90)) * Math.PI * 4 - (p * 2 * Math.PI) / 3;
      const y = h / 2 - Math.sin(t) * (h * 0.28);
      if (x === 0) ctx.moveTo(8, y);
      else ctx.lineTo(8 + x, y);
    }
    ctx.stroke();
  }
  const m = useLab.getState().motor;
  const ia = Math.sin(wt);
  const ib = Math.sin(wt - (2 * Math.PI) / 3);
  const ic = Math.sin(wt + (2 * Math.PI) / 3);
  const bx = ia - 0.5 * ib - 0.5 * ic;
  const bz = (Math.sqrt(3) / 2) * ib - (Math.sqrt(3) / 2) * ic;
  const cx = w - 48;
  const cy = h / 2 + 4;
  ctx.strokeStyle = "rgba(242,240,234,0.2)";
  ctx.beginPath();
  ctx.arc(cx, cy, 28, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = sec;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + bx * 16, cy - bz * 16);
  ctx.stroke();
  ctx.fillStyle = muted;
  const nsync = (120 * m.frequencyHz) / m.poles;
  ctx.fillText(`${nsync.toFixed(0)} rpm sync`, w - 118, h - 10);
}

function drawTurbine(ctx: CanvasRenderingContext2D, w: number, h: number, sec: string, muted: string) {
  const s = useLab.getState().turbine;
  ctx.fillStyle = muted;
  ctx.fillText("Fluid speed / disk speed, rim to hub", 12, 16);
  ctx.beginPath();
  ctx.strokeStyle = sec;
  const left = 16;
  const width = w - 32;
  for (let i = 0; i <= 80; i++) {
    const u = i / 80;
    const adhere = 1 - Math.exp(-((1 - u) * 3.2) / Math.max(0.25, scope.ratio || 1));
    const y = h - 18 - adhere * (h - 40);
    const x = left + u * width;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = muted;
  ctx.fillText(`${s.rpm.toFixed(0)} rpm · gap / δ = ${(scope.ratio || 0).toFixed(2)}`, 12, h - 10);
}

function drawLink(ctx: CanvasRenderingContext2D, w: number, h: number, pri: string, sec: string, muted: string) {
  ctx.fillStyle = muted;
  ctx.fillText("Transmit", 12, 16);
  ctx.fillStyle = sec;
  ctx.fillText("Receive", 78, 16);
  const kAmp = Math.min(1, scope.k * 4);
  const wt = scope.wt;
  ctx.beginPath();
  ctx.strokeStyle = pri;
  for (let x = 0; x < w; x++) {
    const y = h / 2 - Math.sin(wt + x * 0.04) * (h * 0.28);
    if (x === 0) ctx.moveTo(0, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.strokeStyle = sec;
  for (let x = 0; x < w; x++) {
    const y = h / 2 - Math.sin(wt + x * 0.04) * (h * 0.28) * kAmp;
    if (x === 0) ctx.moveTo(0, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawCavity(ctx: CanvasRenderingContext2D, w: number, h: number, sec: string, muted: string) {
  const mode = useLab.getState().cavityMode;
  ctx.fillStyle = muted;
  ctx.fillText(`Mode ${mode}  ·  measured ${SCHUMANN_MEASURED[mode - 1]} Hz  ·  scaled cavity ${schumannIdeal(mode).toFixed(2)} Hz`, 12, 16);
  ctx.beginPath();
  ctx.strokeStyle = sec;
  const phase = Math.sin(scope.wt * 0.8);
  for (let x = 0; x < w; x++) {
    const colat = (x / w) * Math.PI;
    const zonal = Math.sin(mode * colat) * phase;
    const y = h / 2 - zonal * (h * 0.28);
    if (x === 0) ctx.moveTo(0, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = muted;
  ctx.fillText("south", 12, h - 8);
  ctx.fillText("north", w - 48, h - 8);
}

function stroke(
  ctx: CanvasRenderingContext2D,
  color: string,
  sample: (i: number) => number,
  n: number,
  x0: number,
  y0: number,
  width: number,
  height: number,
) {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.25;
  const step = Math.max(1, Math.floor(n / 400));
  for (let i = 0; i < n; i += step) {
    const x = x0 + (i / (n - 1)) * width;
    const y = y0 + height / 2 - sample(i) * (height * 0.42);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}
