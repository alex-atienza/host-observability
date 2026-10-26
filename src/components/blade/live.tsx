"use client";

import * as React from "react";
import type { Projection } from "@/components/iso/iso-kit";
import { useInView, useLoop, useReadout, useStillness, follow } from "@/components/iso/react/live";
import type { FanFace } from "./geometry";
import { spokesOf } from "./spokes";

interface Part {
  name: string;
  detail: string;
}

interface BladeLiveProps {
  art: React.ReactNode;
  fans: FanFace[];
  projection: Projection;
  parts: Record<string, Part>;
  rest: string;
  tour: string[];
  health: "healthy" | "degraded" | "critical";
}

const TOUR_STEP = 2.8;
const SPIN = 7;

// A key on the page can name a group of drawn parts.
const GROUPS: Record<string, string[]> = {
  cpu: ["cpu0", "cpu1", "vrm0", "vrm1"],
  mem: ["mem0", "mem1"],
  fans: ["fans", "fan0", "fan1", "fan2", "fan3", "fan4", "fan5"],
  power: ["power", "psu0", "psu1"],
};
// Big parts everything else sits on: pointing at them names them but dims nothing.
const BACKDROP = new Set(["board", "chassis"]);

export const FOCUS_EVENT = "blade:focus";
export const ACTIVE_EVENT = "blade:active";

const membersOf = (key: string) => GROUPS[key] ?? [key];
const groupOf = (part: string) => (/^(cpu|vrm)\d/.test(part) ? "cpu" : /^mem\d/.test(part) ? "mem" : /^psu\d/.test(part) ? "power" : part);

export function BladeLive({ art, fans, projection, parts, rest, tour, health }: BladeLiveProps) {
  const { anchor, say } = useReadout<SVGGElement>();
  const inView = useInView(anchor);
  const still = useStillness();
  const [hovered, setHovered] = React.useState<string | null>(null);
  const [linked, setLinked] = React.useState<string | null>(null);
  const [touring, setTouring] = React.useState<string | null>(null);
  const state = React.useRef({ angle: 0, speed: 0, clock: 0, step: -1 });
  const spokes = React.useRef<Map<string, SVGPathElement>>(new Map());
  const active = hovered ?? linked ?? touring;

  React.useEffect(() => {
    const root = anchor.current;
    if (!root) return;
    const map = new Map<string, SVGPathElement>();
    root.querySelectorAll<SVGPathElement>("[data-spoke]").forEach((node) => map.set(node.dataset.spoke!, node));
    spokes.current = map;
  }, [anchor]);

  // The page points at parts through a window event, so cards stay server components.
  React.useEffect(() => {
    const onFocus = (event: Event) => setLinked((event as CustomEvent<string | null>).detail);
    window.addEventListener(FOCUS_EVENT, onFocus);
    return () => window.removeEventListener(FOCUS_EVENT, onFocus);
  }, []);

  React.useEffect(() => {
    window.dispatchEvent(new CustomEvent(ACTIVE_EVENT, { detail: hovered }));
  }, [hovered]);

  React.useEffect(() => {
    const root = anchor.current;
    if (!root) return;
    root.querySelectorAll("[data-on]").forEach((node) => node.removeAttribute("data-on"));
    const stage = root.closest(".blade");
    if (active) {
      for (const member of membersOf(active)) root.querySelectorAll(`[data-part="${member}"]`).forEach((node) => node.setAttribute("data-on", ""));
      const pointed = (hovered ?? linked) && !BACKDROP.has(active);
      if (pointed) stage?.setAttribute("data-focus", "");
      else stage?.removeAttribute("data-focus");
      const part = parts[active];
      say(part ? `${part.name} · ${part.detail}` : rest);
    } else {
      stage?.removeAttribute("data-focus");
      say(rest);
    }
  }, [active, hovered, linked, anchor, parts, rest, say]);

  // Fans spin when in view, faster on a host that runs hot; the idle tour walks the parts.
  const target = health === "healthy" ? SPIN : health === "degraded" ? SPIN * 1.8 : SPIN * 2.6;
  useLoop((dt, calm) => {
    const s = state.current;
    s.speed = follow(s.speed, inView && !calm ? target : 0, dt, 0.9, calm);
    s.angle = (s.angle + s.speed * dt) % (Math.PI * 2);
    for (const fan of fans) spokes.current.get(fan.part)?.setAttribute("d", spokesOf(fan, s.angle + fan.cy * 0.05, projection));
    if (!hovered && !linked && !calm && tour.length) {
      s.clock += dt;
      const step = Math.floor(s.clock / TOUR_STEP) % (tour.length + 1);
      if (step !== s.step) {
        s.step = step;
        setTouring(step < tour.length ? tour[step]! : null);
      }
    }
    return inView && !calm ? true : s.speed > 0.01;
  }, inView && !still);

  const pick = (event: React.PointerEvent) => {
    const part = (event.target as Element).closest("[data-part]")?.getAttribute("data-part");
    if (!part) return;
    const key = groupOf(part);
    if (parts[key]) setHovered(key);
  };
  const leave = () => {
    setHovered(null);
    state.current.clock = 0;
    state.current.step = -1;
    setTouring(null);
  };
  const onKey = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") return leave();
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const index = active ? tour.indexOf(active) : -1;
    const next = event.key === "ArrowRight" ? (index + 1) % tour.length : (index - 1 + tour.length) % tour.length;
    setHovered(tour[next]!);
  };

  return (
    <g ref={anchor} className="blade-root" onPointerOver={pick} onPointerLeave={leave} onKeyDown={onKey} onBlur={leave} tabIndex={0} role="group" aria-label="Server parts. Use the arrow keys to step through them.">
      {art}
    </g>
  );
}
