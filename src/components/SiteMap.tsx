import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/*
  A living site plan, drawn like an architect's sheet: roads, buildings, a plaza,
  cameras with panning fields of view, and cars and people moving through.
  Colour roles: cameras, their fields of view and tripwires are pink; anything detected
  (people, cars, the pointer, tripwire events) is sky blue, which reads best as text.
  Cameras turn to look at the pointer.
  Colours mirror the tokens in index.css.
*/

const INK = "21,20,26";
const SKY_DEEP = "#1d6aa0";
const PAPER = "#f7f4ee";
const PINK = "238,147,178";
const PINK_DEEP = "#b03d68";
const CARD = "#fcfbf8";
const MONO = '"JetBrains Mono Variable", ui-monospace, monospace';

type Pt = { x: number; y: number };
type Rect = [number, number, number, number]; // u0, v0, u1, v1 (fractions of width / height)

const ROAD_H = { v: 0.64, half: 0.07 };
const ROAD_V = { u: 0.4, half: 0.06 };

const BUILDINGS: Rect[] = [
  [0.04, 0.07, 0.3, 0.46],
  [0.52, 0.06, 0.74, 0.28],
  [0.8, 0.06, 0.96, 0.5],
  [0.05, 0.8, 0.29, 0.95],
  [0.55, 0.8, 0.95, 0.95],
];
const PLAZA: Rect = [0.52, 0.34, 0.74, 0.5];
const TREES: [number, number][] = [
  [0.1, 0.515], [0.2, 0.515], [0.62, 0.77], [0.72, 0.77], [0.86, 0.77], [0.495, 0.12], [0.495, 0.22], [0.9, 0.53],
];

type Cam = { u: number; v: number; tu: number; tv: number; label: string; phase: number; speed: number; angle: number };
const makeCams = (): Cam[] => [
  { u: 0.3, v: 0.46, tu: 0.45, tv: 0.7, label: "CAM 1", phase: 0, speed: 0.33, angle: 0 },
  { u: 0.8, v: 0.5, tu: 0.58, tv: 0.66, label: "CAM 2", phase: 1.7, speed: 0.27, angle: 0 },
  { u: 0.29, v: 0.8, tu: 0.42, tv: 0.55, label: "CAM 3", phase: 3.1, speed: 0.3, angle: 0 },
  { u: 0.74, v: 0.28, tu: 0.6, tv: 0.45, label: "CAM 4", phase: 4.4, speed: 0.36, angle: 0 },
];

type Car = { axis: "h" | "v"; dir: 1 | -1; lane: number; speed: number; s: number; prev: number; id: string; trail: Pt[]; lastTrail: number };
const makeCars = (): Car[] => [
  { axis: "h", dir: 1, lane: 0.672, speed: 0.075, s: 0.05, prev: 0.05, id: "12", trail: [], lastTrail: 0 },
  { axis: "h", dir: 1, lane: 0.672, speed: 0.075, s: 0.6, prev: 0.6, id: "23", trail: [], lastTrail: 0 },
  { axis: "h", dir: -1, lane: 0.608, speed: 0.06, s: 0.7, prev: 0.7, id: "31", trail: [], lastTrail: 0 },
  { axis: "v", dir: 1, lane: 0.428, speed: 0.085, s: 0.1, prev: 0.1, id: "07", trail: [], lastTrail: 0 },
  { axis: "v", dir: -1, lane: 0.372, speed: 0.055, s: 0.8, prev: 0.8, id: "19", trail: [], lastTrail: 0 },
];

// Walking routes in fractions; closed loops repeat their first point at the end.
const ROUTES: [number, number][][] = [
  [[-0.05, 0.545], [1.05, 0.545]],
  [[1.05, 0.74], [-0.05, 0.74]],
  [[0.485, -0.05], [0.485, 1.05]],
  [[0.315, 1.05], [0.315, -0.05]],
  [[0.55, 0.37], [0.71, 0.37], [0.71, 0.47], [0.55, 0.47], [0.55, 0.37]],
  [[0.2, 0.545], [0.2, 0.74], [0.2, 0.545]],
  [[0.52, 0.36], [0.74, 0.5], [0.74, 0.545], [0.52, 0.545], [0.52, 0.36]],
];

type Walker = { route: number; d: number; speed: number; id: string; trail: Pt[]; lastTrail: number };
const makeWalkers = (): Walker[] => [
  { route: 0, d: 0.1, speed: 0.03, id: "04", trail: [], lastTrail: 0 },
  { route: 0, d: 0.62, speed: 0.026, id: "08", trail: [], lastTrail: 0 },
  { route: 1, d: 0.3, speed: 0.028, id: "15", trail: [], lastTrail: 0 },
  { route: 1, d: 0.85, speed: 0.032, id: "16", trail: [], lastTrail: 0 },
  { route: 2, d: 0.4, speed: 0.024, id: "21", trail: [], lastTrail: 0 },
  { route: 3, d: 0.2, speed: 0.027, id: "27", trail: [], lastTrail: 0 },
  { route: 4, d: 0.0, speed: 0.022, id: "33", trail: [], lastTrail: 0 },
  { route: 4, d: 0.5, speed: 0.022, id: "34", trail: [], lastTrail: 0 },
  { route: 5, d: 0.3, speed: 0.02, id: "40", trail: [], lastTrail: 0 },
  { route: 6, d: 0.7, speed: 0.025, id: "42", trail: [], lastTrail: 0 },
];

type Ripple = { x: number; y: number; t0: number };

const HALF_FOV = 0.42;
const angDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export function SiteMap({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const wrap = wrapRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    let W = 0, H = 0, dpr = 1, k = 1;
    let routes: { pts: Pt[]; seg: number[]; total: number }[] = [];
    const cams = makeCams();
    const cars = makeCars();
    const walkers = makeWalkers();
    const ripples: Ripple[] = [];
    const pointer = { x: 0, y: 0, inside: false };

    const px = (u: number, v: number): Pt => ({ x: u * W, y: v * H });
    const baseAngle = (c: Cam) => Math.atan2((c.tv - c.v) * H, (c.tu - c.u) * W);

    function resize() {
      // Layout size, not on-screen size: segments are scaled slightly while scrolling away.
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = wrap.clientWidth;
      H = wrap.clientHeight;
      k = Math.max(0.72, Math.min(1.2, W / 560));
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      routes = ROUTES.map((route) => {
        const pts = route.map(([u, v]) => px(u, v));
        const seg: number[] = [];
        let total = 0;
        for (let i = 1; i < pts.length; i++) {
          const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
          seg.push(l);
          total += l;
        }
        return { pts, seg, total };
      });
      cams.forEach((c) => {
        if (!c.angle) c.angle = baseAngle(c);
      });
    }

    function routePoint(ri: number, d: number): Pt {
      const r = routes[ri];
      let rem = ((d % r.total) + r.total) % r.total;
      for (let i = 0; i < r.seg.length; i++) {
        if (rem <= r.seg[i]) {
          const t = rem / r.seg[i];
          return { x: r.pts[i].x + (r.pts[i + 1].x - r.pts[i].x) * t, y: r.pts[i].y + (r.pts[i + 1].y - r.pts[i].y) * t };
        }
        rem -= r.seg[i];
      }
      return r.pts[r.pts.length - 1];
    }

    const range = () => 0.42 * W;
    function seenBy(p: Pt) {
      const R = range();
      return cams.some((c) => {
        const o = px(c.u, c.v);
        const dx = p.x - o.x, dy = p.y - o.y;
        return dx * dx + dy * dy <= R * R && Math.abs(angDiff(Math.atan2(dy, dx), c.angle)) <= HALF_FOV;
      });
    }

    function onMove(e: PointerEvent) {
      const r = wrap.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
      pointer.inside = true;
    }
    const onLeave = () => (pointer.inside = false);
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerleave", onLeave);

    function update(t: number, dt: number) {
      cams.forEach((c) => {
        const base = baseAngle(c);
        let target = base + 0.3 * Math.sin(t * c.speed + c.phase);
        if (pointer.inside) {
          const o = px(c.u, c.v);
          const toPointer = Math.atan2(pointer.y - o.y, pointer.x - o.x);
          const off = Math.max(-0.95, Math.min(0.95, angDiff(toPointer, base)));
          target = base + off;
        }
        c.angle += angDiff(target, c.angle) * Math.min(1, dt * 3.2);
      });

      cars.forEach((car) => {
        car.prev = car.s;
        car.s += car.speed * car.dir * dt;
        if (car.s > 1.08) car.s = car.prev = -0.08;
        if (car.s < -0.08) car.s = car.prev = 1.08;
        const wire = car.axis === "v" ? 0.3 : 0.86;
        if ((car.prev - wire) * (car.s - wire) < 0) {
          ripples.push({ ...(car.axis === "v" ? px(car.lane, wire) : px(wire, car.lane)), t0: t });
        }
      });

      walkers.forEach((w) => (w.d += w.speed * W * dt));
      for (let i = ripples.length - 1; i >= 0; i--) if (t - ripples[i].t0 > 1.6) ripples.splice(i, 1);
    }

    function carPos(car: Car): Pt {
      return car.axis === "h" ? px(car.s, car.lane) : px(car.lane, car.s);
    }

    function pushTrail(obj: { trail: Pt[]; lastTrail: number }, p: Pt, t: number) {
      if (t - obj.lastTrail > 0.11) {
        obj.trail.push(p);
        if (obj.trail.length > 14) obj.trail.shift();
        obj.lastTrail = t;
      }
    }

    function bracket(cx: number, cy: number, w: number, h: number, color: string) {
      const x = cx - w / 2, y = cy - h / 2, c = Math.min(6 * k, w / 3, h / 3);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(x, y + c); ctx.lineTo(x, y); ctx.lineTo(x + c, y);
      ctx.moveTo(x + w - c, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + c);
      ctx.moveTo(x + w, y + h - c); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - c, y + h);
      ctx.moveTo(x + c, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - c);
      ctx.stroke();
    }

    function tag(x: number, y: number, text: string, color: string) {
      ctx.font = `500 ${Math.round(9.5 * k)}px ${MONO}`;
      const tw = ctx.measureText(text).width;
      const h = 13 * k;
      ctx.fillStyle = "rgba(252,251,248,.94)";
      ctx.fillRect(x, y - h, tw + 8 * k, h);
      ctx.fillStyle = color;
      ctx.fillText(text, x + 4 * k, y - 3.5 * k);
    }

    function drawStatic() {
      // drafting grid
      const g = 24 * k;
      ctx.lineWidth = 1;
      for (let x = 0, i = 0; x <= W; x += g, i++) {
        ctx.strokeStyle = `rgba(${INK},${i % 4 === 0 ? 0.055 : 0.03})`;
        ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke();
      }
      for (let y = 0, i = 0; y <= H; y += g, i++) {
        ctx.strokeStyle = `rgba(${INK},${i % 4 === 0 ? 0.055 : 0.03})`;
        ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke();
      }

      // roads
      const hy0 = (ROAD_H.v - ROAD_H.half) * H, hy1 = (ROAD_H.v + ROAD_H.half) * H;
      const vx0 = (ROAD_V.u - ROAD_V.half) * W, vx1 = (ROAD_V.u + ROAD_V.half) * W;
      ctx.fillStyle = `rgba(${INK},.045)`;
      ctx.fillRect(0, hy0, W, hy1 - hy0);
      ctx.fillRect(vx0, 0, vx1 - vx0, H);

      // plaza zone
      const [pu0, pv0, pu1, pv1] = PLAZA;
      ctx.fillStyle = PAPER;
      ctx.fillRect(pu0 * W, pv0 * H, (pu1 - pu0) * W, (pv1 - pv0) * H);
      ctx.setLineDash([4 * k, 4 * k]);
      ctx.strokeStyle = `rgba(${INK},.35)`;
      ctx.strokeRect(pu0 * W + 0.5, pv0 * H + 0.5, (pu1 - pu0) * W, (pv1 - pv0) * H);
      ctx.setLineDash([]);
      tag(pu0 * W + 4, pv0 * H + 15 * k, "ZONE A", `rgba(${INK},.7)`);

      // buildings with hatching
      BUILDINGS.forEach(([u0, v0, u1, v1]) => {
        const x = u0 * W, y = v0 * H, w = (u1 - u0) * W, h = (v1 - v0) * H;
        ctx.save();
        ctx.beginPath(); ctx.roundRect(x, y, w, h, 4 * k); ctx.clip();
        ctx.fillStyle = "rgba(252,251,248,.85)";
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = `rgba(${INK},.075)`;
        ctx.lineWidth = 1;
        for (let d = -h; d < w; d += 7 * k) {
          ctx.beginPath(); ctx.moveTo(x + d, y + h); ctx.lineTo(x + d + h, y); ctx.stroke();
        }
        ctx.restore();
        ctx.strokeStyle = `rgba(${INK},.42)`;
        ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.roundRect(x + 0.5, y + 0.5, w, h, 4 * k); ctx.stroke();
      });

      // road edges, kerbs and centre lines
      ctx.strokeStyle = `rgba(${INK},.38)`;
      ctx.lineWidth = 1;
      const line = (x0: number, y0: number, x1: number, y1: number) => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
      line(0, hy0, vx0, hy0); line(vx1, hy0, W, hy0); line(0, hy1, vx0, hy1); line(vx1, hy1, W, hy1);
      line(vx0, 0, vx0, hy0); line(vx0, hy1, vx0, H); line(vx1, 0, vx1, hy0); line(vx1, hy1, vx1, H);
      ctx.strokeStyle = `rgba(${INK},.12)`;
      const kerb = 0.025;
      line(0, hy0 - kerb * H, vx0 - kerb * W, hy0 - kerb * H); line(vx1 + kerb * W, hy0 - kerb * H, W, hy0 - kerb * H);
      line(0, hy1 + kerb * H, vx0 - kerb * W, hy1 + kerb * H); line(vx1 + kerb * W, hy1 + kerb * H, W, hy1 + kerb * H);
      line(vx0 - kerb * W, 0, vx0 - kerb * W, hy0 - kerb * H); line(vx1 + kerb * W, 0, vx1 + kerb * W, hy0 - kerb * H);
      line(vx0 - kerb * W, hy1 + kerb * H, vx0 - kerb * W, H); line(vx1 + kerb * W, hy1 + kerb * H, vx1 + kerb * W, H);
      ctx.setLineDash([7 * k, 7 * k]);
      ctx.strokeStyle = `rgba(${INK},.26)`;
      line(0, ROAD_H.v * H, vx0 - 6, ROAD_H.v * H); line(vx1 + 6, ROAD_H.v * H, W, ROAD_H.v * H);
      line(ROAD_V.u * W, 0, ROAD_V.u * W, hy0 - 6); line(ROAD_V.u * W, hy1 + 6, ROAD_V.u * W, H);
      ctx.setLineDash([]);

      // zebra crossings
      ctx.fillStyle = `rgba(${INK},.16)`;
      for (let y = hy0 + 4 * k; y < hy1 - 3 * k; y += 7 * k) ctx.fillRect(0.175 * W, y, 0.05 * W, 3 * k);
      for (let x = vx0 + 4 * k; x < vx1 - 3 * k; x += 7 * k) ctx.fillRect(x, 0.5 * H, 3 * k, 0.045 * H);

      // trees
      TREES.forEach(([u, v]) => {
        ctx.strokeStyle = `rgba(${INK},.28)`;
        ctx.fillStyle = "rgba(252,251,248,.9)";
        ctx.beginPath(); ctx.arc(u * W, v * H, 5.5 * k, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(u * W, v * H, 2.2 * k, 0, Math.PI * 2); ctx.stroke();
      });

      // tripwires
      ctx.setLineDash([3 * k, 3 * k]);
      ctx.strokeStyle = PINK_DEEP;
      ctx.lineWidth = 1.3;
      line(vx0, 0.3 * H, vx1, 0.3 * H);
      line(0.86 * W, hy0, 0.86 * W, hy1);
      ctx.setLineDash([]);
    }

    function drawCones() {
      const R = range();
      cams.forEach((c) => {
        const o = px(c.u, c.v);
        const grad = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, R);
        grad.addColorStop(0, `rgba(${PINK},.30)`);
        grad.addColorStop(1, `rgba(${PINK},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(o.x, o.y);
        ctx.arc(o.x, o.y, R, c.angle - HALF_FOV, c.angle + HALF_FOV);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(176,61,104,.32)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + Math.cos(c.angle - HALF_FOV) * R * 0.8, o.y + Math.sin(c.angle - HALF_FOV) * R * 0.8);
        ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + Math.cos(c.angle + HALF_FOV) * R * 0.8, o.y + Math.sin(c.angle + HALF_FOV) * R * 0.8);
        ctx.stroke();
      });
    }

    function drawCameras() {
      cams.forEach((c) => {
        const o = px(c.u, c.v);
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.rotate(c.angle);
        ctx.fillStyle = `rgb(${INK})`;
        ctx.beginPath(); ctx.roundRect(-2 * k, -4 * k, 12 * k, 8 * k, 2 * k); ctx.fill();
        ctx.fillStyle = PINK_DEEP;
        ctx.beginPath(); ctx.arc(10 * k, 0, 2 * k, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.fillStyle = `rgb(${INK})`;
        ctx.beginPath(); ctx.arc(o.x, o.y, 3 * k, 0, Math.PI * 2); ctx.fill();
        const away = c.angle + Math.PI;
        tag(o.x + Math.cos(away) * 16 * k - 18 * k, o.y + Math.sin(away) * 14 * k + 4 * k, c.label, `rgb(${INK})`);
      });
    }

    function drawMovers(t: number) {
      // walkers
      walkers.forEach((w) => {
        const p = routePoint(w.route, w.d);
        const seen = seenBy(p);
        if (seen) pushTrail(w, p, t);
        else w.trail.length = 0;
        w.trail.forEach((q, n) => {
          ctx.fillStyle = `rgba(29,106,160,${0.08 + (0.35 * n) / w.trail.length})`;
          ctx.beginPath(); ctx.arc(q.x, q.y, 1.3 * k, 0, Math.PI * 2); ctx.fill();
        });
        ctx.fillStyle = `rgba(${INK},.85)`;
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.8 * k, 0, Math.PI * 2); ctx.fill();
        if (seen) {
          bracket(p.x, p.y, 14 * k, 22 * k, SKY_DEEP);
          tag(p.x - 7 * k, p.y - 13 * k, `person ${w.id}`, SKY_DEEP);
        }
      });

      // cars
      cars.forEach((car) => {
        const p = carPos(car);
        const heading = car.axis === "h" ? (car.dir === 1 ? 0 : Math.PI) : car.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
        const seen = seenBy(p);
        if (seen) pushTrail(car, p, t);
        else car.trail.length = 0;
        car.trail.forEach((q, n) => {
          ctx.fillStyle = `rgba(29,106,160,${0.06 + (0.3 * n) / car.trail.length})`;
          ctx.beginPath(); ctx.arc(q.x, q.y, 1.3 * k, 0, Math.PI * 2); ctx.fill();
        });
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(heading);
        ctx.fillStyle = CARD;
        ctx.strokeStyle = `rgba(${INK},.8)`;
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.roundRect(-12 * k, -6 * k, 24 * k, 12 * k, 3 * k); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(4 * k, -4.5 * k); ctx.lineTo(4 * k, 4.5 * k); ctx.stroke();
        ctx.restore();
        if (seen) {
          const horiz = car.axis === "h";
          bracket(p.x, p.y, (horiz ? 32 : 18) * k, (horiz ? 18 : 32) * k, SKY_DEEP);
          tag(p.x - (horiz ? 16 : 9) * k, p.y - (horiz ? 11 : 18) * k, `car ${car.id}`, SKY_DEEP);
        }
      });
    }

    function drawRipples(t: number) {
      ripples.forEach((r) => {
        const a = (t - r.t0) / 1.6;
        ctx.strokeStyle = `rgba(29,106,160,${0.7 * (1 - a)})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(r.x, r.y, (6 + 34 * a) * k, 0, Math.PI * 2); ctx.stroke();
        if (a < 0.75) {
          ctx.globalAlpha = 1 - a / 0.75;
          tag(r.x + 10 * k, r.y - 8 * k, "line crossed", SKY_DEEP);
          ctx.globalAlpha = 1;
        }
      });
    }

    function drawPointer() {
      if (!pointer.inside) return;
      const { x, y } = pointer;
      const seen = seenBy(pointer);
      ctx.strokeStyle = seen ? SKY_DEEP : `rgba(${INK},.55)`;
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(x, y, 9 * k, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 14 * k, y); ctx.lineTo(x - 11 * k, y); ctx.moveTo(x + 11 * k, y); ctx.lineTo(x + 14 * k, y);
      ctx.moveTo(x, y - 14 * k); ctx.lineTo(x, y - 11 * k); ctx.moveTo(x, y + 11 * k); ctx.lineTo(x, y + 14 * k);
      ctx.stroke();
      if (seen) {
        bracket(x, y, 34 * k, 34 * k, SKY_DEEP);
        tag(x - 17 * k, y - 19 * k, "you", SKY_DEEP);
      }
    }

    function frame(t: number, dt: number) {
      update(t, dt);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      drawStatic();
      drawCones();
      drawMovers(t);
      drawRipples(t);
      drawCameras();
      drawPointer();
    }

    let raf = 0, last = 0, clock = 0, running = false;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      clock += dt;
      frame(clock, dt);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (running || reduce) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };
    // A still, representative frame for reduced motion and before the loop starts.
    const still = () => {
      clock = 0;
      for (let i = 0; i < 90; i++) update((clock += 1 / 30), 1 / 30);
      frame(clock, 0);
    };

    const ro = new ResizeObserver(() => {
      resize();
      if (!running) frame(clock, 0);
    });
    ro.observe(wrap);
    resize();
    still();

    // Animate only while the map is on screen and the tab is visible.
    let inView = false;
    const io = new IntersectionObserver(([e]) => {
      inView = e.isIntersecting;
      if (inView && !document.hidden) start();
      else stop();
    });
    io.observe(wrap);
    const onVis = () => (!document.hidden && inView ? start() : stop());
    document.addEventListener("visibilitychange", onVis);
    document.fonts?.ready.then(() => !running && frame(clock, 0));

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerleave", onLeave);
    };
  }, [reduce]);

  return (
    <div ref={wrapRef} className={className} style={{ touchAction: "pan-y" }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block size-full"
        role="img"
        aria-label="An animated site plan: cameras watch roads and a plaza, and the cars and people they can see are boxed and labelled."
      />
    </div>
  );
}
