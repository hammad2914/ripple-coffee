"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { beanGeometry, wrinkleNormalMap } from "./Bean3D";

const MAX = 140;
const GRAVITY = 2200; // px/s²
const STEP = 22; // px of cursor travel per bean
const REST = 2.4; // seconds a bean lies on the floor before it goes

type Bean = {
  x: number; y: number; vx: number; vy: number;
  rx: number; ry: number; rz: number; wx: number; wy: number; wz: number;
  s: number; tone: number; age: number; rest: number; alive: boolean;
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);
// Nearest angle of the form k·π + offset, so a resting bean lies on its side or its back
const settleTo = (a: number, offset: number) => Math.round((a - offset) / Math.PI) * Math.PI + offset;

/** Roasted beans spill from the cursor, tumble down and bounce on the footer floor. */
export default function BeanSpill() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const canvas = ref.current!;
    const host = canvas.parentElement!;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // Pixel space: x right, y down (negated on the way in)
    const camera = new THREE.OrthographicCamera(0, 1, 0, -1, -200, 200);
    const key = new THREE.DirectionalLight(0xfff2e2, 2.6);
    key.position.set(-1, 1.4, 1.6);
    const rim = new THREE.DirectionalLight(0xffd9b0, 1.6);
    rim.position.set(1.4, 0.6, -1);
    scene.add(key, rim);

    // The roasted bean shape from the Journey, baked out of its morph target at a lighter resolution
    const src = beanGeometry(120, 60);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", src.morphAttributes.position![0]);
    geo.setAttribute("normal", src.morphAttributes.normal![0]);
    geo.setAttribute("color", src.morphAttributes.color![0]);
    geo.setAttribute("uv", src.attributes.uv);
    geo.setIndex(src.index);
    const normalMap = wrinkleNormalMap();
    const mat = new THREE.MeshStandardMaterial({
      color: "#4f2c15",
      vertexColors: true,
      normalMap,
      normalScale: new THREE.Vector2(0.3, 0.3),
      roughness: 0.48,
      envMapIntensity: 0.6,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, MAX);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    const tint = new THREE.Color();
    for (let i = 0; i < MAX; i++) mesh.setColorAt(i, tint.setScalar(1));
    scene.add(mesh);

    let w = 0, h = 0;
    const resize = () => {
      w = host.clientWidth;
      h = host.clientHeight;
      renderer.setSize(w, h, false);
      camera.right = w;
      camera.bottom = -h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const beans: Bean[] = Array.from({ length: MAX }, () => ({
      x: 0, y: 0, vx: 0, vy: 0, rx: 0, ry: 0, rz: 0, wx: 0, wy: 0, wz: 0, s: 0, tone: 1, age: 0, rest: 0, alive: false,
    }));
    let next = 0, live = 0;
    const spawn = (x: number, y: number, vx: number, vy: number) => {
      const b = beans[next];
      next = (next + 1) % MAX;
      if (!b.alive) live++;
      Object.assign(b, {
        x, y,
        vx: vx * 0.3 + rand(-140, 140),
        vy: vy * 0.3 + rand(-280, -40),
        rx: rand(0, 6.3), ry: rand(0, 6.3), rz: rand(0, 6.3),
        wx: rand(-12, 12), wy: rand(-12, 12), wz: rand(-9, 9),
        s: rand(12.5, 17.5), tone: rand(0.7, 1.25), age: 0, rest: 0, alive: true,
      });
    };

    let last: { x: number; y: number; t: number } | null = null;
    let travel = 0;
    const local = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
    };
    const move = (e: PointerEvent) => {
      const p = local(e);
      if (last) {
        const dx = p.x - last.x, dy = p.y - last.y;
        const dt = Math.max(8, p.t - last.t) / 1000;
        travel += Math.hypot(dx, dy);
        // Faster strokes spill more, capped so a flick doesn't flood the footer
        for (let n = 0; travel >= STEP && n < 4; n++) {
          travel -= STEP;
          spawn(p.x, p.y, dx / dt, dy / dt);
        }
        travel = Math.min(travel, STEP);
      }
      last = p;
    };
    // A click tips out a small handful
    const down = (e: PointerEvent) => {
      const p = local(e);
      for (let n = 0; n < 7; n++) spawn(p.x + rand(-6, 6), p.y + rand(-6, 6), rand(-200, 200), rand(-500, -150));
    };
    const leave = () => (last = null);
    host.addEventListener("pointermove", move);
    host.addEventListener("pointerdown", down);
    host.addEventListener("pointerleave", leave);

    let visible = false;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);

    const dummy = new THREE.Object3D();
    let drawn = 0;
    const frame = () => {
      if (!visible || (live === 0 && drawn === 0)) return;
      const dt = Math.min(1 / 30, gsap.ticker.deltaRatio() / 60);
      let n = 0;
      for (const b of beans) {
        if (!b.alive) continue;
        b.age += dt;
        // Floor sits a little above the edge so resting beans and their shadows aren't clipped
        const floor = h - 12 - b.s * 0.55;
        b.vy += GRAVITY * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.x < b.s || b.x > w - b.s) {
          b.x = Math.min(w - b.s, Math.max(b.s, b.x));
          b.vx *= -0.5;
        }
        if (b.y >= floor) {
          b.y = floor;
          if (b.vy > 160) {
            // Bounce: lose most of the energy, pick up a fresh tumble
            b.vy *= -0.34;
            b.vx *= 0.7;
            b.wx = b.wx * 0.5 + rand(-4, 4);
            b.wz = b.wz * 0.5 + rand(-4, 4);
          } else {
            // On the floor: slide to a stop and lie down on its side
            b.vy = 0;
            b.vx *= 0.86;
            b.wx *= 0.8; b.wy *= 0.8; b.wz *= 0.8;
            b.rx += (settleTo(b.rx, Math.PI / 2) - b.rx) * 0.12;
            b.rz += (settleTo(b.rz, Math.PI / 2) - b.rz) * 0.12;
            b.rest += dt;
          }
        }
        b.rx += b.wx * dt;
        b.ry += b.wy * dt;
        b.rz += b.wz * dt;
        // Shrink away after resting, or if it somehow never lands
        const fade = Math.max(b.rest - REST, b.age - 8) / 0.45;
        const k = 1 - Math.min(1, Math.max(0, fade));
        if (k <= 0) {
          b.alive = false;
          live--;
          continue;
        }
        dummy.position.set(b.x, -b.y, 0);
        dummy.rotation.set(b.rx, b.ry, b.rz);
        dummy.scale.setScalar(b.s * (k < 1 ? k * k * (3 - 2 * k) : 1));
        dummy.updateMatrix();
        mesh.setMatrixAt(n, dummy.matrix);
        mesh.setColorAt(n, tint.setScalar(b.tone));
        n++;
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      renderer.render(scene, camera);
      drawn = n;
    };
    gsap.ticker.add(frame);

    return () => {
      gsap.ticker.remove(frame);
      ro.disconnect();
      io.disconnect();
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerdown", down);
      host.removeEventListener("pointerleave", leave);
      mesh.dispose();
      geo.dispose();
      src.dispose();
      mat.dispose();
      normalMap.dispose();
      scene.environment?.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full [filter:drop-shadow(0_6px_5px_rgba(0,0,0,0.55))]"
    />
  );
}
