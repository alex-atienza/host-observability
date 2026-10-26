"use client";

import * as React from "react";
import { animate } from "motion/react";
import type { Flat } from "@/components/iso/iso-kit";

// Zoom and pan for a figure: the camera lives in a ref and is written straight to a
// group's transform, so moving it never re-renders the scene.

export interface Camera {
  k: number;
  tx: number;
  ty: number;
}

export interface FleetCamera {
  zoomBy: (factor: number) => void;
  fit: () => void;
}

const MIN_ZOOM = 1;
const WEIGHT = 0.6; // the kit's line weight in px, held constant on screen while zoomed
const round = (v: number) => Math.round(v * 100) / 100;

export function useCamera({
  anchor,
  width: WIDTH,
  height: HEIGHT,
  maxZoom: MAX_ZOOM = 6,
  onZoom,
  onChange,
}: {
  anchor: React.RefObject<SVGGElement | null>;
  width: number;
  height: number;
  maxZoom?: number;
  onZoom?: (zoom: number) => void;
  onChange?: (camera: Camera) => void;
}) {
  const camNode = React.useRef<SVGGElement | null>(null);
  const cam = React.useRef({ k: 1, tx: 0, ty: 0 });
  const flight = React.useRef<{ stop: () => void } | null>(null);
  const dragged = React.useRef(false);
  const zoomShown = React.useRef(1);

  const apply = React.useCallback(() => {
    const node = camNode.current;
    if (!node) return;
    const { k, tx, ty } = cam.current;
    node.setAttribute("transform", `translate(${round(tx)} ${round(ty)}) scale(${Math.round(k * 1000) / 1000})`);
    node.style.setProperty("--anatomy-weight", `${WEIGHT / k}px`);
    const svg = node.ownerSVGElement;
    if (svg) {
      svg.style.touchAction = k > 1.001 ? "none" : "pan-y";
      svg.toggleAttribute("data-zoomed", k > 1.001);
    }
    const shownZoom = Math.round(k * 10) / 10;
    if (shownZoom !== zoomShown.current) {
      zoomShown.current = shownZoom;
      onZoom?.(shownZoom);
    }
    onChange?.(cam.current);
  }, [onZoom, onChange]);
  const setCam = React.useCallback(
    (next: { k: number; tx: number; ty: number }, smooth = false) => {
      flight.current?.stop();
      const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next.k));
      const to = { k: z, tx: Math.min(0, Math.max(WIDTH - WIDTH * z, next.tx)), ty: Math.min(0, Math.max(HEIGHT - HEIGHT * z, next.ty)) };
      if (!smooth || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        cam.current = to;
        apply();
        return;
      }
      const from = { ...cam.current };
      flight.current = animate(0, 1, {
        duration: 0.5,
        ease: [0.32, 0.72, 0, 1],
        onUpdate: (t) => {
          // Interpolate the zoom in log space so it feels even, and the pan with it.
          const k = from.k * Math.pow(to.k / from.k, t);
          const f = Math.abs(to.k - from.k) > 1e-6 ? (k - from.k) / (to.k - from.k) : t;
          cam.current = { k, tx: from.tx + (to.tx - from.tx) * f, ty: from.ty + (to.ty - from.ty) * f };
          apply();
        },
      });
    },
    [apply, MAX_ZOOM, WIDTH, HEIGHT],
  );
  // Zoom by a factor about a point in viewBox coordinates.
  const zoomAt = React.useCallback(
    (px: number, py: number, factor: number, smooth = false) => {
      const { k, tx, ty } = cam.current;
      const nk = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k * factor));
      setCam({ k: nk, tx: px - ((px - tx) * nk) / k, ty: py - ((py - ty) * nk) / k }, smooth);
    },
    [setCam, MAX_ZOOM],
  );
  const fit = React.useCallback(() => setCam({ k: 1, tx: 0, ty: 0 }, true), [setCam]);

  // Fit a box (in viewBox units, at zoom 1) into the view; the same box again goes back out.
  const zoomToBox = React.useCallback(
    (x0: number, y0: number, x1: number, y1: number, fill = 0.82) => {
      const k = Math.min(MAX_ZOOM, (WIDTH * fill) / (x1 - x0), (HEIGHT * fill) / (y1 - y0));
      const tx = WIDTH / 2 - ((x0 + x1) / 2) * k;
      const ty = HEIGHT / 2 - ((y0 + y1) / 2) * k;
      if (Math.abs(cam.current.k - k) < 0.05 && Math.abs(cam.current.tx - tx) < 4) return fit();
      setCam({ k, tx, ty }, true);
    },
    [setCam, fit, MAX_ZOOM, WIDTH, HEIGHT],
  );

  // Wheel with Ctrl/⌘ (and trackpad pinch, which arrives as Ctrl + wheel) zooms; a plain
  // wheel scrolls the page. Touch: two fingers pinch, one finger pans once zoomed in.
  React.useEffect(() => {
    const svg = anchor.current?.ownerSVGElement;
    if (!svg) return;
    apply();
    const toView = (clientX: number, clientY: number) => {
      const ctm = svg.getScreenCTM();
      if (!ctm) return [WIDTH / 2, HEIGHT / 2] as Flat;
      const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
      return [point.x, point.y] as Flat;
    };
    const unit = () => svg.getScreenCTM()?.a ?? 1;

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const delta = Math.max(-60, Math.min(60, event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY));
      const [px, py] = toView(event.clientX, event.clientY);
      zoomAt(px, py, Math.exp(-delta * 0.012));
    };
    // Safari's own pinch events.
    let gestureStart = 1;
    const onGestureStart = (event: Event) => {
      event.preventDefault();
      gestureStart = cam.current.k;
    };
    const onGestureChange = (event: Event) => {
      event.preventDefault();
      const e = event as Event & { scale: number; clientX: number; clientY: number };
      const [px, py] = toView(e.clientX, e.clientY);
      zoomAt(px, py, (gestureStart * e.scale) / cam.current.k);
    };

    const pointers = new Map<number, Flat>();
    let pan: { x: number; y: number; tx: number; ty: number } | null = null;
    let pinch: { distance: number; k: number } | null = null;
    const spread = () => {
      const [a, b] = [...pointers.values()];
      return a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : 0;
    };
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      pointers.set(event.pointerId, [event.clientX, event.clientY]);
      dragged.current = false;
      if (pointers.size === 2) {
        pan = null;
        pinch = { distance: spread(), k: cam.current.k };
      } else if (pointers.size === 1 && (event.pointerType === "mouse" || cam.current.k > 1.001)) {
        pan = { x: event.clientX, y: event.clientY, tx: cam.current.tx, ty: cam.current.ty };
      }
    };
    const onMove = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, [event.clientX, event.clientY]);
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()] as [Flat, Flat];
        const [px, py] = toView((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        zoomAt(px, py, (pinch.k * (spread() / pinch.distance)) / cam.current.k);
        dragged.current = true;
        return;
      }
      if (!pan) return;
      const dx = event.clientX - pan.x;
      const dy = event.clientY - pan.y;
      if (!dragged.current && Math.hypot(dx, dy) < 4) return;
      if (!dragged.current) {
        dragged.current = true;
        svg.setPointerCapture(event.pointerId);
        svg.setAttribute("data-panning", "");
      }
      if (cam.current.k <= 1.001) return;
      const u = unit();
      setCam({ k: cam.current.k, tx: pan.tx + dx / u, ty: pan.ty + dy / u });
    };
    const onUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      if (pointers.size < 2) pinch = null;
      if (!pointers.size) {
        pan = null;
        svg.removeAttribute("data-panning");
        // The click that ends a drag is swallowed once; any later click counts.
        if (dragged.current) window.setTimeout(() => (dragged.current = false), 0);
      }
    };

    svg.addEventListener("wheel", onWheel, { passive: false });
    svg.addEventListener("gesturestart", onGestureStart);
    svg.addEventListener("gesturechange", onGestureChange);
    svg.addEventListener("pointerdown", onDown);
    svg.addEventListener("pointermove", onMove);
    svg.addEventListener("pointerup", onUp);
    svg.addEventListener("pointercancel", onUp);
    return () => {
      svg.removeEventListener("wheel", onWheel);
      svg.removeEventListener("gesturestart", onGestureStart);
      svg.removeEventListener("gesturechange", onGestureChange);
      svg.removeEventListener("pointerdown", onDown);
      svg.removeEventListener("pointermove", onMove);
      svg.removeEventListener("pointerup", onUp);
      svg.removeEventListener("pointercancel", onUp);
      flight.current?.stop();
    };
  }, [anchor, apply, setCam, zoomAt, WIDTH, HEIGHT]);

  return { camNode, cam, dragged, setCam, zoomAt, fit, zoomToBox };
}
