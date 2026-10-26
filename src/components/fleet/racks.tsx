import * as React from "react";
import { FaceText, Line, Solid, Dots } from "@/components/iso/react/draw";
import { fitProjection, iso, pathOf, sideMatrix, slabOf, cylinder, translateAlong, type Flat, type Plan, type Point3 } from "@/components/iso/iso-kit";
import type { FleetHost, Region } from "@/lib/fleet";

// One 19-inch rack per region, each host a 1U blade seen from the front.
// x runs along the row of racks, y from the back of a rack (0) to its front (DEPTH), z up.

export const WIDTH = 960;
export const HEIGHT = 420;
const AZIMUTH = 66;
const ELEVATION = 22;

const RACK_W = 56;
const DEPTH = 44;
const GAP = 18;
const POST = 5;
const U = 4.6;
const SLOTS = 20;
const PLINTH = 6;
const CAP = 7;
const TOP = PLINTH + SLOTS * U;
const LIP = 1.2; // blades stand proud of the posts by this much

const box = (x0: number, y0: number, x1: number, y1: number): Plan => ({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: 0.3 });

export function rackProjection(count: number) {
  const span = count * RACK_W + (count - 1) * GAP;
  const corners: Point3[] = [];
  for (const x of [-2, span + 2]) for (const y of [-2, DEPTH + 12]) for (const z of [0, TOP + CAP]) corners.push([x, y, z]);
  return fitProjection(corners, WIDTH, HEIGHT, { pad: 30, azimuth: AZIMUTH, elevation: ELEVATION });
}

export const SLIDE = 22;

export function rackArt(regions: Region[], hosts: FleetHost[]) {
  const P = rackProjection(regions.length);
  const at = (point: Point3) => iso(point, P);
  const seg = (a: Point3, b: Point3) => pathOf([at(a), at(b)]);
  const slab = (plan: Plan, z: number, h: number, steps = 1, bevel = 0) => slabOf(plan, z, h, P, steps, bevel);
  const faceRect = (y: number, x0: number, z0: number, x1: number, z1: number) => pathOf([at([x0, y, z0]), at([x1, y, z0]), at([x1, y, z1]), at([x0, y, z1])], true);

  const racks = regions.map((region, index) => {
    const x0 = index * (RACK_W + GAP);
    const x1 = x0 + RACK_W;
    const inner0 = x0 + POST;
    const inner1 = x1 - POST;
    const members = hosts.filter((host) => host.region === region.id).sort((a, b) => a.zone.localeCompare(b.zone));

    // Plinth on four levelling feet.
    const plinth = box(x0 - 1, -1, x1 + 1, DEPTH + 1);
    const feet = [
      [x0 + 4, 4],
      [x1 - 4, 4],
      [x0 + 4, DEPTH - 4],
      [x1 - 4, DEPTH - 4],
    ].map(([fx, fy]) => cylinder(fx!, fy!, 2.2, -2, 2, P, 16));
    const base = (
      <g key="base">
        <path className="iso-halo" d={slab(plinth, -2, 2).fill} />
        {feet.map((paths, k) => (
          <Solid key={k} paths={paths} tone="lo" crease="none" />
        ))}
        <Solid paths={slab(plinth, 0, PLINTH, 2, 0.5)} tone="mid" />
        <Line d={join(range(x0 + 6, x1 - 6, 4).map((x) => faceRect(DEPTH + 1, x, 1.6, x + 1.6, PLINTH - 1.6)))} tone="lo" />
      </g>
    );

    // Back panel and left post: what the blades sit in front of.
    const back = box(inner0, 0, inner1, 2);
    const left = box(x0, 0, inner0, DEPTH);
    const holes: Flat[] = [];
    for (let k = 0; k < SLOTS; k++) for (const z of [0.9, U / 2, U - 0.9]) holes.push(at([x0 + POST / 2, DEPTH, PLINTH + k * U + z]));
    const shell = (
      <g key="shell" data-rack={region.id}>
        <Solid paths={slab(back, PLINTH, SLOTS * U, 1)} tone="lo" crease="none" />
        <Solid paths={slab(left, PLINTH, SLOTS * U, 1, 0.4)} tone="mid" />
        <Dots points={holes} size={0.32} tone="lo" />
      </g>
    );

    // Blades, bottom to top, grouped by zone. Empty slots get blanking panels.
    const blades: React.ReactNode[] = [];
    let zone = "";
    const zoneTicks: string[] = [];
    for (let slot = 0; slot < SLOTS; slot++) {
      const z = PLINTH + slot * U;
      const host = members[slot];
      const plan = box(inner0 + 0.3, DEPTH - 14, inner1 - 0.3, DEPTH + LIP);
      const front = DEPTH + LIP;
      if (!host) {
        const vents: Flat[] = [];
        for (let x = inner0 + 6; x < inner1 - 4; x += 3) vents.push(at([x, front, z + U / 2]));
        blades.push(
          <g key={`blank${slot}`} className="fleet-blank">
            <Solid paths={slab(plan, z + 0.15, U - 0.3, 1)} tone="faint" crease="none" />
            <Dots points={vents} size={0.3} tone="faint" />
          </g>,
        );
        continue;
      }
      if (host.zone !== zone) {
        if (zone) zoneTicks.push(seg([x0, DEPTH, z], [inner0, DEPTH, z]));
        zone = host.zone;
      }
      const face = faceRect(front, inner0 + 2.2, z + 0.7, inner1 - 7, z + U - 0.7);
      const handle = seg([inner0 + 1.2, front, z + 1.1], [inner0 + 1.2, front, z + U - 1.1]);
      const ears = [at([inner0 + 0.9, front, z + U / 2]), at([inner1 - 0.9, front, z + U / 2])];
      const style = { "--cpu": host.cpu / 100, "--mem": host.mem / 100, "--disk": host.disk / 100 } as React.CSSProperties;
      blades.push(
        <g key={host.id} className="fleet-blade" data-host={host.id} data-health={host.health} style={style} tabIndex={-1}>
          <g className="fleet-slide" data-slide={translateAlong(P, [0, SLIDE, 0])}>
            <Solid paths={slab(plan, z + 0.15, U - 0.3, 1)} tone="mid" crease="faint" />
            <path className="fleet-face" d={face} />
            <Line d={face} tone="lo" />
            <Line d={handle} tone="mid" />
            <Dots points={ears} size={0.35} tone="mid" />
            <circle className="fleet-led" cx={round(at([inner1 - 3.6, front, z + U / 2])[0])} cy={round(at([inner1 - 3.6, front, z + U / 2])[1])} r={0.95} />
          </g>
        </g>,
      );
    }

    // Right side panel and top cap with the region's nameplate.
    const right = box(inner1, 0, x1, DEPTH);
    const cap = box(x0, 0, x1, DEPTH);
    const plate = faceRect(DEPTH, x0 + 4, TOP + 1.4, x1 - 4, TOP + CAP - 1.4);
    const vents: string[] = [];
    for (let z = PLINTH + 8; z < TOP - 7; z += 3.2) vents.push(pathOf([at([x1, DEPTH - 29, z]), at([x1, DEPTH - 7, z]), at([x1, DEPTH - 7, z + 1.1]), at([x1, DEPTH - 29, z + 1.1])], true));
    const ventFrame = pathOf([at([x1, DEPTH - 32, PLINTH + 6]), at([x1, DEPTH - 4, PLINTH + 6]), at([x1, DEPTH - 4, TOP - 4]), at([x1, DEPTH - 32, TOP - 4])], true);
    const head = (
      <g key="head" data-rack={region.id}>
        <Solid paths={slab(right, PLINTH, SLOTS * U, 1, 0.4)} tone="mid" />
        <Line d={join(vents)} tone="lo" />
        <Line d={ventFrame} tone="faint" />
        <Line d={join(zoneTicks)} tone="hi" />
        <Solid paths={slab(cap, TOP, CAP, 1, 0.5)} tone="mid" />
        <Line d={plate} tone="lo" />
        <FaceText transform={sideMatrix([x0 + 6, DEPTH], TOP + CAP - 2.6, P, "left")} size={3.1} tone="hi">
          {region.id}
        </FaceText>
        <FaceText transform={sideMatrix([x1 - 6, DEPTH], TOP + CAP - 2.6, P, "left")} size={2.6} tone="mid" anchor="end">
          {`${members.length}`}
        </FaceText>
      </g>
    );

    return (
      <g key={region.id} className="fleet-rack" data-region={region.id}>
        {base}
        {shell}
        <g key="blades">{blades}</g>
        {head}
      </g>
    );
  });

  return <g key="racks">{racks}</g>;
}

const round = (value: number) => Math.round(value * 10) / 10;
const join = (paths: string[]) => paths.filter(Boolean).join("");
const range = (from: number, to: number, step: number) => {
  const out: number[] = [];
  for (let v = from; v <= to; v += step) out.push(v);
  return out;
};
