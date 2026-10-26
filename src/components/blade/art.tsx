import * as React from "react";
import { Dots, Line, Solid } from "@/components/iso/react/draw";
import { buildBlade, type BladeSpec, type Mark } from "./geometry";
import { spokesOf } from "./spokes";

export function mark(item: Mark, index: number) {
  switch (item.kind) {
    case "solid":
      return <Solid key={index} paths={item.paths} tone={item.tone} lit={item.lit} flat={item.flat} crease={item.crease} halo={item.halo} />;
    case "line":
      return <Line key={index} d={item.d} tone={item.tone} free={item.free || undefined} />;
    case "dots":
      return <Dots key={index} points={item.points} size={item.size} tone={item.tone} />;
    case "led":
      return (
        <g key={index} className="blade-leds" data-state={item.state}>
          {item.points.map(([x, y], dot) => (
            <circle key={dot} cx={Math.round(x * 10) / 10} cy={Math.round(y * 10) / 10} r={item.size ?? 0.8} />
          ))}
        </g>
      );
  }
}

// Static art for one blade, in painter's order. Fan rotors get a path the live layer turns.
export function bladeArt(spec: BladeSpec) {
  const blade = buildBlade(spec);
  const fanByPart = new Map(blade.fans.map((fan) => [fan.part, fan]));
  const art = (
    <g key="blade-art">
      {blade.items.map((item) => {
        const fan = item.part ? fanByPart.get(item.part) : undefined;
        return (
          <g key={item.id} data-part={item.part}>
            {item.marks.map(mark)}
            {fan ? <path className="iso-line" data-tone="mid" data-spoke={fan.part} d={spokesOf(fan, 0, blade.projection)} /> : null}
          </g>
        );
      })}
    </g>
  );
  return { art, fans: blade.fans, projection: blade.projection };
}
