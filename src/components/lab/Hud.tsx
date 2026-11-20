import { useSyncExternalStore } from "react";
import { Globe, Radio, RotateCw, Waves, Wind, Zap } from "lucide-react";
import {
  analyzeCoil,
  analyzeLink,
  analyzeTurbine,
  fitQuarterWave,
  fmtPct,
  fmtSi,
  quenchAtCrest,
  SCHUMANN_MEASURED,
  schumannIdeal,
  tunePrimary,
  type CoilModel,
} from "@/lib/tesla/formulas";
import { getLive, subscribeLive } from "@/lib/tesla/runtime";
import { coilPresets } from "@/lib/tesla/presets";
import { sparkAudio } from "@/lib/tesla/audio";
import { useLab, type Exhibit } from "@/lib/tesla/store";

const exhibits: { id: Exhibit; label: string; icon: typeof Zap }[] = [
  { id: "coil", label: "Coil", icon: Zap },
  { id: "magnifier", label: "Magnifier", icon: Radio },
  { id: "motor", label: "Motor", icon: RotateCw },
  { id: "turbine", label: "Turbine", icon: Wind },
  { id: "link", label: "Link", icon: Waves },
  { id: "cavity", label: "Cavity", icon: Globe },
];

export function Header() {
  const exhibit = useLab((s) => s.exhibit);
  const setExhibit = useLab((s) => s.setExhibit);
  const lens = useLab((s) => s.lens);
  const sound = useLab((s) => s.sound);
  const paused = useLab((s) => s.paused);
  const setLens = useLab((s) => s.setLens);
  const setSound = useLab((s) => s.setSound);
  const setPaused = useLab((s) => s.setPaused);

  return (
    <header className="topbar">
      <div className="brand">
        <p className="mark">Wardenclyffe</p>
        <p className="sub">Physics laboratory</p>
      </div>
      <div className="tabs" role="tablist" aria-label="Exhibits">
        {exhibits.map((item) => {
          const Icon = item.icon;
          const on = exhibit === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={on}
              className={on ? "tab is-on" : "tab"}
              onClick={() => setExhibit(item.id)}
            >
              <Icon size={15} strokeWidth={1.6} aria-hidden />
              {item.label}
            </button>
          );
        })}
      </div>
      <div className="top-actions">
        <button type="button" className={paused ? "ghost is-on" : "ghost"} onClick={() => setPaused(!paused)}>
          {paused ? "Run" : "Pause"}
        </button>
        <button type="button" className={lens ? "ghost is-on" : "ghost"} onClick={() => setLens(!lens)}>
          Time lens
        </button>
        <button
          type="button"
          className={sound ? "ghost is-on" : "ghost"}
          onClick={() => {
            if (!sound) sparkAudio.unlock();
            setSound(!sound);
          }}
        >
          {sound ? "Sound on" : "Sound"}
        </button>
      </div>
    </header>
  );
}

function useLive() {
  return useSyncExternalStore(subscribeLive, getLive, getLive);
}

export function Panel() {
  const exhibit = useLab((s) => s.exhibit);
  return (
    <aside className="panel">
      {exhibit === "coil" || exhibit === "magnifier" ? <CoilPanel magnifier={exhibit === "magnifier"} /> : null}
      {exhibit === "motor" ? <MotorPanel /> : null}
      {exhibit === "turbine" ? <TurbinePanel /> : null}
      {exhibit === "link" ? <LinkPanel /> : null}
      {exhibit === "cavity" ? <CavityPanel /> : null}
    </aside>
  );
}

function CoilPanel({ magnifier }: { magnifier: boolean }) {
  const coil = useLab((s) => s.coil);
  const setCoil = useLab((s) => s.setCoil);
  const replaceCoil = useLab((s) => s.replaceCoil);
  const model = analyzeCoil(coil);
  const live = useLive();
  const transfer = model.vCeiling > 0 && live.v2Peak > 0 ? live.v2Peak / model.vCeiling : 0;

  return (
    <>
      <div className="readouts">
        <p className="kicker">{magnifier ? "Extra resonator" : "Secondary now"}</p>
        <p className="hero-num">{live.v2Peak > 0 ? fmtSi(live.v2, "V") : "—"}</p>
        <p className="hero-sub">
          Peak {live.v2Peak > 0 ? fmtSi(live.v2Peak, "V") : "—"}
          {" · "}
          ceiling {fmtSi(model.vCeiling, "V")}
          {transfer > 0 ? ` · ${Math.round(transfer * 100)}% of the energy limit` : ""}
        </p>
        <div className="stat-grid">
          <Stat label="Secondary" value={fmtSi(model.f2, "Hz")} />
          <Stat label="Primary" value={fmtSi(model.f1, "Hz")} />
          <Stat label="Detune" value={fmtPct(model.detune)} tone={Math.abs(model.detune) > 0.03 ? "bad" : Math.abs(model.detune) < 0.01 ? "ok" : undefined} />
          <Stat label="k" value={model.k.toFixed(3)} />
          <Stat label="Lower pole" value={fmtSi(model.fLow, "Hz")} />
          <Stat label="Upper pole" value={fmtSi(model.fHigh, "Hz")} />
          <Stat label="Q secondary" value={model.Q2.toFixed(0)} />
          <Stat label="Bang" value={fmtSi(model.bangJ, "J")} />
          <Stat label="Throughput" value={fmtSi(model.powerW, "W")} />
          <Stat label="Freau spark" value={fmtSi(model.freauM, "m")} />
          <Stat label="λ/4 ratio" value={model.quarterWaveRatio.toFixed(2)} />
          <Stat label="Breakout" value={live.v2Peak > model.vOnset ? "yes" : "under Peek"} />
        </div>
        <Energy live={live} />
        <p className="insight">{insight(model, coil.quenchCycles, magnifier, live.v2Peak)}</p>
      </div>

      <div className="row-btns">
        {coilPresets.map((p) => (
          <button key={p.id} type="button" className="chip" onClick={() => replaceCoil({ ...p.coil })}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="row-btns">
        <button type="button" className="ghost" onClick={() => replaceCoil(tunePrimary(coil))}>
          Tune primary
        </button>
        <button type="button" className="ghost" onClick={() => replaceCoil(quenchAtCrest(coil))}>
          Quench at crest
        </button>
        <button type="button" className="ghost" onClick={() => replaceCoil(fitQuarterWave(coil))}>
          Fit λ/4
        </button>
      </div>

      <details open>
        <summary>Resonator</summary>
        <Field label="Diameter" value={coil.secDiameterMm} unit=" mm" min={40} max={800} step={1} onChange={(v) => setCoil({ secDiameterMm: v })} />
        <Field label="Winding height" value={coil.secHeightMm} unit=" mm" min={80} max={2200} step={1} onChange={(v) => setCoil({ secHeightMm: v })} />
        <Field label="Turns" value={coil.secTurns} unit="" min={40} max={2000} step={1} onChange={(v) => setCoil({ secTurns: v })} />
        <Field label="Wire" value={coil.wireMm} unit=" mm" min={0.2} max={2} step={0.05} onChange={(v) => setCoil({ wireMm: v })} />
      </details>
      <details open>
        <summary>Topload</summary>
        <Field label="Outside diameter" value={coil.toroidOuterMm} unit=" mm" min={80} max={2400} step={1} onChange={(v) => setCoil({ toroidOuterMm: v })} />
        <Field label="Tube diameter" value={coil.toroidTubeMm} unit=" mm" min={15} max={500} step={1} onChange={(v) => setCoil({ toroidTubeMm: v })} />
        <Field label="Mounting reduction" value={Math.round(coil.mountingReduction * 100)} unit="%" min={0} max={40} step={1} onChange={(v) => setCoil({ mountingReduction: v / 100 })} />
      </details>
      <details open>
        <summary>Primary and gap</summary>
        <Field label="Inner diameter" value={coil.priInnerMm} unit=" mm" min={50} max={1600} step={1} onChange={(v) => setCoil({ priInnerMm: v })} />
        <Field label="Turns" value={coil.priTurns} unit="" min={1} max={18} step={1} onChange={(v) => setCoil({ priTurns: v })} />
        <Field label="Pitch" value={coil.priPitchMm} unit=" mm" min={4} max={30} step={0.5} onChange={(v) => setCoil({ priPitchMm: v })} />
        <Field label="Cone" value={coil.priConeDeg} unit="°" min={0} max={40} step={1} onChange={(v) => setCoil({ priConeDeg: v })} />
        <Field label="Tank capacitor" value={Number(coil.priCapNf.toFixed(1))} unit=" nF" min={1} max={400} step={0.5} onChange={(v) => setCoil({ priCapNf: v })} />
        <Field label="Gap voltage" value={coil.gapKv} unit=" kV" min={2} max={40} step={0.5} onChange={(v) => setCoil({ gapKv: v })} />
        <Field label="Gap resistance" value={coil.gapOhm} unit=" Ω" min={0.2} max={8} step={0.1} onChange={(v) => setCoil({ gapOhm: v })} />
        <Field label="Quench cycles" value={coil.quenchCycles} unit="" min={1} max={24} step={1} onChange={(v) => setCoil({ quenchCycles: v })} />
        <Field label="Breaks / second" value={coil.bps} unit="" min={30} max={400} step={1} onChange={(v) => setCoil({ bps: v })} />
        <p className="fine">
          Geometry k {model.kGeom.toFixed(3)}. First crest ≈ {model.crestCycles.toFixed(1)} cycles.
        </p>
        <label className="check">
          <input
            suppressHydrationWarning
            type="checkbox"
            checked={coil.kLock != null}
            onChange={(e) => setCoil({ kLock: e.target.checked ? Number(model.kGeom.toFixed(3)) : null })}
          />
          Override k
        </label>
        {coil.kLock != null ? (
          <Field label="Locked k" value={Number(coil.kLock.toFixed(3))} unit="" min={0.03} max={0.55} step={0.005} onChange={(v) => setCoil({ kLock: v })} />
        ) : null}
      </details>
      {model.warnings.length > 0 ? (
        <ul className="warns">
          {model.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}
      {!live.stable && live.v2Peak > 0 ? <p className="warns">The integrator lost this bang. Lower coupling or raise gap resistance.</p> : null}
      <details>
        <summary>How the numbers are made</summary>
        <div className="essay">
          <p>Secondary inductance is Wheeler’s 1928 solenoid. Self-capacitance is the inch fit to Medhurst’s 1947 tables. Toroid capacitance is the Bert Pool form used by Denicolai. The flat primary is Wheeler’s spiral, blended with a short helix when you cone it.</p>
          <p>Coupling is the mutual inductance of coaxial filaments, summed with elliptic integrals, then k = M / √(L₁ L₂). The two poles are the exact lossless resonances of the coupled meshes, not the small-k approximation.</p>
          <p>The waveform is Kirchhoff’s laws on those two meshes, integrated with RK4. The gap opens on a primary current zero after the quench count, and the secondary rings alone. That is the disruptive coil: hand the energy over, then disconnect before it sloshes back.</p>
          <p>Voltage ceiling is √(2E/C₂), every joule of the bang on the topload. Crest over ceiling is how much the lossy, finite-k circuit actually moved. Freau’s spark length, 1.7 √P inches, uses tank throughput as if it were wall power. It is an optimistic coil-builder rule, not a clearance and not a prediction of this waveform.</p>
          <p>Secondary resistance is DC copper, a round-wire skin factor, then ×2.2 for form and proximity. Q is still a ceiling, not a measured coil. Wire drawn on the winding is thicker than the real conductor.</p>
          <p>Study model only. A real coil can kill. Do not use these lengths as approach distance.</p>
        </div>
      </details>
    </>
  );
}

function insight(m: CoilModel, quench: number, magnifier: boolean, v2Peak: number) {
  if (magnifier) {
    if (m.quarterWaveRatio > 1.15) return "The wire is longer than a quarter wave at this frequency. A larger topload lowers the resonance toward λ/4.";
    if (m.quarterWaveRatio < 0.85) return "The topload has pulled the lumped resonance below the wire’s quarter wave. A large terminal does that. It is no longer a pure quarter-wave coil.";
    return "Near a quarter wave of its own wire. A magnifier puts a close-coupled driver under a coil like this, so the voltage rise is on the extra coil.";
  }
  if (Math.abs(m.detune) > 0.03) return "Off tune. The primary kick misses the secondary’s period, and the crest never builds.";
  if (m.vCeiling < m.vOnset) return "Even the entire bang on the topload would sit under breakout. Raise the gap voltage or shrink the toroid.";
  if (v2Peak > 0 && v2Peak < m.vOnset) return "This bang stays under the approximate Peek onset. Corona, not a leader. The toroid is doing its job of holding voltage.";
  if (Math.abs(quench - m.crestCycles) > Math.max(2, m.crestCycles * 0.45)) return "The gap is not opening near the first secondary crest, so energy can slosh back into the primary.";
  return "Tuned, and the gap opens near the first crest. The primary hands the energy over and lets go. That is the disruptive regime.";
}

function MotorPanel() {
  const motor = useLab((s) => s.motor);
  const setMotor = useLab((s) => s.setMotor);
  const nsync = (120 * motor.frequencyHz) / motor.poles;
  const nrotor = nsync * (1 - motor.slip);
  const a = 0.045;
  const torque = motor.slip / (motor.slip * motor.slip + a);
  const torqueMax = 1 / (2 * Math.sqrt(a));
  return (
    <>
      <p className="kicker">Rotating field</p>
      <p className="lede">Two or three currents, out of step in space and in time, make a field that rotates. The rotor follows it. No brushes on the armature.</p>
      <div className="stat-grid">
        <Stat label="Synchronous" value={`${nsync.toFixed(0)} rpm`} />
        <Stat label="Rotor" value={`${nrotor.toFixed(0)} rpm`} />
        <Stat label="Slip" value={fmtPct(motor.slip)} />
        <Stat label="Torque index" value={`${Math.round((torque / torqueMax) * 100)}`} />
      </div>
      <Field label="Frequency" value={motor.frequencyHz} unit=" Hz" min={15} max={120} step={1} onChange={(v) => setMotor({ frequencyHz: v })} />
      <Field label="Slip" value={Number(motor.slip.toFixed(3))} unit="" min={0} max={0.4} step={0.005} onChange={(v) => setMotor({ slip: v })} />
      <div className="seg" role="group" aria-label="Poles">
        {([2, 4, 6] as const).map((p) => (
          <button key={p} type="button" className={motor.poles === p ? "chip is-on" : "chip"} onClick={() => setMotor({ poles: p })}>
            {p} poles
          </button>
        ))}
      </div>
      <p className="fine">Shaft speed is 120 f / poles times (1 − slip). The arrow is the electrical field. Torque index is the shape s / (s² + sₘ²), not a nameplate.</p>
      <details>
        <summary>1888</summary>
        <div className="essay">
          <p>Tesla’s account puts the idea in a Budapest walk in 1882: a magnetic whirl, not a pulsing field that a commutator has to rectify. The motor patent work of 1888 made it a machine. Slip is required. At zero slip the rotor bars see no changing flux, so they carry no current and make no torque.</p>
        </div>
      </details>
    </>
  );
}

function TurbinePanel() {
  const design = useLab((s) => s.turbine);
  const setTurbine = useLab((s) => s.setTurbine);
  const model = analyzeTurbine(design);
  return (
    <>
      <p className="kicker">Boundary layer</p>
      <p className="lede">Smooth disks. No buckets. Viscosity is the blade. Motion on screen is slowed so the spiral can be seen. The numbers are the real rate.</p>
      <div className="stat-grid">
        <Stat label="δ" value={fmtSi(model.deltaM, "m")} />
        <Stat label="Gap / δ" value={model.ratio.toFixed(2)} />
        <Stat label="Adhesion" value={model.adhesion.toFixed(2)} />
        <Stat label="Index" value={model.index.toFixed(2)} />
      </div>
      <Field label="Speed" value={design.rpm} unit=" rpm" min={500} max={30000} step={100} onChange={(v) => setTurbine({ rpm: v })} />
      <Field label="Disks" value={design.disks} unit="" min={4} max={24} step={1} onChange={(v) => setTurbine({ disks: v })} />
      <Field label="Radius" value={design.radiusMm} unit=" mm" min={40} max={300} step={1} onChange={(v) => setTurbine({ radiusMm: v })} />
      <Field label="Gap" value={Number(design.spacingMm.toFixed(2))} unit=" mm" min={0.15} max={4} step={0.05} onChange={(v) => setTurbine({ spacingMm: v })} />
      <div className="seg" role="group" aria-label="Fluid">
        {(["steam", "air", "oil"] as const).map((fluid) => (
          <button key={fluid} type="button" className={design.fluid === fluid ? "chip is-on" : "chip"} onClick={() => setTurbine({ fluid })}>
            {fluid}
          </button>
        ))}
      </div>
      <p className="fine">δ ≈ 3.6 √(ν/ω), a rotating-disk estimate. Best coupling sits near gap ≈ δ. Wider and the core slips. Tighter and shear eats the gain. Disk gaps in the model are opened up so you can see between them.</p>
      <details>
        <summary>1913</summary>
        <div className="essay">
          <p>The bladeless turbine takes fluid in at the rim and lets it spiral toward exhaust ports near the shaft. Momentum crosses the boundary layer instead of hitting a vane. This view is a teaching model of that adhesion, not a CFD solution and not a claim about brake efficiency.</p>
        </div>
      </details>
    </>
  );
}

function LinkPanel() {
  const design = useLab((s) => s.link);
  const setLink = useLab((s) => s.setLink);
  const model = analyzeLink(design);
  return (
    <>
      <p className="kicker">Resonant link</p>
      <p className="lede">Same two resonators as the coil, driven continuously and loaded on purpose. Distance kills k faster than Q can repay.</p>
      <div className="stat-grid">
        <Stat label="k" value={model.k.toFixed(3)} />
        <Stat label="Q" value={model.Q.toFixed(0)} />
        <Stat label="U" value={model.U.toFixed(2)} />
        <Stat label="Best η" value={`${Math.round(model.eta * 100)}%`} />
        <Stat label="L" value={fmtSi(model.L, "H")} />
        <Stat label="Series C" value={fmtSi(model.C, "F")} />
      </div>
      <Field label="Separation" value={design.distanceMm} unit=" mm" min={20} max={900} step={5} onChange={(v) => setLink({ distanceMm: v })} />
      <Field label="Radius" value={design.radiusMm} unit=" mm" min={30} max={400} step={1} onChange={(v) => setLink({ radiusMm: v })} />
      <Field label="Turns" value={design.turns} unit="" min={2} max={40} step={1} onChange={(v) => setLink({ turns: v })} />
      <Field label="Wire" value={design.wireMm} unit=" mm" min={0.4} max={6} step={0.1} onChange={(v) => setLink({ wireMm: v })} />
      <Field label="Frequency" value={design.freqKhz} unit=" kHz" min={20} max={800} step={1} onChange={(v) => setLink({ freqKhz: v })} />
      <p className="fine">U = kQ for identical coils. Optimal efficiency is U² / (1 + √(1+U²))². At U = 1 that is about 17%. At U = 10, about 82%. The tone is a monitor, not the radio frequency.</p>
    </>
  );
}

function CavityPanel() {
  const mode = useLab((s) => s.cavityMode);
  const setMode = useLab((s) => s.setCavityMode);
  const ideal = schumannIdeal(mode);
  const measured = SCHUMANN_MEASURED[mode - 1];
  return (
    <>
      <p className="kicker">Earth–ionosphere cavity</p>
      <p className="lede">A real cavity, a few tens of hertz, continuously rung by lightning. Not a power grid. The tower is about forty thousand times too tall, so it can be seen.</p>
      <div className="stat-grid">
        <Stat label="Mode" value={`${mode}`} />
        <Stat label="Measured" value={`${measured} Hz`} />
        <Stat label="Scaled cavity" value={`${ideal.toFixed(2)} Hz`} />
        <Stat label="Tower" value="57 m" />
      </div>
      <div className="seg" role="group" aria-label="Mode">
        {([1, 2, 3, 4, 5] as const).map((n) => (
          <button key={n} type="button" className={mode === n ? "chip is-on" : "chip"} onClick={() => setMode(n)}>
            {n}
          </button>
        ))}
      </div>
      <div className="essay">
        <p>The scaled series is 7.83 √(n(n+1)/2) Hz, the ideal cavity pulled down so the fundamental matches what is measured. Higher measured peaks sit a little above that, because the ionosphere is not a perfect mirror.</p>
        <p>Wardenclyffe, begun in 1901 at Shoreham and taken down in 1917, was a magnifying transmitter with a tower about 57 m tall under a dome about 21 m across. Tesla’s bet was that the earth could be one conductor of a worldwide system. The station was never finished. Driving a Schumann mode is a different, and much quieter, piece of physics.</p>
      </div>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "bad" }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong className={tone ? `tone-${tone}` : undefined}>{value}</strong>
    </div>
  );
}

function Energy({ live }: { live: ReturnType<typeof useLive> }) {
  const e0 = Math.max(live.e0, 1e-9);
  const bars = [
    { label: "Primary", v: Math.max(0, live.e1) / e0 },
    { label: "Secondary", v: Math.max(0, live.e2) / e0 },
    { label: "Heat", v: Math.max(0, live.ed) / e0 },
  ];
  return (
    <div className="meters">
      {bars.map((b) => (
        <div key={b.label} className="meter">
          <span>{b.label}</span>
          <div className="meter-track">
            <div className="meter-fill" style={{ transform: `scaleX(${Math.min(1, b.v)})` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Field({
  label,
  value,
  unit,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="field">
      <span className="field-top">
        <span>{label}</span>
        <span className="field-value">
          {value}
          {unit}
        </span>
      </span>
      <input
        suppressHydrationWarning
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={`${value}${unit}`}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
