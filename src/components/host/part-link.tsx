"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const FOCUS_EVENT = "blade:focus";
const ACTIVE_EVENT = "blade:active";
const CPU = /^(cpu|vrm)\d?$/;

const matches = (link: string, active: string | null) => !!active && (active === link || (link === "cpu" && CPU.test(active)) || (link === "mem" && /^mem\d?$/.test(active)));

// Wraps a piece of the page that describes a part of the server: pointing at either lights both.
export function PartLink({ part, className, children, as = "div" }: { part: string; className?: string; children: React.ReactNode; as?: "div" | "tr" }) {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    const onActive = (event: Event) => setOn(matches(part, (event as CustomEvent<string | null>).detail));
    window.addEventListener(ACTIVE_EVENT, onActive);
    return () => window.removeEventListener(ACTIVE_EVENT, onActive);
  }, [part]);
  const Tag = as;
  const send = (detail: string | null) => window.dispatchEvent(new CustomEvent(FOCUS_EVENT, { detail }));
  return (
    <Tag
      data-on={on ? "" : undefined}
      onPointerEnter={() => send(part)}
      onPointerLeave={() => send(null)}
      onFocus={() => send(part)}
      onBlur={() => send(null)}
      className={cn(as === "tr" ? "border-b transition-colors data-[on]:bg-muted/70" : "rounded-xl transition-shadow data-[on]:ring-2 data-[on]:ring-ring/70", className)}
    >
      {children}
    </Tag>
  );
}
