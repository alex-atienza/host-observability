import {
  circleRing,
  cylinder,
  depthOf,
  fitProjection,
  insetPlan,
  iso,
  onTop,
  pathOf,
  planOutline,
  sideRing,
  sideSeam,
  slabOf,
  type Flat,
  type Plan,
  type Point3,
  type Projection,
  type SolidPaths,
  type Tone,
} from "@/components/iso/iso-kit";

// One 1U rack server with its lid off, in world units of about 2.3 mm.
// x runs rear (−) to front (+), y runs across the rack, z is up.
// The front bezel faces the viewer at bottom right, the long side at bottom left.

export type Card = "nitro" | "boost" | "ipu";
export type Power = "dual" | "single" | "busbar";

export interface BladeSpec {
  drives: number;
  fans: number;
  cards: Card[];
  power: Power;
  status: "ok" | "warn";
}

export const WIDTH = 640;
export const HEIGHT = 340;
export const AZIMUTH = 36;
export const ELEVATION = 34;

const LEN = 300;
const WID = 190;
const H = 18;
const X0 = -LEN / 2;
const X1 = LEN / 2;
const Y0 = -WID / 2;
const Y1 = WID / 2;
const WALL = 2;
const FLOOR = 2;
const BOARD = FLOOR + 1;
const BEZEL = 12;

const CHASSIS: Plan = { x: X0, y: Y0, w: LEN, d: WID, r: 1.5 };

export const P: Projection = fitProjection(
  [
    [X0, Y0 - 8, 0],
    [X1 + 4, Y0 - 8, 0],
    [X0, Y1 + 8, 0],
    [X1 + 4, Y1 + 8, 0],
    [X0, Y0 - 8, H],
    [X1 + 4, Y1 + 8, H],
    [X1 + 4, Y0 - 8, H],
    [X0, Y1 + 8, H],
  ],
  WIDTH,
  HEIGHT,
  { pad: 22, azimuth: AZIMUTH, elevation: ELEVATION },
);

const at = (point: Point3) => iso(point, P);
const seg = (a: Point3, b: Point3) => pathOf([at(a), at(b)]);
const join = (paths: string[]) => paths.filter(Boolean).join("");
const slab = (plan: Plan, z: number, h: number, steps = 3, bevel = 0) => slabOf(plan, z, h, P, steps, bevel);
const box = (x0: number, y0: number, x1: number, y1: number): Plan => ({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: 0.4 });

// A closed outline on the front face of something, at x, given y–z corners.
const faceRect = (x: number, y0: number, z0: number, y1: number, z1: number) =>
  pathOf([at([x, y0, z0]), at([x, y1, z0]), at([x, y1, z1]), at([x, y0, z1])], true);
// The same on a +y face.
const sideRect = (y: number, x0: number, z0: number, x1: number, z1: number) =>
  pathOf([at([x0, y, z0]), at([x1, y, z0]), at([x1, y, z1]), at([x0, y, z1])], true);

// ---- Drawn items ----

export type Mark =
  | { kind: "solid"; paths: SolidPaths; tone?: Tone; lit?: boolean; flat?: boolean; crease?: Tone | "none"; halo?: boolean }
  | { kind: "line"; d: string; tone?: Tone | "lit"; free?: boolean }
  | { kind: "dots"; points: Flat[]; size?: number; tone?: Tone }
  | { kind: "led"; points: Flat[]; size?: number; state: "ok" | "warn" | "id" | "act" };

export interface Item {
  id: string;
  part?: string;
  box: [number, number, number, number, number, number];
  marks: Mark[];
}

const items: Item[] = [];
let count = 0;

function put(part: string | undefined, plan: Plan, z0: number, z1: number, marks: Mark[]) {
  items.push({ id: `i${count++}`, part, box: [plan.x, plan.x + plan.w, plan.y, plan.y + plan.d, z0, z1], marks });
}

const S = (paths: SolidPaths, tone: Tone = "mid", extra: Partial<Extract<Mark, { kind: "solid" }>> = {}): Mark => ({ kind: "solid", paths, tone, ...extra });
const L = (d: string, tone: Tone | "lit" = "lo", free = false): Mark => ({ kind: "line", d, tone, free });
const D = (points: Flat[], size = 0.5, tone: Tone = "mid"): Mark => ({ kind: "dots", points, size, tone });

// ---- Parts ----

function chassis() {
  put(undefined, CHASSIS, 0, FLOOR, [S(slab(CHASSIS, 0, FLOOR, 3), "lo", { halo: true })]);
  const board = box(X0 + 6, Y0 + 5, X1 - BEZEL - 2, Y1 - 5);
  const holes: Point3[] = [
    [board.x + 5, board.y + 5, BOARD],
    [board.x + board.w - 5, board.y + 5, BOARD],
    [board.x + 5, board.y + board.d - 5, BOARD],
    [board.x + board.w - 5, board.y + board.d - 5, BOARD],
    [10, board.y + 5, BOARD],
    [10, board.y + board.d - 5, BOARD],
  ];
  put("board", board, FLOOR, BOARD, [
    S(slab(board, FLOOR, 1, 2), "lo", { crease: "none" }),
    L(planOutline(insetPlan(board, 2.5), BOARD, P, 2), "faint"),
    L(join(holes.map(([x, y]) => onTop(circleRing(x, y, 2, 14), BOARD, P, true))), "lo"),
    D(holes.map(at), 0.55),
  ]);
  // Far side wall and rear wall: their inner faces show.
  const far = box(X0, Y0, X1 - BEZEL, Y0 + WALL);
  put("chassis", far, 0, H, [S(slab(far, 0, H, 2, 0.4), "mid")]);
  const rear = box(X0, Y0 + WALL, X0 + WALL, Y1 - WALL);
  put("chassis", rear, 0, H, [S(slab(rear, 0, H, 2, 0.4), "mid")]);
}

function nearWall() {
  const near = box(X0, Y1 - WALL, X1 - BEZEL, Y1);
  // Slide rail on the outside, with its rivets.
  const rail = box(X0 + 20, Y1, X1 - BEZEL - 30, Y1 + 1.6);
  const rivets: Point3[] = [];
  for (let x = rail.x + 8; x < rail.x + rail.w - 4; x += 32) rivets.push([x, Y1 + 1.6, 9]);
  put("chassis", near, 0, H, [S(slab(near, 0, H, 2, 0.4), "mid"), L(sideSeam(near, 3, P, 2), "faint")]);
  put("chassis", rail, 6, 12, [S(slab(rail, 6, 6, 2), "mid"), L(seg([rail.x, Y1 + 1.6, 9], [rail.x + rail.w, Y1 + 1.6, 9]), "faint"), D(rivets.map(at), 0.55)]);
}

function bezel(spec: BladeSpec) {
  const plan = box(X1 - BEZEL, Y0, X1, Y1);
  const face = X1;
  const marks: Mark[] = [S(slab(plan, 0, H, 2, 0.6), "mid")];
  // Drive bays from the left of the face (−y), vents in the rest.
  const bay = 24;
  const bays: string[] = [];
  const handles: string[] = [];
  const leds: Flat[] = [];
  const act: Flat[] = [];
  let y = Y0 + 14;
  for (let index = 0; index < spec.drives; index++) {
    bays.push(faceRect(face, y, 3, y + bay - 2, 15));
    handles.push(seg([face, y + 3, 5], [face, y + bay - 5, 5]));
    leds.push(at([face, y + bay - 5, 12.5]));
    act.push(at([face, y + bay - 8, 12.5]));
    y += bay;
  }
  if (spec.drives) marks.push(L(join(bays), "mid"), L(join(handles), "lo"));
  // Vent perforations between the bays and the control panel.
  const vents: Flat[] = [];
  const ventFrom = y + 6;
  const ventTo = Y1 - 30;
  for (let vy = ventFrom; vy <= ventTo; vy += 3.2) for (let vz = 4; vz <= 14; vz += 2.5) vents.push(at([face, vy, vz]));
  marks.push(L(faceRect(face, ventFrom - 3, 2.6, ventTo + 3, 15.4), "lo"), D(vents, 0.45, "lo"));
  // Control panel: power button, ID LED, health LED.
  marks.push(L(sideRing([face, Y1 - 18, 9], 2.6, "x", P, 24), "mid"), L(sideRing([face, Y1 - 18, 9], 1.4, "x", P, 16), "lo"));
  put("bezel", plan, 0, H, marks);
  put("status", box(face, Y1 - 12, face + 0.5, Y1 - 6), 4, 14, [
    { kind: "led", points: [at([face, Y1 - 10, 12])], size: 0.9, state: spec.status },
    { kind: "led", points: [at([face, Y1 - 10, 7])], size: 0.9, state: "id" },
    ...(leds.length ? [{ kind: "led", points: leds, size: 0.75, state: "ok" } as Mark, { kind: "led", points: act, size: 0.75, state: "act" } as Mark] : []),
  ]);
  // Service tag that pulls out of the bezel, a label plate with three rule lines.
  const tag = box(face, -24, face + 7, -6);
  const rules = [0, 1, 2].map((row) => onTop([[face + 1.4 + row * 1.6, -21], [face + 1.4 + row * 1.6, row === 1 ? -14 : -10]], 1.6, P));
  put("tag", tag, 1, 1.6, [S(slab(tag, 1, 0.6, 2), "lo", { crease: "none" }), L(join(rules), "lo", true)]);
  // Rack ears with their mounting holes and pull handles.
  for (const [ey0, ey1] of [
    [Y0 - 8, Y0],
    [Y1, Y1 + 8],
  ]) {
    const ear = box(X1 - 4, ey0, X1, ey1);
    const cy = (ey0 + ey1) / 2;
    put("bezel", ear, 0, H, [S(slab(ear, 0, H, 2, 0.4), "mid"), L(join([sideRing([X1, cy, 4.5], 1.3, "x", P, 16), sideRing([X1, cy, 13.5], 1.3, "x", P, 16)]), "lo")]);
    const grip = box(X1, cy - 1.5, X1 + 4, cy + 1.5);
    put("bezel", grip, 7, 11, [S(slab(grip, 7, 4, 2), "mid")]);
  }
}

function fans(spec: BladeSpec): FanFace[] {
  const out: FanFace[] = [];
  const x0 = 70;
  const depth = 18;
  const span = WID - WALL * 2 - 8;
  const pitch = span / spec.fans;
  for (let index = 0; index < spec.fans; index++) {
    const y0 = Y0 + WALL + 4 + index * pitch;
    const plan = box(x0, y0 + 0.6, x0 + depth, y0 + pitch - 0.6);
    const cy = y0 + pitch / 2;
    const cz = BOARD + 7.2;
    const face = x0 + depth;
    const r = Math.min(pitch / 2 - 2, 6.6);
    const screws: Flat[] = [
      at([face, plan.y + 1.6, BOARD + 1.6]),
      at([face, plan.y + plan.d - 1.6, BOARD + 1.6]),
      at([face, plan.y + 1.6, BOARD + 12.8]),
      at([face, plan.y + plan.d - 1.6, BOARD + 12.8]),
    ];
    put(`fan${index}`, plan, BOARD, BOARD + 14.4, [
      S(slab(plan, BOARD, 14.4, 2, 0.4), "mid"),
      L(join([sideRing([face, cy, cz], r, "x", P, 32), sideRing([face, cy, cz], 2.2, "x", P, 16)]), "lo"),
      D(screws, 0.45),
      // Finger guard: one bar across the bore, ends on the housing.
      L(seg([face, cy - r, cz], [face, cy + r, cz]), "faint"),
    ]);
    out.push({ part: `fan${index}`, x: face, cy, cz, r0: 2.2, r1: r - 0.5 });
  }
  // Fan cage rail the modules drop into.
  const cage = box(x0 - 2, Y0 + WALL, x0, Y1 - WALL);
  put("fans", cage, BOARD, BOARD + 4, [S(slab(cage, BOARD, 4, 2), "lo")]);
  return out;
}

export interface FanFace {
  part: string;
  x: number;
  cy: number;
  cz: number;
  r0: number;
  r1: number;
}

function socket(index: number, cx: number, cy: number) {
  const part = `cpu${index}`;
  const base = box(cx - 19, cy - 19, cx + 19, cy + 19);
  const body = insetPlan(base, 1.5);
  const finTop = BOARD + 14;
  const fins: string[] = [];
  const finFace: string[] = [];
  for (let y = body.y + 2; y < body.y + body.d - 1; y += 2.4) {
    fins.push(onTop([[body.x + 0.4, y], [body.x + body.w - 0.4, y]], finTop, P));
    finFace.push(seg([body.x + body.w, y, BOARD + 2], [body.x + body.w, y, finTop]));
  }
  const screws: Point3[] = [
    [base.x + 1.2, base.y + 1.2, BOARD + 2],
    [base.x + base.w - 1.2, base.y + 1.2, BOARD + 2],
    [base.x + 1.2, base.y + base.d - 1.2, BOARD + 2],
    [base.x + base.w - 1.2, base.y + base.d - 1.2, BOARD + 2],
  ];
  put(part, base, BOARD, BOARD + 2, [S(slab(base, BOARD, 2, 2), "lo"), D(screws.map(at), 0.6, "hi")]);
  put(part, body, BOARD + 2, finTop, [S(slab(body, BOARD + 2, finTop - BOARD - 2, 2, 0.5), "hi"), L(join(fins), "lo"), L(join(finFace), "faint")]);
  // Voltage regulators in a row in front of the socket (toward the fans).
  const vrm: Mark[] = [];
  for (let k = 0; k < 6; k++) {
    const y = cy - 15 + k * 5.4;
    vrm.push(S(slab(box(cx + 24, y, cx + 27.4, y + 3.4), BOARD, 2.2, 1), "mid", { crease: "none" }));
  }
  put(`vrm${index}`, box(cx + 24, cy - 15, cx + 27.4, cy + 15.4), BOARD, BOARD + 2.2, vrm);
}

function dimms(index: number, cx: number, cy: number) {
  const part = `mem${index}`;
  const length = 60;
  const x0 = cx - length / 2 + 2;
  for (const side of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const y = side < 0 ? cy - 24 - k * 3.6 : cy + 22.6 + k * 3.6;
      const stick = box(x0, y, x0 + length, y + 1.4);
      const slot = box(x0 - 1.5, y - 0.6, x0 + length + 1.5, y + 2);
      const chips: string[] = [];
      for (let c = 0; c < 8; c++) {
        const cx0 = x0 + 4 + c * 7;
        chips.push(sideRect(y + 1.4, cx0, BOARD + 5, cx0 + 5, BOARD + 9));
      }
      put(part, slot, BOARD, BOARD + 2, [S(slab(slot, BOARD, 2, 1), "lo", { crease: "none" })]);
      put(part, stick, BOARD + 2, BOARD + 13.4, [S(slab(stick, BOARD + 2, 11.4, 1), "hi"), L(join(chips), "faint")]);
      for (const lx of [x0 - 1.5, x0 + length]) {
        const latch = box(lx, y - 0.4, lx + 1.5, y + 1.8);
        put(part, latch, BOARD + 2, BOARD + 9, [S(slab(latch, BOARD + 2, 7, 1), "mid", { crease: "none" })]);
      }
    }
  }
}

function power(spec: BladeSpec) {
  if (spec.power === "busbar") {
    // 48 V DC from the rack bus bar, through a blind-mate clip at the rear.
    const clip = box(X0 + WALL, 58, X0 + 22, 86);
    const fingers: string[] = [];
    for (let k = 0; k < 4; k++) fingers.push(onTop([[X0 + 4, 61 + k * 6.4], [X0 + 20, 61 + k * 6.4]], BOARD + 9, P));
    put("power", clip, BOARD, BOARD + 9, [S(slab(clip, BOARD, 9, 2, 0.4), "mid"), L(join(fingers), "lo")]);
    const shunt = box(X0 + 26, 62, X0 + 44, 82);
    put("power", shunt, BOARD, BOARD + 3, [S(slab(shunt, BOARD, 3, 2), "lo"), D([at([X0 + 30, 66, BOARD + 3]), at([X0 + 40, 78, BOARD + 3])], 0.55)]);
    return;
  }
  const units = spec.power === "dual" ? 2 : 1;
  const width = spec.power === "dual" ? 19 : 34;
  for (let k = 0; k < units; k++) {
    const y1 = Y1 - WALL - 1 - k * (width + 1);
    const plan = box(X0 + WALL, y1 - width, X0 + 86, y1);
    const z1 = BOARD + 13;
    const vents: Flat[] = [];
    for (let vx = plan.x + 6; vx < plan.x + 30; vx += 3) for (let vy = plan.y + 3; vy < plan.y + plan.d - 2; vy += 3) vents.push(at([vx, vy, z1]));
    const rules = [0, 1, 2].map((row) => onTop([[plan.x + 42, plan.y + 4 + row * 2.4], [plan.x + (row === 1 ? 60 : 70), plan.y + 4 + row * 2.4]], z1, P));
    put(`psu${k}`, plan, BOARD, z1, [
      S(slab(plan, BOARD, z1 - BOARD, 2, 0.5), "mid"),
      D(vents, 0.4, "lo"),
      L(planOutline(box(plan.x + 39, plan.y + 2, plan.x + 74, plan.y + Math.min(plan.d - 2, 11)), z1, P, 1), "faint"),
      L(join(rules), "lo", true),
      L(sideSeam(plan, BOARD + 4, P, 2), "faint"),
    ]);
  }
}

function card(kind: Card, level: number, lit: boolean) {
  const z = BOARD + 3 + level * 6;
  const plan = box(X0 + 8, Y0 + 10, X0 + 92, Y0 + 58);
  const marks: Mark[] = [S(slab(plan, z, 1.2, 2), lit ? "hi" : "mid", { lit })];
  // Gold fingers along the edge that plugs into the riser.
  const fingers: string[] = [];
  for (let y = plan.y + 6; y < plan.y + plan.d - 6; y += 1.6) fingers.push(onTop([[plan.x + plan.w - 4, y], [plan.x + plan.w - 0.6, y]], z + 1.2, P));
  marks.push(L(join(fingers), "lo"));
  const top = z + 1.2;
  put(lit ? "card" : "card2", plan, z, top, marks);
  // The card's main silicon under its heat sink.
  const sinkTall = level === 0 && kind !== "nitro" ? 9 : 4.4;
  const sink = box(plan.x + 30, plan.y + 10, plan.x + 60, plan.y + 38);
  const fins: string[] = [];
  for (let y = sink.y + 2; y < sink.y + sink.d - 1; y += 2.2) fins.push(onTop([[sink.x + 0.4, y], [sink.x + sink.w - 0.4, y]], top + sinkTall, P));
  put(lit ? "card" : "card2", sink, top, top + sinkTall, [S(slab(sink, top, sinkTall, 2, 0.4), lit ? "hi" : "mid", { lit }), L(join(fins), "lo")]);
  // Memory and support chips beside it.
  const chips: Mark[] = [];
  for (let k = 0; k < (kind === "boost" ? 4 : 2); k++) chips.push(S(slab(box(plan.x + 8, plan.y + 6 + k * 9, plan.x + 18, plan.y + 13 + k * 9), top, 1, 1), "mid", { crease: "none" }));
  put(lit ? "card" : "card2", box(plan.x + 8, plan.y + 6, plan.x + 18, plan.y + 40), top, top + 1, chips);
  // SFP/QSFP cages at the rear bracket.
  const cages: Mark[] = [];
  for (let k = 0; k < 2; k++) {
    const cage = box(plan.x, plan.y + 8 + k * 16, plan.x + 10, plan.y + 20 + k * 16);
    cages.push(S(slab(cage, top, 3.4, 1), "mid"));
  }
  put(lit ? "card" : "card2", box(plan.x, plan.y + 8, plan.x + 10, plan.y + 36), top, top + 3.4, cages);
}

function riser(spec: BladeSpec) {
  const plan = box(X0 + 94, Y0 + 8, X0 + 98, Y0 + 60);
  const tall = BOARD + 3 + (spec.cards.length - 1) * 6 + 4;
  const slots: string[] = spec.cards.map((_, level) => sideRect(plan.y + plan.d, plan.x + 0.6, BOARD + 3 + level * 6 - 0.6, plan.x + 3.4, BOARD + 3 + level * 6 + 1.8));
  put("riser", plan, BOARD, tall, [S(slab(plan, BOARD, tall - BOARD, 1), "lo"), L(join(slots), "faint")]);
  spec.cards.forEach((kind, level) => card(kind, level, level === spec.cards.length - 1));
}

function drives(spec: BladeSpec) {
  // NVMe carriers behind the bays, plugged into a backplane.
  const bay = 24;
  if (spec.drives) {
    const from = Y0 + 14;
    const to = from + spec.drives * bay - 2;
    const plane = box(100, from - 2, 102.4, to + 2);
    put("drives", plane, BOARD, BOARD + 13, [S(slab(plane, BOARD, 13, 1), "lo"), L(sideSeam(plane, BOARD + 10, P, 1), "faint")]);
    for (let k = 0; k < spec.drives; k++) {
      const y = from + k * bay;
      const carrier = box(103, y + 0.5, X1 - BEZEL, y + bay - 2.5);
      const ribs = [0.3, 0.6].map((f) => onTop([[carrier.x + 4, carrier.y + carrier.d * f], [carrier.x + carrier.w - 4, carrier.y + carrier.d * f]], BOARD + 11, P));
      put("drives", carrier, BOARD, BOARD + 11, [
        S(slab(carrier, BOARD, 11, 1, 0.4), "mid"),
        L(join(ribs), "faint"),
        D([at([carrier.x + 2, carrier.y + 2, BOARD + 11]), at([carrier.x + 2, carrier.y + carrier.d - 2, BOARD + 11])], 0.45),
      ]);
    }
  }
  // Front control board behind the power button and LEDs.
  const front = box(108, Y1 - 40, X1 - BEZEL - 1, Y1 - 6);
  const header = box(front.x + 4, front.y + 4, front.x + 8, front.y + 20);
  put("front", front, BOARD, BOARD + 1, [S(slab(front, BOARD, 1, 1), "lo", { crease: "none" }), D([at([front.x + 2, front.y + 2, BOARD + 1]), at([front.x + front.w - 2, front.y + front.d - 2, BOARD + 1])], 0.5)]);
  put("front", header, BOARD + 1, BOARD + 4, [S(slab(header, BOARD + 1, 3, 1), "mid")]);
}

function cableHeaders() {
  // MCIO connectors for PCIe cabling, between the memory banks and the fans.
  const marks: Mark[] = [];
  for (let k = 0; k < 4; k++) {
    const y = -9 + k * 4;
    marks.push(S(slab(box(58, y, 64, y + 3), BOARD, 2.6, 1), "mid"));
  }
  put("mcio", box(58, -9, 64, 6), BOARD, BOARD + 2.6, marks);
}

function boardParts() {
  // Root-of-trust chip, the part that measures firmware at boot.
  const trust = box(-40, -26, -30, -16);
  const pins: Flat[] = [];
  for (let k = 0; k < 5; k++) pins.push(at([trust.x - 0.8, trust.y + 1.5 + k * 1.75, BOARD]), at([trust.x + trust.w + 0.8, trust.y + 1.5 + k * 1.75, BOARD]));
  put("trust", trust, BOARD, BOARD + 1.4, [S(slab(trust, BOARD, 1.4, 1, 0.3), "hi"), D(pins, 0.35, "lo"), D([at([trust.x + 2, trust.y + 2, BOARD + 1.4])], 0.45, "hi")]);
  // Baseboard management controller.
  const bmc = box(-46, 2, -32, 16);
  put("bmc", bmc, BOARD, BOARD + 1.6, [S(slab(bmc, BOARD, 1.6, 1, 0.3), "mid"), L(planOutline(insetPlan(bmc, 2), BOARD + 1.6, P, 1), "faint")]);
  // Chipset with a low heat sink.
  const pch = box(-26, 26, -6, 46);
  const pchFins: string[] = [];
  for (let y = pch.y + 3; y < pch.y + pch.d - 2; y += 2.6) pchFins.push(onTop([[pch.x + 1, y], [pch.x + pch.w - 1, y]], BOARD + 5, P));
  put("pch", pch, BOARD, BOARD + 5, [S(slab(pch, BOARD, 5, 2, 0.4), "mid"), L(join(pchFins), "lo")]);
  // M.2 boot SSD with its standoff screw.
  const m2 = box(-50, -76, -16, -66);
  const flash: Mark[] = [S(slab(m2, BOARD + 0.6, 0.8, 1), "mid", { crease: "none" })];
  for (let k = 0; k < 3; k++) flash.push(S(slab(box(m2.x + 6 + k * 11, m2.y + 2, m2.x + 15 + k * 11, m2.y + 8), BOARD + 1.4, 0.7, 1), "lo", { crease: "none" }));
  flash.push(D([at([m2.x + 1.6, m2.y + m2.d / 2, BOARD + 1.4])], 0.6, "hi"));
  put("boot", m2, BOARD, BOARD + 2.1, flash);
  const m2slot = box(m2.x + m2.w, m2.y - 0.5, m2.x + m2.w + 3, m2.y + m2.d + 0.5);
  put("boot", m2slot, BOARD, BOARD + 2.2, [S(slab(m2slot, BOARD, 2.2, 1), "lo")]);
  // Bulk capacitors near the power entry.
  const caps: Mark[] = [];
  for (let k = 0; k < 5; k++) {
    caps.push(S(cylinder(-60 + k * 4.4, 54, 1.6, BOARD, 4.2, P, 16), "mid"));
  }
  put("caps", box(-62, 52, -40, 56), BOARD, BOARD + 4.2, caps);
  // CMOS battery.
  put("bmc", box(-20, 6, -10, 16), BOARD, BOARD + 0.8, [S(cylinder(-15, 11, 4.6, BOARD, 0.8, P, 28), "mid"), L(onTop(circleRing(-15, 11, 3.2, 24), BOARD + 0.8, P, true), "faint")]);
}

// ---- Detail: walls, silkscreen, small parts, cables ----

const SOCKETS: Array<[number, number]> = [
  [22, -44],
  [22, 40],
];

function wallDetail() {
  // Lid screw holes along the tops of the side walls.
  const screws: Flat[] = [];
  for (let x = X0 + 12; x < X1 - BEZEL - 6; x += 46) screws.push(at([x, Y0 + WALL / 2, H]));
  put("chassis", box(X0, Y0, X1 - BEZEL, Y0 + WALL), H, H, [D(screws, 0.5, "mid")]);
  // Cooling slots pressed into the far wall beside the CPUs, closed slots on its inner face.
  const slots: string[] = [];
  for (let x = -30; x <= 60; x += 6) slots.push(sideRect(Y0 + WALL, x, 7, x + 2.4, 13));
  put("chassis", box(-30, Y0 + WALL, 63, Y0 + WALL + 0.1), 7, 13, [L(join(slots), "lo")]);
  // Openings in the rear wall for the card bracket, the rear I/O and the power entry.
  const openings = [faceRect(X0 + WALL, -86, 4, -36, 16), faceRect(X0 + WALL, -24, 4, 26, 13)];
  put("chassis", box(X0 + WALL, -86, X0 + WALL + 0.1, 26), 4, 16, [L(join(openings), "faint")]);
}

function silkscreen() {
  // Keep-out frames and corner ticks around each socket, printed on the board.
  const frames: string[] = [];
  const ticks: string[] = [];
  for (const [cx, cy] of SOCKETS) {
    frames.push(planOutline(box(cx - 21.5, cy - 21.5, cx + 21.5, cy + 21.5), BOARD, P, 1));
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      const x = cx + sx * 23.5;
      const y = cy + sy * 23.5;
      ticks.push(onTop([[x - sx * 3, y], [x, y], [x, y - sy * 3]], BOARD, P));
    }
  }
  // Pin-1 field of tiny decoupling parts behind each socket.
  const smd: Flat[] = [];
  for (const [cx, cy] of SOCKETS) for (let k = 0; k < 9; k++) for (let c = 0; c < 2; c++) smd.push(at([cx - 25 - c * 1.6, cy - 12 + k * 3, BOARD]));
  put("board", box(X0 + 6, Y0 + 5, X1 - BEZEL - 2, Y1 - 5), BOARD, BOARD, [L(join(frames), "faint"), L(join(ticks), "lo", true), D(smd, 0.35, "lo")]);
}

// A small chip with pins down both long sides.
function chip(part: string, x: number, y: number, w: number, d: number, h = 1, pins = 0) {
  const plan = box(x, y, x + w, y + d);
  const marks: Mark[] = [S(slab(plan, BOARD, h, 1, 0.2), "mid", { crease: "none" })];
  if (pins) {
    const legs: Flat[] = [];
    for (let k = 0; k < pins; k++) {
      const py = y + ((k + 0.5) / pins) * d;
      legs.push(at([x - 0.6, py, BOARD]), at([x + w + 0.6, py, BOARD]));
    }
    marks.push(D(legs, 0.3, "lo"));
  }
  marks.push(D([at([x + 0.9, y + 0.9, BOARD + h])], 0.3, "hi"));
  put(part, plan, BOARD, BOARD + h, marks);
}

// A pin header: a plastic shroud with a row of pin tips on top.
function header(part: string, x: number, y: number, cols: number, rows: number, pitch = 1.6, h = 2.6) {
  const plan = box(x, y, x + cols * pitch + 0.8, y + rows * pitch + 0.8);
  const tips: Flat[] = [];
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) tips.push(at([x + 0.4 + (c + 0.5) * pitch, y + 0.4 + (r + 0.5) * pitch, BOARD + h]));
  put(part, plan, BOARD, BOARD + h, [S(slab(plan, BOARD, h, 1), "lo"), D(tips, 0.3, "hi")]);
}

// A flat cable lying on the board along x or y, its conductors running end to end.
function ribbon(part: string, from: [number, number], to: [number, number], width: number, conductors = 4) {
  const along = from[1] === to[1] ? "x" : "y";
  const [a, b] = along === "x" ? [Math.min(from[0], to[0]), Math.max(from[0], to[0])] : [Math.min(from[1], to[1]), Math.max(from[1], to[1])];
  const c = along === "x" ? from[1] : from[0];
  const plan = along === "x" ? box(a, c - width / 2, b, c + width / 2) : box(c - width / 2, a, c + width / 2, b);
  const z = BOARD + 1;
  const lines: string[] = [];
  for (let k = 1; k < conductors; k++) {
    const off = c - width / 2 + (k / conductors) * width;
    lines.push(along === "x" ? onTop([[a, off], [b, off]], z, P) : onTop([[off, a], [off, b]], z, P));
  }
  put(part, plan, BOARD, z, [S(slab(plan, BOARD, 1, 1), "mid", { crease: "none" }), L(join(lines), "faint")]);
}

function boardDetail(spec: BladeSpec) {
  // Firmware flash, clock generator, TPM daughter card and a jumper block near the BMC.
  chip("bmc", -48, -58, 5, 4, 0.9, 4);
  chip("bmc", -48, -50, 5, 4, 0.9, 4);
  chip("pch", -38, -58, 6, 6, 1);
  const tpm = box(-24, -54, -22.6, -38);
  put("tpm", tpm, BOARD, BOARD + 9, [S(slab(tpm, BOARD, 9, 1), "mid"), L(sideRect(tpm.y + tpm.d, tpm.x + 0.3, BOARD + 4, tpm.x + 1.1, BOARD + 7), "faint")]);
  header("tpm", -27, -54, 1, 10, 1.6, 2);
  header("bmc", -36, -44, 3, 2);
  // USB and SATA headers, the BMC's network PHY and a front-panel header.
  header("io", -58, 24, 5, 2, 1.8, 3.4);
  for (const y of [22, 27.5]) {
    const sata = box(-40, y, -34, y + 3.6);
    put("io", sata, BOARD, BOARD + 3.8, [S(slab(sata, BOARD, 3.8, 1), "lo"), L(planOutline(insetPlan(sata, 0.8), BOARD + 3.8, P, 1), "faint")]);
  }
  chip("bmc", -40, 36, 6, 6, 1, 3);
  header("io", -58, 40, 6, 2);
  // Chokes behind each VRM row.
  for (const [cx, cy] of SOCKETS) {
    const marks: Mark[] = [];
    for (let k = 0; k < 5; k++) {
      const y = cy - 14 + k * 6.2;
      const choke = box(cx + 28.6, y, cx + 32.4, y + 4.4);
      marks.push(S(slab(choke, BOARD, 3.6, 1, 0.3), "mid"), D([at([cx + 30.5, y + 2.2, BOARD + 3.6])], 0.35, "lo"));
    }
    put(cx === 22 && cy < 0 ? "vrm0" : "vrm1", box(cx + 28.6, cy - 14, cx + 32.4, cy + 15.2), BOARD, BOARD + 3.6, marks);
  }
  // Rear I/O block against the rear wall: two network jacks, a USB stack and a serial port.
  const jacks: Array<[number, number, number]> = [
    [-22, -13, 10],
    [-11, -2, 10],
    [1, 8, 8],
    [11, 23, 6],
  ];
  for (const [y0, y1, h] of jacks) {
    const jack = box(X0 + WALL, y0, X0 + 16, y1);
    put("io", jack, BOARD, BOARD + h, [S(slab(jack, BOARD, h, 1, 0.4), "mid"), L(sideRect(y1, X0 + WALL + 3, BOARD + 2, X0 + 13, BOARD + h - 2), "faint")]);
  }
  // A spare PCIe slot and an OCP 3.0 connector, both empty.
  const slot = box(-112, -26, -74, -22.4);
  const pins: string[] = [];
  for (let x = slot.x + 2; x < slot.x + slot.w - 1; x += 2.4) pins.push(onTop([[x, slot.y + 1], [x, slot.y + slot.d - 1]], BOARD + 2.4, P));
  put("slot", slot, BOARD, BOARD + 2.4, [S(slab(slot, BOARD, 2.4, 1), "lo"), L(join(pins), "faint")]);
  const ocp = box(-122, 2, -82, 7);
  put("slot", ocp, BOARD, BOARD + 3, [S(slab(ocp, BOARD, 3, 1), "lo"), L(planOutline(insetPlan(ocp, 1.2), BOARD + 3, P, 1), "faint")]);
  // Auxiliary power for the riser, fed from a connector by the power entry.
  const aux = box(-71, 32, -63, 40);
  put("power", aux, BOARD, BOARD + 4.4, [S(slab(aux, BOARD, 4.4, 1, 0.3), "mid"), D([at([-69, 34, BOARD + 4.4]), at([-65, 34, BOARD + 4.4]), at([-69, 38, BOARD + 4.4]), at([-65, 38, BOARD + 4.4])], 0.35, "hi")]);
  ribbon("riser", [-67, 32], [-67, -27.5], 3, 4);
  ribbon("riser", [-68.5, -29], [-62, -29], 3, 4);
  const riserPower = box(-62, -32, -56.4, -26);
  put("riser", riserPower, BOARD, BOARD + 4, [S(slab(riserPower, BOARD, 4, 1, 0.3), "mid")]);
  // Fan board along the cage, one header per fan.
  const fanBoard = box(64.6, Y0 + WALL + 4, 67.6, Y1 - WALL - 4);
  put("fans", fanBoard, BOARD, BOARD + 0.8, [S(slab(fanBoard, BOARD, 0.8, 1), "lo", { crease: "none" })]);
  const pitch = (WID - WALL * 2 - 8) / spec.fans;
  for (let k = 0; k < spec.fans; k++) {
    const y = Y0 + WALL + 4 + k * pitch + pitch / 2 - 2.4;
    const fh = box(65.2, y, 67.2, y + 4.8);
    put(`fan${k}`, fh, BOARD + 0.8, BOARD + 3, [S(slab(fh, BOARD + 0.8, 2.2, 1), "mid"), D([at([66.2, y + 1.2, BOARD + 3]), at([66.2, y + 2.4, BOARD + 3]), at([66.2, y + 3.6, BOARD + 3])], 0.28, "hi")]);
  }
  // Card retaining bracket at the rear, screwed to the chassis through its tab.
  const bracket = box(X0 + WALL, -86, X0 + WALL + 1.6, -36);
  const tab = box(X0 + WALL, -86, X0 + WALL + 6, -78);
  put("card", bracket, BOARD, H - 1, [S(slab(bracket, BOARD, H - 1 - BOARD, 1), "mid")]);
  put("card", tab, H - 1, H - 0.4, [S(slab(tab, H - 1, 0.6, 1), "mid", { crease: "none" }), D([at([X0 + WALL + 3.6, -82, H - 0.4])], 0.55, "hi")]);
}

// What sits between the fan wall and the bezel, by provider.
function frontDetail(spec: BladeSpec) {
  // Cable trough behind the drives, running the width of the chassis.
  const trough = box(91, Y0 + WALL + 4, 97, Y1 - WALL - 4);
  put("front", trough, BOARD, BOARD + 3, [S(slab(trough, BOARD, 3, 1, 0.3), "lo"), L(planOutline(insetPlan(trough, 1.2), BOARD + 3, P, 1), "faint")]);
  const start = spec.drives ? Y0 + 14 + spec.drives * 24 + 2 : Y0 + 8;
  if (spec.power === "busbar") {
    // 48 V to 12 V converter brick: the board runs on 12 V, the rack bus bar delivers 48 V.
    const brick = box(106, start, 134, start + 30);
    const fins: string[] = [];
    for (let y = brick.y + 2.5; y < brick.y + brick.d - 1; y += 2.5) fins.push(onTop([[brick.x + 1, y], [brick.x + brick.w - 1, y]], BOARD + 9, P));
    put("power", brick, BOARD, BOARD + 9, [S(slab(brick, BOARD, 9, 2, 0.4), "mid"), L(join(fins), "lo")]);
    chip("front", 110, start + 36, 10, 8, 1.2, 4);
    header("front", 124, start + 37, 4, 2);
  } else {
    // Power distribution board with screw terminals and fuses.
    const span = spec.drives ? Math.min(36, Y1 - 44 - start) : 46;
    const pdb = box(104, start, 136, start + span);
    const terminals: Mark[] = [];
    for (let k = 0; k < 3; k++) terminals.push(S(cylinder(110, start + 7 + k * 11, 2.2, BOARD + 1.2, 3.4, P, 20), "mid"), D([at([110, start + 7 + k * 11, BOARD + 4.6])], 0.45, "hi"));
    put("pdb", pdb, BOARD, BOARD + 1.2, [S(slab(pdb, BOARD, 1.2, 1), "lo", { crease: "none" }), D([at([pdb.x + 2, pdb.y + 2, BOARD + 1.2]), at([pdb.x + pdb.w - 2, pdb.y + 2, BOARD + 1.2]), at([pdb.x + 2, pdb.y + pdb.d - 2, BOARD + 1.2])], 0.45)]);
    put("pdb", box(107.8, start + 4.8, 112.2, start + 31.2), BOARD + 1.2, BOARD + 4.6, terminals);
    for (let k = 0; k < 2; k++) {
      const fuse = box(118, start + 6 + k * 10, 130, start + 10 + k * 10);
      put("pdb", fuse, BOARD + 1.2, BOARD + 3.6, [S(slab(fuse, BOARD + 1.2, 2.4, 1, 0.3), "hi")]);
    }
    if (!spec.drives) {
      // No drives: a sensor board and the front-panel cable fill the bay.
      chip("front", 105, start + 56, 11, 9, 1.2, 4);
      header("front", 127, start + 57, 3, 2);
      ribbon("front", [121, start + span], [121, Y1 - 40], 3, 5);
    }
  }
}

// ---- Painter's order ----

// Two disjoint boxes always have a separating axis. The viewer looks from +x, +y, +z,
// so whichever box lies on the far side of that axis is painted first.
function before(a: Item, b: Item) {
  const [ax0, ax1, ay0, ay1, az0, az1] = a.box;
  const [bx0, bx1, by0, by1, bz0, bz1] = b.box;
  const e = 0.01;
  if (az1 <= bz0 + e && !(ax1 <= bx0 + e || bx1 <= ax0 + e || ay1 <= by0 + e || by1 <= ay0 + e)) return true;
  if (bz1 <= az0 + e && !(ax1 <= bx0 + e || bx1 <= ax0 + e || ay1 <= by0 + e || by1 <= ay0 + e)) return false;
  if (ax1 <= bx0 + e) return true;
  if (bx1 <= ax0 + e) return false;
  if (ay1 <= by0 + e) return true;
  if (by1 <= ay0 + e) return false;
  if (az1 <= bz0 + e) return true;
  if (bz1 <= az0 + e) return false;
  return null;
}

const centre = (item: Item): Point3 => [(item.box[0] + item.box[1]) / 2, (item.box[2] + item.box[3]) / 2, (item.box[4] + item.box[5]) / 2];

function painted(list: Item[]) {
  const n = list.length;
  const after: number[][] = Array.from({ length: n }, () => []);
  const incoming = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const order = before(list[i]!, list[j]!);
      if (order === true) {
        after[i]!.push(j);
        incoming[j]++;
      } else if (order === false) {
        after[j]!.push(i);
        incoming[i]++;
      }
    }
  }
  const depth = list.map((item) => depthOf(centre(item), P));
  const ready = list.map((_, index) => index).filter((index) => incoming[index] === 0);
  const out: Item[] = [];
  while (ready.length) {
    ready.sort((a, b) => depth[b]! - depth[a]!);
    const next = ready.pop()!;
    out.push(list[next]!);
    for (const j of after[next]!) if (--incoming[j] === 0) ready.push(j);
  }
  if (out.length < n) for (const item of list) if (!out.includes(item)) out.push(item);
  return out;
}

export interface Blade {
  items: Item[];
  fans: FanFace[];
  projection: Projection;
}

export function buildBlade(spec: BladeSpec): Blade {
  items.length = 0;
  count = 0;
  chassis();
  wallDetail();
  silkscreen();
  const floorItems = items.splice(0);
  bezel(spec);
  nearWall();
  const frontItems = items.splice(0);
  const fanFaces = fans(spec);
  socket(0, 22, -44);
  dimms(0, 22, -44);
  socket(1, 22, 40);
  dimms(1, 22, 40);
  power(spec);
  riser(spec);
  boardParts();
  drives(spec);
  cableHeaders();
  boardDetail(spec);
  frontDetail(spec);
  const inside = painted(items.splice(0));
  const front = painted(frontItems);
  return { items: [...floorItems, ...inside, ...front], fans: fanFaces, projection: P };
}

