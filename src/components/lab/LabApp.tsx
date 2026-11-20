import { Component, useEffect, useState, type ReactNode } from "react";
import { bindLabPersistence, useLab, type Exhibit } from "@/lib/tesla/store";
import { sparkAudio } from "@/lib/tesla/audio";
import { Header, Panel } from "./Hud";
import { Scope } from "./Scope";

const order: Exhibit[] = ["coil", "magnifier", "motor", "turbine", "link", "cavity"];

export function LabApp() {
  const [Scene, setScene] = useState<null | typeof import("./LabScene").LabScene>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => bindLabPersistence(), []);

  useEffect(() => {
    let live = true;
    void import("./LabScene")
      .then((mod) => {
        if (live) setScene(() => mod.LabScene);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key >= "1" && e.key <= "6") {
        useLab.getState().setExhibit(order[Number(e.key) - 1]);
      } else if (e.key === " ") {
        e.preventDefault();
        useLab.getState().setPaused(!useLab.getState().paused);
      } else if (e.key === "m" || e.key === "M") {
        const next = !useLab.getState().sound;
        if (next) sparkAudio.unlock();
        useLab.getState().setSound(next);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main className="lab">
      <Header />
      <section className="stage">
        <div className="viewport">
          {failed ? (
            <p className="viewport-note">This view has no WebGL. The instruments on the side still run.</p>
          ) : Scene ? (
            <CanvasBoundary>
              <Scene />
            </CanvasBoundary>
          ) : (
            <p className="viewport-note">Raising the hall…</p>
          )}
        </div>
        <p className="look">Drag to orbit. Pinch or scroll to close in.</p>
        <Panel />
      </section>
      <Scope />
    </main>
  );
}

class CanvasBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };

  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }

  render() {
    if (this.state.error) {
      return <p className="viewport-note">The hall failed to draw. The readouts are still live.</p>;
    }
    return this.props.children;
  }
}
