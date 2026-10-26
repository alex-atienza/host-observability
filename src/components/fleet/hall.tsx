"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { Dots, FaceText, Line, Solid } from "@/components/iso/react/draw";
import { useReadout } from "@/components/iso/react/live";
import { axisVector, cameraOf, cylinder, depthOf, fitProjection, iso, pathOf, sideMatrix, slabOf, type Flat, type Plan, type Point3, type Projection } from "@/components/iso/iso-kit";
import type { FleetHost, Region } from "@/lib/fleet";
import type { Health } from "@/lib/hosts";
import { useCamera, type Camera, type FleetCamera } from "./camera";
import { GROUP_LABEL, type GroupBy } from "./scene";

// A data hall: one row of 42U racks per group, rows receding into the room, seen from
// higher up. At full view each rack shows a strip per host (its health and load); zoomed
// in, the racks in view swap their strips for real blades. Racks with problems stand
// forward of their row, leaving their footprint behind.
// World: x along a row, y from the back of the hall toward the viewer, z up.

export const HALL_W = 960;
export const HALL_H = 600;
const AZIMUTH = 76;
const ELEVATION = 54;

const RACK_W = 56;
const DEPTH = 44;
const PITCH = RACK_W + 2;
const PER_ROW = 4; // racks per row segment
const COLS = 3; // row segments side by side
const CROSS = 46; // cross aisle between columns
// A row and the aisle in front of it, wide enough that every row's fronts show over the row in front.
const ROW_PITCH = DEPTH + 172;
const POST = 5;
const U = 4.4;
const SLOTS = 42;
const PLINTH = 5;
const CAP = 6;
const TOP = PLINTH + SLOTS * U;
const LIP = 1;
const FORWARD = 22; // how far a rack with problems stands out of its row
const BLADES_AT = 2.2; // zoom at which strips become blades
const SEG_W = PER_ROW * PITCH;
const SIGN_Z = TOP + CAP + 18; // row signs hang above the racks, set back so the beacons show
const SIGN_H = 12;

const SEVERITY: Record<Health, number> = { critical: 0, degraded: 1, healthy: 2 };

interface HallRack {
  key: string;
  group: string;
  label: string;
  hosts: FleetHost[];
  worst: Health;
  alerts: number;
  x: number;
  y: number;
  forward: boolean;
}

interface Segment {
  key: string;
  label: string;
  count: number;
  alerts: number;
  x: number;
  y: number;
  racks: number;
}

function groupKey(host: FleetHost, by: GroupBy) {
  return by === "region" ? host.region : by === "provider" ? host.provider : by === "service" ? host.service : host.health;
}

export function hallFor(hosts: FleetHost[], regions: Region[], by: GroupBy) {
  const groups = new Map<string, FleetHost[]>();
  for (const host of hosts) {
    const key = groupKey(host, by);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(host);
  }
  const order = by === "region" ? regions.map((r) => r.id) : by === "provider" ? ["aws", "azure", "gcp"] : by === "health" ? ["critical", "degraded", "healthy"] : [...groups.keys()].sort();
  const regionIndex = new Map(regions.map((r, i) => [r.id, i]));
  const racks: HallRack[] = [];
  const segments: Segment[] = [];
  let seg = 0;
  for (const key of order) {
    const members = (groups.get(key) ?? []).slice().sort((a, b) => SEVERITY[b.health] - SEVERITY[a.health] || regionIndex.get(a.region)! - regionIndex.get(b.region)! || a.zone.localeCompare(b.zone) || a.hostname.localeCompare(b.hostname));
    if (!members.length) continue;
    const chunks: FleetHost[][] = [];
    for (let i = 0; i < members.length; i += SLOTS) chunks.push(members.slice(i, i + SLOTS));
    const label = by === "provider" ? key.toUpperCase() : key;
    for (let s = 0; s < chunks.length; s += PER_ROW) {
      const col = seg % COLS;
      const row = Math.floor(seg / COLS);
      const sx = col * (SEG_W + CROSS);
      const sy = row * ROW_PITCH;
      const inSeg = chunks.slice(s, s + PER_ROW);
      const segHosts = inSeg.flat();
      const parts = Math.ceil(chunks.length / PER_ROW);
      segments.push({ key: `${key}#${s}`, label: parts > 1 ? `${label} ${s / PER_ROW + 1}/${parts}` : label, count: segHosts.length, alerts: segHosts.filter((h) => h.health !== "healthy").length, x: sx, y: sy, racks: inSeg.length });
      inSeg.forEach((chunk, j) => {
        const worst = chunk.reduce<Health>((w, h) => (SEVERITY[h.health] < SEVERITY[w] ? h.health : w), "healthy");
        racks.push({ key: `${key}#${s + j}`, group: key, label, hosts: chunk, worst, alerts: chunk.filter((h) => h.health !== "healthy").length, x: sx + j * PITCH, y: sy, forward: worst !== "healthy" });
      });
      seg++;
    }
  }
  return { racks, segments, rows: Math.ceil(seg / COLS) };
}

const box = (x0: number, y0: number, x1: number, y1: number): Plan => ({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: 0.3 });
const round = (v: number) => Math.round(v * 100) / 100;
const join = (paths: string[]) => paths.filter(Boolean).join("");

function projectionFor(rows: number) {
  const corners: Point3[] = [];
  const x1 = COLS * SEG_W + (COLS - 1) * CROSS;
  const y1 = (rows - 1) * ROW_PITCH + DEPTH + FORWARD + 34;
  for (const x of [-4, x1 + 4]) for (const y of [-4, y1]) for (const z of [0, SIGN_Z + SIGN_H + 4]) corners.push([x, y, z]);
  return fitProjection(corners, HALL_W, HALL_H, { pad: 22, azimuth: AZIMUTH, elevation: ELEVATION });
}

function shapesFor(P: Projection) {
  const at = (p: Point3) => iso(p, P);
  const slab = (plan: Plan, z: number, h: number, steps = 1, bevel = 0) => slabOf(plan, z, h, P, steps, bevel);
  const faceRect = (y: number, x0: number, z0: number, x1: number, z1: number) => pathOf([at([x0, y, z0]), at([x1, y, z0]), at([x1, y, z1]), at([x0, y, z1])], true);
  const inner0 = POST;
  const inner1 = RACK_W - POST;
  const front = DEPTH + LIP;
  const vents: string[] = [];
  for (let z = PLINTH + 14; z < TOP - 14; z += 6) vents.push(pathOf([at([RACK_W, DEPTH - 28, z]), at([RACK_W, DEPTH - 8, z]), at([RACK_W, DEPTH - 8, z + 1.6]), at([RACK_W, DEPTH - 28, z + 1.6])], true));
  const strips: string[] = [];
  for (let k = 0; k < SLOTS; k++) strips.push(faceRect(front, inner0 + 0.6, PLINTH + k * U + 0.5, inner1 - 0.6, PLINTH + (k + 1) * U - 0.5));
  const bx = RACK_W / 2;
  const by = DEPTH - 9;
  return {
    footprint: pathOf([at([0, 0, 0]), at([RACK_W, 0, 0]), at([RACK_W, DEPTH, 0]), at([0, DEPTH, 0])], true),
    halo: slab(box(-1, -1, RACK_W + 1, DEPTH + 1), -2, 2).fill,
    plinth: slab(box(-0.5, -0.5, RACK_W + 0.5, DEPTH + 0.5), 0, PLINTH, 1, 0.4),
    back: slab(box(inner0, 0, inner1, 2), PLINTH, SLOTS * U),
    left: slab(box(0, 0, inner0, DEPTH), PLINTH, SLOTS * U, 1, 0.4),
    right: slab(box(inner1, 0, RACK_W, DEPTH), PLINTH, SLOTS * U, 1, 0.4),
    vents: join(vents),
    cap: slab(box(0, 0, RACK_W, DEPTH), TOP, CAP, 1, 0.4),
    plate: faceRect(DEPTH, 4, TOP + 1.2, RACK_W - 4, TOP + CAP - 1.2),
    label: sideMatrix([6, DEPTH], TOP + CAP - 2.2, P, "left"),
    count: sideMatrix([RACK_W - 6, DEPTH], TOP + CAP - 2.2, P, "left"),
    beaconBase: cylinder(bx, by, 4, TOP + CAP, 1, P, 24),
    beacon: cylinder(bx, by, 3, TOP + CAP + 1, 3.4, P, 28),
    beaconGlow: at([bx, by, TOP + CAP + 3]),
    strips,
    blank: (from: number) => faceRect(front - 0.6, inner0 + 0.3, PLINTH + from * U + 0.3, inner1 - 0.3, TOP - 0.3),
    blade: {
      plate: (k: number) => slab(box(inner0 + 0.3, DEPTH - 0.4, inner1 - 0.3, front), PLINTH + k * U + 0.15, U - 0.3),
      face: (k: number) => faceRect(front, inner0 + 2.2, PLINTH + k * U + 0.7, inner1 - 7, PLINTH + (k + 1) * U - 0.7),
      handle: (k: number) => pathOf([at([inner0 + 1.2, front, PLINTH + k * U + 1.1]), at([inner0 + 1.2, front, PLINTH + (k + 1) * U - 1.1])]),
      handleEnds: (k: number) => [at([inner0 + 1.2, front, PLINTH + k * U + 1.1]), at([inner0 + 1.2, front, PLINTH + (k + 1) * U - 1.1])] as Flat[],
      led: (k: number) => at([inner1 - 3.6, front, PLINTH + k * U + U / 2]),
    },
    bbox: (() => {
      const pts: Flat[] = [];
      for (const x of [0, RACK_W]) for (const y of [0, front]) for (const z of [0, TOP + CAP + 4]) pts.push(at([x, y, z]));
      const xs = pts.map(([x]) => x);
      const ys = pts.map(([, y]) => y);
      return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as const;
    })(),
  };
}

type Shapes = ReturnType<typeof shapesFor>;

interface HallProps {
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
  minimapSlot: HTMLElement | null;
}

export function HallScene({ camera, onZoom, hosts, regions, groupBy, shown, shade, rest, focus, onPoint, minimapSlot }: HallProps) {
  const { anchor, say } = useReadout<SVGGElement>();
  const router = useRouter();
  const [hovered, setHovered] = React.useState<string | null>(null);

  const maxRows = React.useMemo(() => Math.max(...(Object.keys(GROUP_LABEL) as GroupBy[]).map((by) => hallFor(hosts, regions, by).rows)), [hosts, regions]);
  const P = React.useMemo(() => projectionFor(maxRows), [maxRows]);
  const shapes = React.useMemo(() => shapesFor(P), [P]);
  const hall = React.useMemo(() => hallFor(hosts, regions, groupBy), [hosts, regions, groupBy]);
  const ex = React.useMemo(() => axisVector(P, [1, 0, 0]), [P]);
  const ey = React.useMemo(() => axisVector(P, [0, 1, 0]), [P]);
  const ez = React.useMemo(() => axisVector(P, [0, 0, 1]), [P]);
  const shift = (maxRows - hall.rows) * ROW_PITCH * 0.5; // centre a hall with fewer rows
  const offset = (x: number, y: number, z = 0): Flat => [round(ex[0] * x + ey[0] * y + ez[0] * z), round(ex[1] * x + ey[1] * y + ez[1] * z)];
  const placeOf = (rack: HallRack) => offset(rack.x, rack.y + shift + (rack.forward ? FORWARD : 0));

  // Camera, plus what it shows: the level of detail and which racks are in view.
  const [view, setView] = React.useState<Camera>({ k: 1, tx: 0, ty: 0 });
  const frame = React.useRef(0);
  const onChange = React.useCallback((cam: Camera) => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => setView({ ...cam }));
  }, []);
  const { camNode, dragged, setCam, zoomAt, fit, zoomToBox } = useCamera({ anchor, width: HALL_W, height: HALL_H, maxZoom: 9, onZoom, onChange });
  React.useEffect(() => {
    if (!camera) return;
    camera.current = { zoomBy: (factor) => zoomAt(HALL_W / 2, HALL_H / 2, factor, true), fit };
    return () => {
      camera.current = null;
    };
  }, [camera, zoomAt, fit]);
  const firstGroup = React.useRef(true);
  React.useEffect(() => {
    if (firstGroup.current) {
      firstGroup.current = false;
      return;
    }
    fit();
  }, [groupBy, fit]);

  const detailed = view.k >= BLADES_AT;
  const inView = (rack: HallRack) => {
    const [ox, oy] = placeOf(rack);
    const [x0, y0, x1, y1] = shapes.bbox;
    const sx0 = (x0 + ox) * view.k + view.tx;
    const sx1 = (x1 + ox) * view.k + view.tx;
    const sy0 = (y0 + oy) * view.k + view.ty;
    const sy1 = (y1 + oy) * view.k + view.ty;
    return sx1 > -40 && sx0 < HALL_W + 40 && sy1 > -40 && sy0 < HALL_H + 40;
  };

  // Paint racks back to front.
  const ordered = React.useMemo(
    () => hall.racks.slice().sort((a, b) => depthOf([a.x + RACK_W / 2, a.y + (a.forward ? FORWARD : 0) + DEPTH / 2, 0], P) - depthOf([b.x + RACK_W / 2, b.y + (b.forward ? FORWARD : 0) + DEPTH / 2, 0], P) || a.x - b.x),
    [hall, P],
  );

  const byId = React.useMemo(() => new Map(hosts.map((h) => [h.id, h])), [hosts]);
  const active = hovered ?? focus;
  React.useEffect(() => {
    const host = active ? byId.get(active) : undefined;
    say(host ? `${host.hostname} · ${host.instanceType} · CPU ${host.cpu}% · mem ${host.mem}% · ${host.health}` : rest);
  }, [active, byId, rest, say]);
  React.useEffect(() => onPoint(hovered), [hovered, onPoint]);

  const rackOfHost = React.useMemo(() => {
    const map = new Map<string, HallRack>();
    for (const rack of hall.racks) for (const host of rack.hosts) map.set(host.id, rack);
    return map;
  }, [hall]);
  const zoomToRack = (rack: HallRack) => {
    const [ox, oy] = placeOf(rack);
    const [x0, y0, x1, y1] = shapes.bbox;
    zoomToBox(x0 + ox, y0 + oy, x1 + ox, y1 + oy, 0.86);
  };
  // A host the table points at, out of view or too small to see: bring its rack in.
  React.useEffect(() => {
    if (!focus) return;
    const rack = rackOfHost.get(focus);
    if (rack && view.k > 1.01 && !inView(rack)) zoomToRack(rack);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  // Minimap: the hall from above, with what the camera sees.
  const plan = React.useMemo(() => {
    const xs = hall.racks.map((r) => r.x);
    const ys = hall.racks.map((r) => r.y + shift);
    return { x0: Math.min(-10, ...xs) - 10, x1: Math.max(...xs) + RACK_W + 20, y0: Math.min(...ys) - 20, y1: Math.max(...ys) + DEPTH + FORWARD + 30 };
  }, [hall, shift]);
  const floorAt = React.useCallback(
    (vx: number, vy: number, cam: Camera): Flat => {
      const { sinA, cosA, sinE, k } = cameraOf(P);
      const px = (vx - cam.tx) / cam.k - P.origin[0];
      const py = (vy - cam.ty) / cam.k - P.origin[1];
      const a = px / k;
      const b = py / (k * sinE);
      return [a * sinA + b * cosA, -a * cosA + b * sinA];
    },
    [P],
  );
  const centreOn = React.useCallback(
    (x: number, y: number) => {
      const k = Math.max(view.k, BLADES_AT);
      const [sx, sy] = iso([x, y, TOP / 2], P);
      setCam({ k, tx: HALL_W / 2 - sx * k, ty: HALL_H / 2 - sy * k }, true);
    },
    [P, setCam, view.k],
  );
  const minimap = (() => {
    const MW = 168;
    const scale = MW / (plan.x1 - plan.x0);
    const MH = Math.round((plan.y1 - plan.y0) * scale);
    const mx = (x: number) => round((x - plan.x0) * scale);
    const my = (y: number) => round((y - plan.y0) * scale);
    const quad = [
      [0, 0],
      [HALL_W, 0],
      [HALL_W, HALL_H],
      [0, HALL_H],
    ].map(([vx, vy]) => floorAt(vx!, vy!, view));
    return (
      <svg
        className="fleet-minimap"
        viewBox={`0 0 ${MW} ${MH}`}
        width={MW}
        height={MH}
        role="img"
        aria-label="Minimap of the hall. Click to move there."
        onClick={(event) => {
          const r = event.currentTarget.getBoundingClientRect();
          centreOn(plan.x0 + ((event.clientX - r.left) / r.width) * (plan.x1 - plan.x0), plan.y0 + ((event.clientY - r.top) / r.height) * (plan.y1 - plan.y0));
        }}
      >
        <clipPath id="fleet-minimap-clip">
          <rect width={MW} height={MH} rx={4} />
        </clipPath>
        <g clipPath="url(#fleet-minimap-clip)">
          {hall.racks.map((rack) => (
            <rect key={rack.key} className="fleet-minimap-rack" data-worst={rack.worst} x={mx(rack.x)} y={my(rack.y + shift + (rack.forward ? FORWARD : 0))} width={round(RACK_W * scale - 1)} height={round(DEPTH * scale)} rx={1} />
          ))}
          {view.k > 1.01 ? <polygon className="fleet-minimap-view" points={quad.map(([x, y]) => `${mx(x)},${my(y)}`).join(" ")} /> : null}
        </g>
      </svg>
    );
  })();

  const open = (id: string) => router.push(`/hosts/${id}`);
  const idOf = (event: React.SyntheticEvent) => (event.target as Element).closest("[data-host]")?.getAttribute("data-host") ?? null;

  return (
    <MotionConfig reducedMotion="user">
      <g
        ref={anchor}
        className="fleet-root fleet-hall"
        data-shade={shade}
        data-detail={detailed ? "blades" : "strips"}
        tabIndex={0}
        role="group"
        aria-label="A data hall of racks, one row per group. Plus and minus zoom, 0 fits the hall; zoom in to open hosts."
        onPointerOver={(event) => setHovered(idOf(event))}
        onPointerLeave={() => setHovered(null)}
        onClick={(event) => {
          if (dragged.current) {
            dragged.current = false;
            return;
          }
          const target = event.target as Element;
          const key = target.closest("[data-rack]")?.getAttribute("data-rack");
          const rack = key ? hall.racks.find((r) => r.key === key) : undefined;
          const id = idOf(event);
          if (id && detailed && shown.has(id)) return open(id);
          if (rack) zoomToRack(rack);
        }}
        onKeyDown={(event) => {
          if (event.key === "+" || event.key === "=") zoomAt(HALL_W / 2, HALL_H / 2, 1.5, true);
          else if (event.key === "-" || event.key === "_") zoomAt(HALL_W / 2, HALL_H / 2, 1 / 1.5, true);
          else if (event.key === "0") fit();
          else if (event.key === "Escape") setHovered(null);
        }}
        onBlur={() => setHovered(null)}
      >
        <rect key="catch" className="fleet-catch" width={HALL_W} height={HALL_H} />
        <g key="camera" ref={camNode} className="fleet-camera">
          <HallFloor P={P} rows={maxRows} />
          <g key="racks">
            <AnimatePresence initial={false}>
              {ordered.map((rack, index) => {
                const [x, y] = placeOf(rack);
                const blades = detailed && inView(rack);
                return (
                  <motion.g
                    key={rack.key}
                    initial={{ opacity: 0, x, y: y + 40 }}
                    animate={{ opacity: 1, x, y }}
                    exit={{ opacity: 0, y: y + 40, transition: { duration: 0.35, delay: (index % 12) * 0.01 } }}
                    transition={{ duration: 0.55, delay: 0.25 + index * 0.012, ease: [0.32, 0.72, 0, 1] }}
                    data-rack={rack.key}
                    className="fleet-hall-rack"
                    data-worst={rack.worst}
                  >
                    <Rack rack={rack} shapes={shapes} blades={blades} shown={shown} active={active} offsetY={offset(0, -FORWARD)} />
                  </motion.g>
                );
              })}
            </AnimatePresence>
          </g>
          <g key="signs">
            <AnimatePresence initial={false}>
              {hall.segments.map((segment, index) => {
                const [x, y] = offset(segment.x, segment.y + shift);
                return (
                  <motion.g key={segment.key} initial={{ opacity: 0, x, y: y - 20 }} animate={{ opacity: 1, x, y }} exit={{ opacity: 0 }} transition={{ duration: 0.45, delay: 0.3 + index * 0.03 }}>
                    <RowSign segment={segment} P={P} />
                  </motion.g>
                );
              })}
            </AnimatePresence>
          </g>
        </g>
      </g>
      {minimapSlot ? createPortal(minimap, minimapSlot) : null}
    </MotionConfig>
  );
}

// A row sign hung above the row from two rods, its rods fading up into the ceiling.
function RowSign({ segment, P }: { segment: Segment; P: Projection }) {
  const at = (p: Point3) => iso(p, P);
  const w = Math.max(2, segment.racks) * PITCH - 6;
  const y = 4;
  const plate = slabOf(box(2, y, 2 + w, y + 1.6), SIGN_Z, SIGN_H, P, 1, 0.3);
  const rods = [10, w - 6].map((x) => [at([x, y + 0.8, SIGN_Z + SIGN_H]), at([x, y + 0.8, SIGN_Z + SIGN_H + 22])] as Flat[]);
  return (
    <g className="fleet-sign">
      {rods.map((points, k) => (
        <path key={k} className="fleet-sign-rod" d={pathOf(points)} data-free="end" />
      ))}
      <Solid paths={plate} tone="mid" />
      <FaceText transform={sideMatrix([7, y + 1.6], SIGN_Z + SIGN_H - 3.2, P, "left")} size={7.5} tone="hi">
        {segment.label}
      </FaceText>
      <FaceText transform={sideMatrix([w - 3, y + 1.6], SIGN_Z + SIGN_H - 3.2, P, "left")} size={6.4} tone="mid" anchor="end">
        {segment.alerts ? <tspan className="fleet-alerts">{`${segment.alerts}▲  `}</tspan> : null}
        {`${segment.count}`}
      </FaceText>
    </g>
  );
}

const HallFloor = React.memo(function HallFloor({ P, rows }: { P: Projection; rows: number }) {
  const at = (p: Point3) => iso(p, P);
  const tile = PITCH / 2;
  // Far past the racks in every direction, so the floor fills the card at any zoom or pan.
  const reach = tile * 60;
  const x0 = -reach;
  const x1 = COLS * SEG_W + (COLS - 1) * CROSS + reach;
  const y0 = -reach;
  const y1 = rows * ROW_PITCH + reach;
  const grid: string[] = [];
  for (let x = x0; x <= x1 + 0.1; x += tile) grid.push(pathOf([at([x, y0, 0]), at([x, y1, 0])]));
  for (let y = y0; y <= y1 + 0.1; y += tile) grid.push(pathOf([at([x0, y, 0]), at([x1, y, 0])]));
  const d = grid.join("");
  return (
    <g className="fleet-floor" aria-hidden="true">
      <defs>
        <linearGradient id="hall-band" gradientUnits="objectBoundingBox" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="hall-scan" maskUnits="userSpaceOnUse" x={-HALL_W} y={-HALL_H} width={HALL_W * 3} height={HALL_H * 3}>
          <rect className="fleet-scan" x={-HALL_W * 0.2} y={-HALL_H} width={HALL_W * 0.2} height={HALL_H * 3} fill="url(#hall-band)" />
        </mask>
      </defs>
      <g>
        <Line d={d} tone="faint" free />
        <g mask="url(#hall-scan)">
          <path className="fleet-floor-scanlines" d={d} />
        </g>
      </g>
    </g>
  );
});

function Rack({ rack, shapes, blades, shown, active, offsetY }: { rack: HallRack; shapes: Shapes; blades: boolean; shown: Set<string>; active: string | null; offsetY: Flat }) {
  const [gx, gy] = shapes.beaconGlow;
  return (
    <>
      {rack.forward ? <path className="fleet-footprint" d={shapes.footprint} transform={`translate(${offsetY[0]} ${offsetY[1]})`} /> : null}
      <RackShell shapes={shapes} />
      {blades ? (
        rack.hosts.map((host, k) => {
          const [lx, ly] = shapes.blade.led(k);
          const face = shapes.blade.face(k);
          return (
            <g key={host.id} className="fleet-blade" data-host={host.id} data-health={host.health} data-dim={shown.has(host.id) ? undefined : ""} data-on={active === host.id ? "" : undefined} style={{ "--cpu": host.cpu / 100, "--mem": host.mem / 100, "--disk": host.disk / 100 } as React.CSSProperties}>
              <Solid paths={shapes.blade.plate(k)} tone="mid" crease="faint" />
              <path className="fleet-face" d={face} />
              <path className="fleet-glow" d={face} />
              <Line d={face} tone="lo" />
              <Line d={shapes.blade.handle(k)} tone="mid" />
              <Dots points={shapes.blade.handleEnds(k)} size={0.3} tone="mid" />
              <circle className="fleet-led" cx={round(lx)} cy={round(ly)} r={0.9} />
            </g>
          );
        })
      ) : (
        <g className="fleet-strips">
          {rack.hosts.map((host, k) => (
            <path key={host.id} className="fleet-strip fleet-face" d={shapes.strips[k]} data-host={host.id} data-health={host.health} data-dim={shown.has(host.id) ? undefined : ""} data-on={active === host.id ? "" : undefined} style={{ "--cpu": host.cpu / 100, "--mem": host.mem / 100, "--disk": host.disk / 100 } as React.CSSProperties} />
          ))}
        </g>
      )}
      {rack.hosts.length < SLOTS ? <path className="fleet-hall-blank" d={shapes.blank(rack.hosts.length)} /> : null}
      <RackHead rack={rack} shapes={shapes} glow={[gx, gy]} />
    </>
  );
}

const RackShell = React.memo(function RackShell({ shapes }: { shapes: Shapes }) {
  return (
    <>
      <path className="iso-halo" d={shapes.halo} />
      <Solid paths={shapes.plinth} tone="mid" />
      <Solid paths={shapes.back} tone="lo" crease="none" />
      <Solid paths={shapes.left} tone="mid" />
      <Solid paths={shapes.right} tone="mid" />
      <Line d={shapes.vents} tone="lo" />
    </>
  );
});

function RackHead({ rack, shapes, glow }: { rack: HallRack; shapes: Shapes; glow: Flat }) {
  return (
    <g className="fleet-cap" data-worst={rack.worst}>
      <Solid paths={shapes.cap} tone="mid" />
      <Line d={shapes.plate} tone="lo" />
      <FaceText transform={shapes.label} size={2.6} tone="hi">
        {rack.label}
      </FaceText>
      <FaceText transform={shapes.count} size={2.4} tone="mid" anchor="end">
        {rack.alerts ? <tspan className="fleet-alerts">{`${rack.alerts}▲ `}</tspan> : null}
        {`${rack.hosts.length}`}
      </FaceText>
      <g className="fleet-beacon" data-worst={rack.worst}>
        <Solid paths={shapes.beaconBase} tone="mid" />
        <ellipse className="fleet-beacon-glow" cx={round(glow[0])} cy={round(glow[1])} rx={11} ry={8} />
        <Solid paths={shapes.beacon} tone="hi" />
      </g>
    </g>
  );
}
