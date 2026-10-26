import { iso, pathOf, type Flat, type Projection } from "@/components/iso/iso-kit";
import type { FanFace } from "./geometry";

const BLADES = 7;

// Fan blades on the face plane x = fan.x, each swept a little so the rotor reads as a rotor.
export function spokesOf(fan: FanFace, angle: number, P: Projection) {
  const paths: string[] = [];
  for (let blade = 0; blade < BLADES; blade++) {
    const start = angle + (blade / BLADES) * Math.PI * 2;
    const points: Flat[] = [];
    for (let step = 0; step <= 6; step++) {
      const t = step / 6;
      const r = fan.r0 + (fan.r1 - fan.r0) * t;
      const a = start + t * 0.7;
      points.push(iso([fan.x, fan.cy + r * Math.cos(a), fan.cz + r * Math.sin(a)], P));
    }
    paths.push(pathOf(points));
  }
  return paths.join("");
}
