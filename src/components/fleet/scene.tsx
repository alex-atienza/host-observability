"use client";

import * as React from "react";
import { AnimatePresence, MotionConfig, animate, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { Dots, FaceText, Line, Solid } from "@/components/iso/react/draw";
import { useReadout } from "@/components/iso/react/live";
import { useCamera, type FleetCamera } from "./camera";
import { axisVector, cylinder, fitProjection, iso, pathOf, sideMatrix, slabOf, type Flat, type Plan, type Point3, type Projection } from "@/components/iso/iso-kit";
import type { FleetHost, Region } from "@/lib/fleet";
import type { Health } from "@/lib/hosts";

// Racks of 1U blades seen from the front. Every rack and every blade has the same shape,
// so each is drawn once at the origin and placed with a screen translate: a projection is
// linear, so moving the drawing by the projected world offset is exact. That is what lets
// blades fly between racks when the grouping changes.
// World: x runs along the row of racks, y from a rack's back (0) to its front, z up.

export const WIDTH = 960;
export const HEIGHT = 440;
const AZIMUTH = 66;
const ELEVATION = 22;

const RACK_W = 56;
const DEPTH = 44;
const GAP = 22;
const PITCH = RACK_W + GAP;
const POST = 5;
const U = 4.6;
export const SLOTS = 20;
const PLINTH = 6;
const CAP = 7;
const TOP = PLINTH + SLOTS * U;
const LIP = 1.2;
const PULL = 30; // how far a blade comes out of the rack to travel
const BEACON_R = 3.2;

export type GroupBy = "region" | "provider" | "service" | "health";

export const GROUP_LABEL: Record<GroupBy, string> = { region: "Region", provider: "Cloud", service: "Service", health: "Health" };

const SEVERITY: Record<Health, number> = { critical: 0, degraded: 1, healthy: 2 };

interface Rack {
  key: string;
  label: string;
  part: string;
  hosts: FleetHost[];
  worst: Health;
  alerts: number;
}

export function racksFor(hosts: FleetHost[], regions: Region[], by: GroupBy): Rack[] {
  const groups = new Map<string, FleetHost[]>();
  const keyOf = (h: FleetHost) => (by === "region" ? h.region : by === "provider" ? h.provider : by === "service" ? h.service : h.health);
  for (const host of hosts) {
    const key = keyOf(host);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(host);
  }
  const order =
    by === "region"
      ? regions.map((r) => r.id)
      : by === "provider"
        ? ["aws", "azure", "gcp"]
        : by === "health"
          ? ["critical", "degraded", "healthy"]
          : [...groups.keys()].sort();
  const regionIndex = new Map(regions.map((r, i) => [r.id, i]));
  const racks: Rack[] = [];
  for (const key of order) {
    const members = (groups.get(key) ?? []).slice().sort((a, b) => {
      if (by !== "health" && SEVERITY[a.health] !== SEVERITY[b.health]) return SEVERITY[b.health] - SEVERITY[a.health];
      return (regionIndex.get(a.region)! - regionIndex.get(b.region)!) || a.zone.localeCompare(b.zone) || a.hostname.localeCompare(b.hostname);
    });
    if (!members.length) continue;
    const parts = Math.ceil(members.length / SLOTS);
    for (let p = 0; p < parts; p++) {
      const chunk = members.slice(p * SLOTS, p * SLOTS + SLOTS);
      racks.push({
        key: `${key}#${p}`,
        label: by === "provider" ? key.toUpperCase() : key,
        part: parts > 1 ? `${p + 1}/${parts}` : "",
        hosts: chunk,
        worst: chunk.reduce<Health>((w, h) => (SEVERITY[h.health] < SEVERITY[w] ? h.health : w), "healthy"),
        alerts: chunk.filter((h) => h.health !== "healthy").length,
      });
    }
  }
  return racks;
}

const box = (x0: number, y0: number, x1: number, y1: number): Plan => ({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: 0.3 });
const round = (v: number) => Math.round(v * 100) / 100;
const join = (paths: string[]) => paths.filter(Boolean).join("");

function projectionFor(maxRacks: number) {
  const span = maxRacks * RACK_W + (maxRacks - 1) * GAP;
  const corners: Point3[] = [];
  for (const x of [-2, span + 2]) for (const y of [-2, DEPTH + LIP + 2]) for (const z of [-2, TOP + CAP + 5]) corners.push([x, y, z]);
  return fitProjection(corners, WIDTH, HEIGHT, { pad: 26, azimuth: AZIMUTH, elevation: ELEVATION });
}

const TILE = PITCH / 2; // raised-floor tiles, so racks land on tile edges

// The raised floor the racks stand on: a tile grid with a hot-aisle strip behind the row.
function floorFor(P: Projection, maxRacks: number) {
  const at = (p: Point3) => iso(p, P);
  const span = maxRacks * RACK_W + (maxRacks - 1) * GAP;
  // Far past the racks in every direction, so the floor fills the card at any zoom or pan.
  const reach = TILE * 40;
  const x0 = -reach;
  const x1 = span + reach;
  const y0 = -reach;
  const y1 = DEPTH + reach;
  const grid: string[] = [];
  for (let x = x0; x <= x1 + 0.1; x += TILE) grid.push(pathOf([at([x, y0, 0]), at([x, y1, 0])]));
  for (let y = y0; y <= y1 + 0.1; y += TILE) grid.push(pathOf([at([x0, y, 0]), at([x1, y, 0])]));
  // Hot aisle behind the row: a containment strip along the floor.
  const hot = pathOf([at([-6, -10, 0]), at([span + 6, -10, 0]), at([span + 6, -10 - TILE * 0.6, 0]), at([-6, -10 - TILE * 0.6, 0])], true);
  const centre = at([span / 2, DEPTH / 2, 0]);
  return { grid: grid.join(""), hot, centre, span };
}

// Every static path, built once for the projection.
function shapesFor(P: Projection) {
  const at = (p: Point3) => iso(p, P);
  const seg = (a: Point3, b: Point3) => pathOf([at(a), at(b)]);
  const slab = (plan: Plan, z: number, h: number, steps = 1, bevel = 0) => slabOf(plan, z, h, P, steps, bevel);
  const faceRect = (y: number, x0: number, z0: number, x1: number, z1: number) => pathOf([at([x0, y, z0]), at([x1, y, z0]), at([x1, y, z1]), at([x0, y, z1])], true);
  const x0 = 0;
  const x1 = RACK_W;
  const inner0 = POST;
  const inner1 = RACK_W - POST;
  const front = DEPTH + LIP;

  const plinth = box(x0 - 1, -1, x1 + 1, DEPTH + 1);
  const plinthSlots: string[] = [];
  for (let x = x0 + 6; x <= x1 - 6; x += 4) plinthSlots.push(faceRect(DEPTH + 1, x, 1.6, x + 1.6, PLINTH - 1.6));
  const holes: Flat[] = [];
  for (let k = 0; k < SLOTS; k++) for (const z of [0.9, U / 2, U - 0.9]) holes.push(at([x0 + POST / 2, DEPTH, PLINTH + k * U + z]));
  const vents: string[] = [];
  for (let z = PLINTH + 8; z < TOP - 7; z += 3.2) vents.push(pathOf([at([x1, DEPTH - 29, z]), at([x1, DEPTH - 7, z]), at([x1, DEPTH - 7, z + 1.1]), at([x1, DEPTH - 29, z + 1.1])], true));
  const blankVents: Flat[] = [];
  for (let x = inner0 + 6; x < inner1 - 4; x += 3) blankVents.push(at([x, front, PLINTH + U / 2]));

  const face = faceRect(front, inner0 + 2.2, PLINTH + 0.7, inner1 - 7, PLINTH + U - 0.7);
  const led = at([inner1 - 3.6, front, PLINTH + U / 2]);
  const bx = (x0 + x1) / 2;
  const by = DEPTH - 8;
  return {
    rack: {
      halo: slab(plinth, -2, 2).fill,
      feet: [
        [x0 + 4, 4],
        [x1 - 4, 4],
        [x0 + 4, DEPTH - 4],
        [x1 - 4, DEPTH - 4],
      ].map(([fx, fy]) => cylinder(fx!, fy!, 2.2, -2, 2, P, 16)),
      plinth: slab(plinth, 0, PLINTH, 2, 0.5),
      plinthSlots: join(plinthSlots),
      back: slab(box(inner0, 0, inner1, 2), PLINTH, SLOTS * U),
      left: slab(box(x0, 0, inner0, DEPTH), PLINTH, SLOTS * U, 1, 0.4),
      holes,
      right: slab(box(inner1, 0, x1, DEPTH), PLINTH, SLOTS * U, 1, 0.4),
      vents: join(vents),
      ventFrame: pathOf([at([x1, DEPTH - 32, PLINTH + 6]), at([x1, DEPTH - 4, PLINTH + 6]), at([x1, DEPTH - 4, TOP - 4]), at([x1, DEPTH - 32, TOP - 4])], true),
      cap: slab(box(x0, 0, x1, DEPTH), TOP, CAP, 1, 0.5),
      plate: faceRect(DEPTH, x0 + 4, TOP + 1.4, x1 - 4, TOP + CAP - 1.4),
      label: sideMatrix([x0 + 6, DEPTH], TOP + CAP - 2.6, P, "left"),
      count: sideMatrix([x1 - 6, DEPTH], TOP + CAP - 2.6, P, "left"),
      beaconBase: cylinder(bx, by, BEACON_R + 1, TOP + CAP, 1.2, P, 24),
      beacon: cylinder(bx, by, BEACON_R, TOP + CAP + 1.2, 3.6, P, 28),
      beaconGlow: at([bx, by, TOP + CAP + 3.4]),
    },
    blank: {
      plate: slab(box(inner0 + 0.3, DEPTH - 0.4, inner1 - 0.3, front), PLINTH + 0.15, U - 0.3),
      vents: blankVents,
    },
    blade: {
      // The body only shows while a blade is out of its rack.
      body: slab(box(inner0 + 0.6, DEPTH - 34, inner1 - 0.6, DEPTH - 0.4), PLINTH + 0.4, U - 0.8),
      plate: slab(box(inner0 + 0.3, DEPTH - 0.4, inner1 - 0.3, front), PLINTH + 0.15, U - 0.3),
      face,
      handle: seg([inner0 + 1.2, front, PLINTH + 1.1], [inner0 + 1.2, front, PLINTH + U - 1.1]),
      handleEnds: [at([inner0 + 1.2, front, PLINTH + 1.1]), at([inner0 + 1.2, front, PLINTH + U - 1.1])],
      ears: [at([inner0 + 0.9, front, PLINTH + U / 2]), at([inner1 - 0.9, front, PLINTH + U / 2])],
      led,
    },
  };
}

type Shapes = ReturnType<typeof shapesFor>;

export type { FleetCamera } from "./camera";

const MAX_ZOOM = 6;

interface SceneProps {
  camera?: React.MutableRefObject<FleetCamera | null>;
  onZoom?: (zoom: number) => void;
  hosts: FleetHost[];
  regions: Region[];
  groupBy: GroupBy;
  shown: Set<string>;
  shade: "cpu" | "mem" | "disk";
  rest: string;
  focus: string | null;
  onPoint: (id: string | null) => void;
}

const FLIGHT = 1.25;

export function FleetScene({ camera, onZoom, hosts, regions, groupBy, shown, shade, rest, focus, onPoint }: SceneProps) {
  const { anchor, say } = useReadout<SVGGElement>();
  const router = useRouter();
  const [hovered, setHovered] = React.useState<string | null>(null);

  // One projection for every grouping, so the scale never jumps.
  const maxRacks = React.useMemo(() => Math.max(...(["region", "provider", "service", "health"] as GroupBy[]).map((by) => racksFor(hosts, regions, by).length)), [hosts, regions]);
  const P = React.useMemo(() => projectionFor(maxRacks), [maxRacks]);
  const shapes = React.useMemo(() => shapesFor(P), [P]);
  const floor = React.useMemo(() => floorFor(P, maxRacks), [P, maxRacks]);
  const ids = React.useId().replace(/:/g, "");
  const ex = React.useMemo(() => axisVector(P, [1, 0, 0]), [P]);
  const ey = React.useMemo(() => axisVector(P, [0, 1, 0]), [P]);
  const ez = React.useMemo(() => axisVector(P, [0, 0, 1]), [P]);
  const offset = (x: number, y: number, z: number): Flat => [round(ex[0] * x + ey[0] * y + ez[0] * z), round(ex[1] * x + ey[1] * y + ez[1] * z)];

  const racks = React.useMemo(() => racksFor(hosts, regions, groupBy), [hosts, regions, groupBy]);
  const rowStart = ((maxRacks - racks.length) / 2) * PITCH;
  const rackAt = (index: number) => offset(rowStart + index * PITCH, 0, 0);

  // Where each blade goes: its rack and slot, painted rack by rack, bottom to top.
  const placed = React.useMemo(() => {
    const out: Array<{ host: FleetHost; rack: number; slot: number }> = [];
    racks.forEach((rack, r) => rack.hosts.forEach((host, slot) => out.push({ host, rack: r, slot })));
    return out;
  }, [racks]);

  const byId = React.useMemo(() => new Map(hosts.map((h) => [h.id, h])), [hosts]);
  const active = hovered ?? focus;

  React.useEffect(() => {
    const host = active ? byId.get(active) : undefined;
    say(host ? `${host.hostname} · ${host.instanceType} · CPU ${host.cpu}% · mem ${host.mem}% · ${host.health}` : rest);
  }, [active, byId, rest, say]);
  React.useEffect(() => onPoint(hovered), [hovered, onPoint]);

  const bladeNodes = React.useRef(new Map<string, SVGGElement>());
  const open = (id: string) => {
    const node = bladeNodes.current.get(id);
    const spot = placed.find((p) => p.host.id === id);
    if (node && spot) {
      node.setAttribute("data-out", "");
      const [x, y] = offset(rowStart + spot.rack * PITCH, PULL * 0.8, spot.slot * U);
      animate(node, { x, y }, { duration: 0.3, ease: [0.32, 0.72, 0, 1] });
    }
    window.setTimeout(() => router.push(`/hosts/${id}`), node ? 300 : 0);
  };

  const { camNode, dragged, zoomAt, fit, zoomToBox } = useCamera({ anchor, width: WIDTH, height: HEIGHT, maxZoom: MAX_ZOOM, onZoom });
  const zoomToRack = (index: number) => {
    const [ox, oy] = rackAt(index);
    const corners: Flat[] = [];
    for (const x of [0, RACK_W]) for (const y of [0, DEPTH + LIP]) for (const z of [-2, TOP + CAP + 5]) {
      const [sx, sy] = offset(x, y, z);
      corners.push([sx + ox + P.origin[0], sy + oy + P.origin[1]]);
    }
    const xs = corners.map(([x]) => x);
    const ys = corners.map(([, y]) => y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    zoomToBox(x0, y0, x1, y1, 0.82);
  };

  React.useEffect(() => {
    if (!camera) return;
    camera.current = { zoomBy: (factor) => zoomAt(WIDTH / 2, HEIGHT / 2, factor, true), fit };
    return () => {
      camera.current = null;
    };
  }, [camera, zoomAt, fit]);

  // A new grouping moves every rack, so the view goes back to the whole row.
  const firstGroup = React.useRef(true);
  React.useEffect(() => {
    if (firstGroup.current) {
      firstGroup.current = false;
      return;
    }
    fit();
  }, [groupBy, fit]);


  const idOf = (event: React.SyntheticEvent) => (event.target as Element).closest("[data-host]")?.getAttribute("data-host") ?? null;
  const onKey = (event: React.KeyboardEvent) => {
    const list = placed.map((p) => p.host.id).filter((id) => shown.has(id));
    if (event.key === "Enter" && active) return open(active);
    if (event.key === "Escape") return setHovered(null);
    if (event.key === "+" || event.key === "=") return zoomAt(WIDTH / 2, HEIGHT / 2, 1.5, true);
    if (event.key === "-" || event.key === "_") return zoomAt(WIDTH / 2, HEIGHT / 2, 1 / 1.5, true);
    if (event.key === "0") return fit();
    if (!list.length) return;
    const step = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const index = active ? list.indexOf(active) : -1;
    setHovered(list[(index + step + list.length) % list.length]!);
  };

  return (
    <MotionConfig reducedMotion="user">
      <g
        ref={anchor}
        className="fleet-root"
        data-shade={shade}
        tabIndex={0}
        role="group"
        aria-label="Hosts in racks. Arrow keys step through hosts, Enter opens one, plus and minus zoom, 0 fits the row."
        onPointerOver={(event) => setHovered(idOf(event))}
        onPointerLeave={() => setHovered(null)}
        onClick={(event) => {
          if (dragged.current) {
            dragged.current = false;
            return;
          }
          const plate = (event.target as Element).closest("[data-rack]")?.getAttribute("data-rack");
          if (plate) return zoomToRack(Number(plate));
          const id = idOf(event);
          if (id && shown.has(id)) open(id);
        }}
        onKeyDown={onKey}
        onBlur={() => setHovered(null)}
      >
        <rect key="catch" className="fleet-catch" width={WIDTH} height={HEIGHT} />
        <g key="camera" ref={camNode} className="fleet-camera">
        <Floor floor={floor} ids={ids} />
        {/* Rack bodies, with blanking panels in the free slots. */}
        <g key="bodies">
          <AnimatePresence initial={false}>
            {racks.map((rack, index) => {
              const [x, y] = rackAt(index);
              return (
                <motion.g key={`body${index}`} initial={{ opacity: 0, x, y }} animate={{ opacity: 1, x, y }} exit={{ opacity: 0 }} transition={{ duration: 0.5, delay: 0.25 }}>
                  <RackBody shapes={shapes} free={SLOTS - rack.hosts.length} offset={offset} />
                </motion.g>
              );
            })}
          </AnimatePresence>
        </g>

        {/* Blades. Each flies out, along and back in when its place changes. */}
        <g key="blades">
          {placed.map(({ host, rack, slot }, order) => (
            <Blade
              key={host.id}
              host={host}
              shapes={shapes}
              to={offset(rowStart + rack * PITCH, 0, slot * U)}
              pull={offset(0, PULL, 0)}
              delay={order * 0.006}
              dim={!shown.has(host.id)}
              on={active === host.id}
              register={(node) => {
                if (node) bladeNodes.current.set(host.id, node);
                else bladeNodes.current.delete(host.id);
              }}
            />
          ))}
        </g>

        {/* Caps above everything, so the top blade tucks under its rack's cap. */}
        <g key="caps">
          <AnimatePresence initial={false}>
            {racks.map((rack, index) => {
              const [x, y] = rackAt(index);
              return (
                <motion.g key={`cap${index}`} initial={{ opacity: 0, x, y }} animate={{ opacity: 1, x, y }} exit={{ opacity: 0 }} transition={{ duration: 0.5, delay: 0.25 }}>
                  <RackCap shapes={shapes} rack={rack} index={index} />
                </motion.g>
              );
            })}
          </AnimatePresence>
        </g>
        </g>
      </g>
    </MotionConfig>
  );
}

type FloorShapes = ReturnType<typeof floorFor>;

// The floor fades out toward the card's edges, and a slow scan band runs across it.
function Floor({ floor, ids }: { floor: FloorShapes; ids: string }) {
  return (
    <g className="fleet-floor" aria-hidden="true">
      <defs>
        <linearGradient id={`${ids}band`} gradientUnits="objectBoundingBox" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`${ids}scan`} maskUnits="userSpaceOnUse" x={-WIDTH} y={-HEIGHT} width={WIDTH * 3} height={HEIGHT * 3}>
          <rect className="fleet-scan" x={-WIDTH * 0.2} y={-HEIGHT} width={WIDTH * 0.2} height={HEIGHT * 3} fill={`url(#${ids}band)`} />
        </mask>
      </defs>
      <g>
        <Line d={floor.grid} tone="faint" free />
        <g mask={`url(#${ids}scan)`}>
          <path className="fleet-floor-scanlines" d={floor.grid} />
        </g>
      </g>
    </g>
  );
}

function RackBody({ shapes, free, offset }: { shapes: Shapes; free: number; offset: (x: number, y: number, z: number) => Flat }) {
  const s = shapes.rack;
  const blanks: React.ReactNode[] = [];
  for (let k = SLOTS - free; k < SLOTS; k++) {
    const [x, y] = offset(0, 0, k * U);
    blanks.push(
      <g key={k} className="fleet-blank" transform={`translate(${x} ${y})`}>
        <Solid paths={shapes.blank.plate} tone="faint" crease="none" />
        <Dots points={shapes.blank.vents} size={0.3} tone="faint" />
      </g>,
    );
  }
  return (
    <>
      <path className="iso-halo" d={s.halo} />
      {s.feet.map((paths, k) => (
        <Solid key={k} paths={paths} tone="lo" crease="none" />
      ))}
      <Solid paths={s.plinth} tone="mid" />
      <Line d={s.plinthSlots} tone="lo" />
      <Solid paths={s.back} tone="lo" crease="none" />
      <Solid paths={s.left} tone="mid" />
      <Dots points={s.holes} size={0.32} tone="lo" />
      <Solid paths={s.right} tone="mid" />
      <Line d={s.vents} tone="lo" />
      <Line d={s.ventFrame} tone="faint" />
      {blanks}
    </>
  );
}

function RackCap({ shapes, rack, index }: { shapes: Shapes; rack: Rack; index: number }) {
  const s = shapes.rack;
  const [gx, gy] = s.beaconGlow;
  return (
    <g className="fleet-cap" data-worst={rack.worst}>
      <g data-rack={index} className="fleet-plate">
        <Solid paths={s.cap} tone="mid" />
        <Line d={s.plate} tone="lo" />
      <FaceText transform={s.label} size={3.1} tone="hi">
        {rack.label}
        {rack.part ? <tspan className="fleet-part">{` ${rack.part}`}</tspan> : null}
      </FaceText>
      <FaceText transform={s.count} size={2.7} tone="mid" anchor="end">
        {rack.alerts ? <tspan className="fleet-alerts">{`${rack.alerts}▲ `}</tspan> : null}
        {`${rack.hosts.length}`}
      </FaceText>
      </g>
      {/* Beacon: lit when any host in the rack needs attention. */}
      <g className="fleet-beacon" data-worst={rack.worst}>
        <Solid paths={s.beaconBase} tone="mid" />
        <ellipse className="fleet-beacon-glow" cx={round(gx)} cy={round(gy)} rx={9} ry={7} />
        <Solid paths={s.beacon} tone="hi" />
      </g>
    </g>
  );
}

interface BladeProps {
  host: FleetHost;
  shapes: Shapes;
  to: Flat;
  pull: Flat;
  delay: number;
  dim: boolean;
  on: boolean;
  register: (node: SVGGElement | null) => void;
}

function Blade({ host, shapes, to, pull, delay, dim, on, register }: BladeProps) {
  const node = React.useRef<SVGGElement | null>(null);
  const last = React.useRef<Flat | null>(null);
  const b = shapes.blade;
  const [lx, ly] = b.led;
  const style = { "--cpu": host.cpu / 100, "--mem": host.mem / 100, "--disk": host.disk / 100 } as React.CSSProperties;
  const [tx, ty] = to;

  // First paint lands in place; after that, a change of place is a flight: pull out,
  // travel in front of the racks, push back in. It starts from wherever the blade is now.
  const plan = React.useMemo(() => {
    const prev = last.current;
    if (!prev || (prev[0] === tx && prev[1] === ty)) return { moved: false, target: { x: tx, y: ty } };
    return {
      moved: true,
      target: { x: [null, prev[0] + pull[0], tx + pull[0], tx], y: [null, prev[1] + pull[1], ty + pull[1], ty] },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx, ty]);
  React.useEffect(() => {
    last.current = [tx, ty];
  }, [tx, ty]);
  const moved = plan.moved;
  const animateTo = plan.target as { x: number | Array<number | null>; y: number | Array<number | null> };

  return (
    <motion.g
      ref={(el: SVGGElement | null) => {
        node.current = el;
        register(el);
      }}
      className="fleet-blade"
      data-host={host.id}
      data-health={host.health}
      data-dim={dim ? "" : undefined}
      data-on={on ? "" : undefined}
      style={style}
      initial={{ x: to[0], y: to[1] }}
      animate={animateTo}
      transition={moved ? { duration: FLIGHT, times: [0, 0.22, 0.78, 1], ease: ["easeOut", "easeInOut", "easeIn"], delay } : { duration: 0 }}
      onAnimationStart={() => moved && node.current?.setAttribute("data-out", "")}
      onAnimationComplete={() => node.current?.removeAttribute("data-out")}
    >
      <g className="fleet-body">
        <Solid paths={b.body} tone="mid" />
      </g>
      <Solid paths={b.plate} tone="mid" crease="faint" />
      <path className="fleet-face" d={b.face} />
      <path className="fleet-glow" d={b.face} />
      <Line d={b.face} tone="lo" />
      <Line d={b.handle} tone="mid" />
      <Dots points={b.handleEnds} size={0.3} tone="mid" />
      <Dots points={b.ears} size={0.35} tone="mid" />
      <circle className="fleet-led" cx={round(lx)} cy={round(ly)} r={0.95} />
    </motion.g>
  );
}
