"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { ShopBean } from "@/lib/data";
import { gsap, prefersReducedMotion } from "@/lib/gsap";

/*
 * A 250 g stand-up coffee pouch: a dense box bent into shape (pillowed faces, a pinched and crimped top seal,
 * a deeper gusset at the base), wrapped in generated kraft paper with the label printed onto the front.
 */

const W = 1;
const H = 1.5;
const D = 0.44;
const TEX_W = 1024;
const TEX_H = 1536;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Kraft paper: warm brown with fibres and blotches. */
function paintKraft(ctx: CanvasRenderingContext2D, w: number, h: number, seed = 7) {
  const r = rand(seed);
  ctx.fillStyle = "#9c6f45";
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) {
    const g = ctx.createRadialGradient(r() * w, r() * h, 0, r() * w, r() * h, 80 + r() * 220);
    const dark = r() > 0.5;
    g.addColorStop(0, dark ? "rgba(90,60,30,0.10)" : "rgba(235,210,170,0.10)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.lineCap = "round";
  for (let i = 0; i < 2600; i++) {
    const x = r() * w, y = r() * h, len = 4 + r() * 16, a = r() * Math.PI;
    ctx.strokeStyle = r() > 0.5 ? `rgba(80,52,25,${0.08 + r() * 0.12})` : `rgba(240,215,175,${0.08 + r() * 0.14})`;
    ctx.lineWidth = 0.6 + r() * 1.1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
}

/** Seal, crimp and valve details shared by both faces. */
function paintBagDetails(ctx: CanvasRenderingContext2D, w: number, h: number, valve: boolean) {
  // Crimped heat seal along the top edge
  const sealTop = h * 0.015, sealBottom = h * 0.085;
  ctx.fillStyle = "rgba(70,45,22,0.10)";
  ctx.fillRect(0, sealTop, w, sealBottom - sealTop);
  for (let y = sealTop; y < sealBottom; y += 7) {
    ctx.fillStyle = "rgba(60,38,18,0.22)";
    ctx.fillRect(0, y, w, 2);
    ctx.fillStyle = "rgba(245,225,190,0.16)";
    ctx.fillRect(0, y + 2.5, w, 1.5);
  }
  // Soft shadow under the pinch where the bag fills out
  const g = ctx.createLinearGradient(0, h * 0.1, 0, h * 0.2);
  g.addColorStop(0, "rgba(50,32,15,0.18)");
  g.addColorStop(1, "rgba(50,32,15,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, h * 0.1, w, h * 0.1);
  if (valve) {
    const cx = w * 0.5, cy = h * 0.235, R = w * 0.04;
    ctx.fillStyle = "rgba(55,36,20,0.35)";
    ctx.beginPath();
    ctx.arc(cx + 2, cy + 3, R * 1.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c9a57d";
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(60,40,22,0.45)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.55, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = "rgba(60,40,22,0.5)";
      ctx.beginPath();
      ctx.arc(cx + Math.cos((i * Math.PI) / 2) * R * 0.28, cy + Math.sin((i * Math.PI) / 2) * R * 0.28, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  const widths = [...text].map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1);
  let cx = x - total / 2;
  [...text].forEach((c, i) => {
    ctx.fillText(c, cx, y);
    cx += widths[i] + spacing;
  });
}

/** Front face: kraft, valve and the printed label for this origin. */
function paintFront(canvas: HTMLCanvasElement, bean: ShopBean, roasted: string, fonts: { display: string; sans: string }) {
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width, h = canvas.height;
  paintKraft(ctx, w, h, 11);
  paintBagDetails(ctx, w, h, true);

  const lx = w * 0.13, ly = h * 0.33, lw = w * 0.74, lh = h * 0.56;
  ctx.fillStyle = "rgba(40,25,12,0.18)";
  ctx.fillRect(lx + 6, ly + 8, lw, lh);
  ctx.fillStyle = bean.label;
  ctx.fillRect(lx, ly, lw, lh);
  // A little paper tooth on the label
  const r = rand(3);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(${bean.ink === "#f3eee5" ? "255,255,255" : "0,0,0"},${0.02 + r() * 0.03})`;
    ctx.fillRect(lx + r() * lw, ly + r() * lh, 1.5, 1.5);
  }

  const cx = w / 2;
  ctx.fillStyle = bean.ink;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `600 ${w * 0.058}px ${fonts.display}`;
  spaced(ctx, "RIPPLE", cx, ly + lh * 0.12, w * 0.028);
  ctx.font = `600 ${w * 0.024}px ${fonts.sans}`;
  spaced(ctx, "COFFEE ROASTERS · LAHORE", cx, ly + lh * 0.18, w * 0.006);

  ctx.globalAlpha = 0.4;
  ctx.fillRect(lx + lw * 0.12, ly + lh * 0.235, lw * 0.76, 2);
  ctx.globalAlpha = 1;

  ctx.textAlign = "center";
  ctx.font = `500 ${w * (bean.origin.length > 6 ? 0.12 : 0.135)}px ${fonts.display}`;
  ctx.fillText(bean.origin, cx, ly + lh * 0.44);
  ctx.font = `500 ${w * 0.038}px ${fonts.sans}`;
  ctx.fillText(bean.region, cx, ly + lh * 0.53);
  ctx.globalAlpha = 0.75;
  ctx.font = `500 ${w * 0.03}px ${fonts.sans}`;
  ctx.fillText(`${bean.process} · ${bean.altitude}`, cx, ly + lh * 0.6);
  ctx.globalAlpha = 1;
  ctx.font = `600 ${w * 0.033}px ${fonts.sans}`;
  ctx.fillText(bean.notes.join("  ·  "), cx, ly + lh * 0.72);

  ctx.globalAlpha = 0.4;
  ctx.fillRect(lx + lw * 0.12, ly + lh * 0.8, lw * 0.76, 2);
  ctx.globalAlpha = 1;
  ctx.font = `600 ${w * 0.022}px ${fonts.sans}`;
  ctx.textAlign = "left";
  ctx.fillText("250 G · WHOLE BEAN", lx + lw * 0.12, ly + lh * 0.89);
  ctx.textAlign = "right";
  ctx.fillText(`ROASTED ${roasted.toUpperCase()}`, lx + lw * 0.88, ly + lh * 0.89);
}

function paintBack(canvas: HTMLCanvasElement, fonts: { display: string; sans: string }) {
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width, h = canvas.height;
  paintKraft(ctx, w, h, 29);
  paintBagDetails(ctx, w, h, false);
  ctx.fillStyle = "rgba(48,30,16,0.72)";
  ctx.textAlign = "center";
  ctx.font = `600 ${w * 0.04}px ${fonts.display}`;
  spaced(ctx, "RIPPLE", w / 2, h * 0.42, w * 0.02);
  ctx.font = `400 ${w * 0.024}px ${fonts.sans}`;
  ["Roasted in small batches in Lahore.", "Best between 7 and 30 days after roasting.", "Store sealed, away from light and heat."].forEach((l, i) =>
    ctx.fillText(l, w / 2, h * 0.5 + i * w * 0.045),
  );
}

/** Paper crinkle: soft random dents plus a few long vertical creases. */
function crinkleNormalMap() {
  const N = 512;
  const r = rand(17);
  const hgt = new Float32Array(N * N);
  for (let k = 0; k < 220; k++) {
    const cx = r() * N, cy = r() * N, rad = 10 + r() * 60, amp = (r() - 0.5) * 0.6;
    for (let y = Math.max(0, Math.floor(cy - rad)); y < Math.min(N, cy + rad); y++)
      for (let x = Math.max(0, Math.floor(cx - rad)); x < Math.min(N, cx + rad); x++) {
        const d = Math.hypot(x - cx, y - cy) / rad;
        if (d < 1) hgt[y * N + x] += amp * (1 - d * d) * (1 - d * d);
      }
  }
  for (let k = 0; k < 6; k++) {
    const cx = r() * N, amp = 0.8 + r();
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) hgt[y * N + x] += amp * Math.exp(-(((x - cx - Math.sin(y * 0.02 + k) * 6) / 2.5) ** 2));
  }
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const l = hgt[y * N + Math.max(0, x - 1)], rr = hgt[y * N + Math.min(N - 1, x + 1)];
      const t = hgt[Math.max(0, y - 1) * N + x], b = hgt[Math.min(N - 1, y + 1) * N + x];
      const nx = (l - rr) * 1.2, ny = (t - b) * 1.2;
      const len = Math.hypot(nx, ny, 1);
      const i = (y * N + x) * 4;
      data[i] = (nx / len * 0.5 + 0.5) * 255;
      data[i + 1] = (ny / len * 0.5 + 0.5) * 255;
      data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/** The pouch: a segmented box bent into a filled, sealed bag. */
function pouchGeometry() {
  const geo = new THREE.BoxGeometry(W, H, D, 48, 72, 16);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), z = p.getZ(i);
    const y = p.getY(i);
    const ny = (y + H / 2) / H; // 0 bottom → 1 top
    const seal = smoothstep(0.8, 0.93, ny);
    const gusset = 1 - smoothstep(0, 0.16, ny);
    const bx = Math.max(0, 1 - (x / (W / 2)) ** 2);
    const by = Math.max(0, 1 - ((ny - 0.42) / 0.52) ** 2);
    // Thickness collapses into the flat seal at the top and widens into the base gusset
    z *= (1 - seal * 0.95) * (1 + gusset * 0.18) * (0.55 + 0.45 * Math.sqrt(bx));
    // Faces pillow outward where the beans fill the bag
    z += Math.sign(z) * 0.07 * bx * by * (1 - seal);
    // Width pulls in slightly as the bag fills out, and the top edge curls a touch
    x *= 1 - 0.035 * by * (1 - seal);
    const curl = seal * smoothstep(0.93, 1, ny) * 0.03;
    p.setXYZ(i, x, y, z + curl);
  }
  geo.computeVertexNormals();
  return geo;
}

function contactShadow() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(128, 128, 6, 128, 128, 128);
  grad.addColorStop(0, "rgba(40,26,16,0.55)");
  grad.addColorStop(0.5, "rgba(40,26,16,0.18)");
  grad.addColorStop(1, "rgba(40,26,16,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default function Bag3D({ bean, roasted }: { bean: ShopBean; roasted: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const api = useRef<{ show: (b: ShopBean, roasted: string) => void } | null>(null);
  const latest = useRef({ bean, roasted });

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrapEl = wrap.current!;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.82;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
    camera.position.set(0, 0.2, 3.75);
    camera.lookAt(0, -0.04, 0);
    const key = new THREE.DirectionalLight(0xfff4e6, 2.2);
    key.position.set(-2.5, 3, 3.5);
    const rim = new THREE.DirectionalLight(0xffffff, 1.2);
    rim.position.set(3, 1.5, -2.5);
    scene.add(key, rim);

    // Textures: front (label), back, and plain kraft for the sides
    const mk = (w: number, h: number) => Object.assign(document.createElement("canvas"), { width: w, height: h });
    const frontCanvas = mk(TEX_W, TEX_H);
    const backCanvas = mk(TEX_W, TEX_H);
    const sideCanvas = mk(256, TEX_H);
    paintKraft(sideCanvas.getContext("2d")!, 256, TEX_H, 5);
    const tex = (c: HTMLCanvasElement) => {
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return t;
    };
    const frontTex = tex(frontCanvas), backTex = tex(backCanvas), sideTex = tex(sideCanvas);
    const crinkle = crinkleNormalMap();
    const paper = (map: THREE.Texture) =>
      new THREE.MeshPhysicalMaterial({ map, normalMap: crinkle, normalScale: new THREE.Vector2(0.45, 0.45), roughness: 0.9, sheen: 0.08, sheenRoughness: 0.9, sheenColor: new THREE.Color("#fff1dc"), envMapIntensity: 0.7 });
    const sideMat = paper(sideTex);
    // BoxGeometry face order: +x, -x, +y, -y, +z (front), -z (back)
    const mesh = new THREE.Mesh(pouchGeometry(), [sideMat, sideMat, sideMat, sideMat, paper(frontTex), paper(backTex)]);
    const pivot = new THREE.Group();
    pivot.add(mesh);
    scene.add(pivot);

    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.3), new THREE.MeshBasicMaterial({ map: contactShadow(), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -H / 2 - 0.005;
    scene.add(shadow);

    // Fonts for the label come from the page, so the print matches the site
    const probe = (cls: string) => {
      const el = document.createElement("span");
      el.className = cls;
      document.body.appendChild(el);
      const f = getComputedStyle(el).fontFamily;
      el.remove();
      return f;
    };
    const fonts = { display: probe("display"), sans: getComputedStyle(document.body).fontFamily };

    const paintLabel = (b: ShopBean, roastedOn: string) => {
      paintFront(frontCanvas, b, roastedOn, fonts);
      frontTex.needsUpdate = true;
    };
    document.fonts.ready.then(() => {
      paintLabel(latest.current.bean, latest.current.roasted);
      paintBack(backCanvas, fonts);
      backTex.needsUpdate = true;
    });

    let w = 0, h = 0;
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Rotation: idle sway, drag to spin with momentum, full turn when the origin changes
    const reduce = prefersReducedMotion();
    const rot = { y: -0.35, vel: 0, spin: 0 };
    let dragging = false, lastX = 0, lastInput = -1e9;
    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      rot.vel = 0;
      wrapEl.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      rot.y += dx * 0.012;
      rot.vel = dx * 0.012;
      lastInput = performance.now();
    };
    const up = () => (dragging = false);
    wrapEl.addEventListener("pointerdown", down);
    wrapEl.addEventListener("pointermove", move);
    wrapEl.addEventListener("pointerup", up);
    wrapEl.addEventListener("pointercancel", up);

    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);

    const start = performance.now();
    const frame = () => {
      if (!visible) return;
      const t = (performance.now() - start) / 1000;
      if (!dragging) {
        rot.y += rot.vel;
        rot.vel *= 0.94;
        // Ease back toward a three-quarter view when left alone
        if (performance.now() - lastInput > 2500 && !reduce) {
          const home = -0.35 + Math.sin(t * 0.45) * 0.22;
          const k = Math.round((rot.y - home) / (Math.PI * 2));
          rot.y += (home + k * Math.PI * 2 - rot.y) * 0.025;
        }
      }
      pivot.rotation.y = rot.y + rot.spin;
      pivot.position.y = reduce ? 0 : Math.sin(t * 0.8) * 0.012;
      renderer.render(scene, camera);
    };
    gsap.ticker.add(frame);

    let current = latest.current.bean.id;
    api.current = {
      show(b, roastedOn) {
        if (b.id === current) {
          paintLabel(b, roastedOn);
          return;
        }
        current = b.id;
        if (reduce) {
          paintLabel(b, roastedOn);
          return;
        }
        // Spin a full turn; swap the label while its back is to you
        let swapped = false;
        gsap.to(rot, {
          spin: rot.spin + Math.PI * 2,
          duration: 1.3,
          ease: "power3.inOut",
          onUpdate() {
            if (!swapped && this.progress() > 0.4) {
              swapped = true;
              paintLabel(b, roastedOn);
            }
          },
        });
      },
    };

    return () => {
      gsap.ticker.remove(frame);
      ro.disconnect();
      io.disconnect();
      wrapEl.removeEventListener("pointerdown", down);
      wrapEl.removeEventListener("pointermove", move);
      wrapEl.removeEventListener("pointerup", up);
      wrapEl.removeEventListener("pointercancel", up);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m: THREE.Material & { map?: THREE.Texture | null }) => {
            m.map?.dispose();
            m.dispose();
          });
        }
      });
      crinkle.dispose();
      scene.environment?.dispose();
      renderer.dispose();
      api.current = null;
    };
  }, []);

  useEffect(() => {
    latest.current = { bean, roasted };
    api.current?.show(bean, roasted);
  }, [bean, roasted]);

  return (
    <div ref={wrap} className="relative h-full w-full cursor-grab touch-pan-y active:cursor-grabbing">
      <canvas ref={canvasRef} className="block h-full w-full" aria-hidden />
      <span className="sr-only">
        {bean.origin} coffee, 250 gram bag. Notes of {bean.notes.join(", ")}.
      </span>
    </div>
  );
}
