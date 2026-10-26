"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { FleetHost } from "@/lib/fleet";

// Readable HTML on top of the racks: a label per rack (or row) on a leader line, and a
// tooltip for the host under the pointer. Both follow the drawing every frame, so they stay
// put through zoom, pan and the group-by animation.

interface Anchor {
  key: string;
  title: string;
  count: number;
  alerts: number;
  worst: string;
}

const LIFT = 26; // px from the anchor up to the label

function useFrame(run: () => void, active: boolean) {
  const latest = React.useRef(run);
  latest.current = run;
  React.useEffect(() => {
    if (!active) return;
    let id = 0;
    const tick = () => {
      latest.current();
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [active]);
}

function useVisible(ref: React.RefObject<HTMLElement | null>) {
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(([entry]) => setVisible(Boolean(entry?.isIntersecting)));
    io.observe(node);
    return () => io.disconnect();
  }, [ref]);
  return visible;
}

export function RackLabels({ plate, version }: { plate: React.RefObject<HTMLDivElement | null>; version: string }) {
  const [anchors, setAnchors] = React.useState<Anchor[]>([]);
  const nodes = React.useRef(new Map<string, HTMLDivElement>());
  const visible = useVisible(plate);

  // Re-read the anchors whenever the racks change, once React has drawn them.
  React.useEffect(() => {
    const read = () => {
      const list: Anchor[] = [];
      plate.current?.querySelectorAll<SVGCircleElement>("[data-anchor]").forEach((node) => {
        list.push({ key: node.dataset.anchor!, title: node.dataset.title!, count: Number(node.dataset.count), alerts: Number(node.dataset.alerts), worst: node.dataset.worst! });
      });
      setAnchors((prev) => (JSON.stringify(prev) === JSON.stringify(list) ? prev : list));
    };
    read();
    const t1 = window.setTimeout(read, 80);
    const t2 = window.setTimeout(read, 900);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [plate, version]);

  useFrame(() => {
    const host = plate.current;
    const svg = host?.querySelector(".fleet .iso-svg");
    if (!host || !svg) return;
    const box = host.getBoundingClientRect();
    const view = svg.getBoundingClientRect();
    for (const anchor of anchors) {
      const label = nodes.current.get(anchor.key);
      const point = host.querySelector(`[data-anchor="${CSS.escape(anchor.key)}"]`);
      if (!label) continue;
      if (!point) {
        label.style.opacity = "0";
        continue;
      }
      const r = point.getBoundingClientRect();
      const x = r.left - box.left;
      const y = r.top - box.top;
      // Hide a label whose rack is out of view, or whose label would leave the card.
      const inside = r.left >= view.left - 4 && r.left <= view.right + 4 && r.top >= view.top + LIFT + 6 && r.top <= view.bottom;
      const opacity = getComputedStyle(point.closest("g[style]") ?? point).opacity;
      label.style.opacity = inside ? opacity : "0";
      label.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    }
  }, visible && anchors.length > 0);

  return (
    <div className="fleet-labels" aria-hidden="true">
      {anchors.map((anchor) => (
        <div
          key={anchor.key}
          ref={(el) => {
            if (el) nodes.current.set(anchor.key, el);
            else nodes.current.delete(anchor.key);
          }}
          className="fleet-label"
          data-worst={anchor.worst}
        >
          <span className="fleet-label-pill">
            <span className="fleet-label-title">{anchor.title}</span>
            <span className="fleet-label-count">{anchor.count}</span>
            {anchor.alerts ? <span className="fleet-label-alerts">{anchor.alerts}▲</span> : null}
          </span>
          <span className="fleet-label-line" />
        </div>
      ))}
    </div>
  );
}

const HEALTH_TEXT = { healthy: "Healthy", degraded: "Degraded", critical: "Critical" } as const;

export function HostTooltip({ plate, host, hint }: { plate: React.RefObject<HTMLDivElement | null>; host: FleetHost | null; hint: string }) {
  const card = React.useRef<HTMLDivElement>(null);
  const line = React.useRef<HTMLDivElement>(null);
  const visible = useVisible(plate);

  useFrame(() => {
    const root = plate.current;
    const el = card.current;
    if (!root || !el || !host) return;
    const target = root.querySelector(`.fleet-blade[data-host="${host.id}"], .fleet-strip[data-host="${host.id}"]`);
    const svg = root.querySelector(".fleet .iso-svg");
    if (!target || !svg) {
      el.style.opacity = "0";
      return;
    }
    const box = root.getBoundingClientRect();
    const view = svg.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    const inside = r.right >= view.left && r.left <= view.right && r.bottom >= view.top && r.top <= view.bottom;
    // The point on the server the line leads to: the right end of its front panel.
    const ax = r.right - box.left - Math.min(6, r.width * 0.1);
    const ay = r.top + r.height / 2 - box.top;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const gap = 36;
    let left = ax + gap;
    let side = "right";
    if (left + w > box.width - 12) {
      left = r.left - box.left - gap - w;
      side = "left";
    }
    const top = Math.min(Math.max(ay - h / 2, 12), box.height - h - 12);
    el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    el.style.opacity = inside ? "1" : "0";
    el.dataset.side = side;
    if (line.current) {
      const x0 = side === "right" ? ax : r.left - box.left + Math.min(6, r.width * 0.1);
      const x1 = side === "right" ? left : left + w;
      const y1 = top + Math.min(Math.max(ay - top, 14), h - 14);
      const dx = x1 - x0;
      const dy = y1 - ay;
      line.current.style.width = `${Math.hypot(dx, dy)}px`;
      line.current.style.transform = `translate(${Math.round(x0)}px, ${Math.round(ay)}px) rotate(${Math.atan2(dy, dx)}rad)`;
      line.current.style.opacity = inside ? "1" : "0";
    }
  }, visible && host !== null);

  if (!host) return null;
  return (
    <div className="fleet-tip-layer" aria-hidden="true">
      <div ref={line} className="fleet-tip-line" />
      <div ref={card} className="fleet-tip" data-health={host.health}>
        <div className="fleet-tip-host">{host.hostname}</div>
        <div className="fleet-tip-sub">
          {host.service} · {host.instanceType} · {host.region} {host.zone !== host.region ? `· ${host.zone}` : ""}
        </div>
        <div className="fleet-tip-health">
          <span className="fleet-tip-dot" />
          {HEALTH_TEXT[host.health]}
          {host.alerts.length > 1 ? <span className="fleet-tip-more">{host.alerts.length} alerts</span> : null}
        </div>
        {host.alerts.length ? <div className="fleet-tip-alert">{host.alerts.join(" · ")}</div> : null}
        <div className="fleet-tip-bars">
          {(
            [
              ["CPU", host.cpu],
              ["Mem", host.mem],
              ["Disk", host.disk],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="fleet-tip-bar">
              <span>{label}</span>
              <span className="fleet-tip-track">
                <span className={cn("fleet-tip-fill", value >= 85 ? "is-red" : value >= 70 ? "is-amber" : "is-green")} style={{ width: `${value}%` }} />
              </span>
              <span className="fleet-tip-value">{value}%</span>
            </div>
          ))}
        </div>
        <div className="fleet-tip-hint">{hint}</div>
      </div>
    </div>
  );
}
