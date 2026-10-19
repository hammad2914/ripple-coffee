"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { brand, stripPhotos, unsplash } from "@/lib/data";
import { gsap, useGSAP, prefersReducedMotion } from "@/lib/gsap";

/*
 * A row of photographs drawn with WebGL, laid out 1 unit = 1 CSS pixel.
 * Moving it bends each photo like liquid (the middle trails the edges) and ripples it;
 * the row also curves away at the sides like a curved screen.
 */

const VERT = `
uniform float uVel;
uniform float uCurve;
uniform float uTime;
uniform float uHalfW;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  float bend = sin(uv.y * 3.14159);
  world.x -= bend * uVel * 0.55;
  world.z += sin(uv.x * 7.0 + uTime * 2.2) * abs(uVel) * 0.18 * bend;
  float nx = world.x / uHalfW;
  world.z -= nx * nx * uCurve;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const FRAG = `
uniform sampler2D uTex;
uniform vec2 uPlane;
uniform vec2 uImg;
uniform float uVel;
uniform float uHover;
uniform float uReady;
uniform float uDim;
varying vec2 vUv;
vec2 cover(vec2 uv) {
  float rp = uPlane.x / uPlane.y, ri = uImg.x / uImg.y;
  vec2 s = rp > ri ? vec2(1.0, ri / rp) : vec2(rp / ri, 1.0);
  return (uv - 0.5) * s + 0.5;
}
void main() {
  vec2 uv = cover(vUv);
  uv = (uv - 0.5) * (1.0 - 0.07 * uHover) + 0.5;
  float shift = clamp(uVel, -60.0, 60.0) * 0.00012;
  vec3 c = vec3(texture2D(uTex, uv + vec2(shift, 0.0)).r, texture2D(uTex, uv).g, texture2D(uTex, uv - vec2(shift, 0.0)).b);
  c = mix(vec3(0.89, 0.86, 0.81), c, uReady);
  c *= 1.0 - uDim * 0.25;
  gl_FragColor = vec4(c, 1.0);
}`;

type Open = { index: number; rect: DOMRect } | null;

export default function Gallery() {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [open, setOpen] = useState<Open>(null);
  const openRef = useRef<Open>(null);
  const box = useRef<HTMLDivElement>(null);
  const shade = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.from("[data-gal-in]", {
        y: 30,
        autoAlpha: 0,
        duration: 1.1,
        stagger: 0.07,
        ease: "expo.out",
        scrollTrigger: { trigger: root.current, start: "top 70%" },
      });
    },
    { scope: root },
  );

  useEffect(() => {
    const canvas = canvasRef.current!;
    const stageEl = stage.current!;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 1, 6000);

    const n = stripPhotos.length;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    const geo = new THREE.PlaneGeometry(1, 1, 40, 40);
    const time = { value: 0 };
    const vel = { value: 0 };
    const curve = { value: 0 };
    const halfW = { value: 600 };
    const items = stripPhotos.map((p) => {
      const uniforms = {
        uTex: { value: null as THREE.Texture | null },
        uPlane: { value: new THREE.Vector2(3, 4) },
        uImg: { value: new THREE.Vector2(3, 4) },
        uVel: vel,
        uCurve: curve,
        uTime: time,
        uHalfW: halfW,
        uHover: { value: 0 },
        uReady: { value: 0 },
        uDim: { value: 0 },
      };
      const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms });
      const mesh = new THREE.Mesh(geo, mat);
      scene.add(mesh);
      loader.load(unsplash(p.id, 900), (t) => {
        t.minFilter = THREE.LinearFilter;
        uniforms.uTex.value = t;
        uniforms.uImg.value.set(t.image.width, t.image.height);
        gsap.to(uniforms.uReady, { value: 1, duration: 0.8 });
      });
      return { mesh, uniforms, x: 0 };
    });

    // Layout in CSS pixels
    let W = 0, H = 0, pw = 0, ph = 0, gap = 0, total = 0;
    const resize = () => {
      W = stageEl.clientWidth;
      H = stageEl.clientHeight;
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      camera.position.z = H / 2 / Math.tan((camera.fov * Math.PI) / 360);
      camera.updateProjectionMatrix();
      // Portrait photos, never wider than ~72% of the screen so the next one peeks in on phones
      pw = Math.min(Math.min(H * 0.8, 560) * 0.76, W * 0.72);
      ph = pw / 0.76;

      gap = Math.max(18, W * 0.022);
      total = n * (pw + gap);
      halfW.value = W / 2;
      curve.value = Math.min(260, W * 0.16);
      items.forEach((it) => {
        it.mesh.scale.set(pw, ph, 1);
        it.uniforms.uPlane.value.set(pw, ph);
      });
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(stageEl);

    // Motion: idle drift, drag with momentum, page scroll speed
    const reduce = prefersReducedMotion();
    let offset = 0, dragVel = 0, dragging = false, lastX = 0, downX = 0, moved = 0;
    const pointer = new THREE.Vector2(-9, -9);
    const raycaster = new THREE.Raycaster();
    let hovered: number | null = null;

    const toNdc = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = downX = e.clientX;
      moved = 0;
      dragVel = 0;
      stageEl.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      toNdc(e);
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      moved = Math.max(moved, Math.abs(e.clientX - downX));
      offset -= dx;
      dragVel = -dx;
    };
    const up = () => {
      dragging = false;
      // A click (not a drag) on a photo opens it full screen
      if (moved < 6 && hovered !== null) {
        const it = items[hovered];
        const p = it.mesh.position;
        const r = canvas.getBoundingClientRect();
        const v = new THREE.Vector3(p.x - pw / 2, p.y + ph / 2, 0).project(camera);
        const v2 = new THREE.Vector3(p.x + pw / 2, p.y - ph / 2, 0).project(camera);
        const rect = new DOMRect(r.left + (v.x * 0.5 + 0.5) * r.width, r.top + (-v.y * 0.5 + 0.5) * r.height, ((v2.x - v.x) / 2) * r.width, ((v.y - v2.y) / 2) * r.height);
        setOpen({ index: hovered, rect });
      }
    };
    const leave = () => pointer.set(-9, -9);
    stageEl.addEventListener("pointerdown", down);
    stageEl.addEventListener("pointermove", move);
    stageEl.addEventListener("pointerup", up);
    stageEl.addEventListener("pointercancel", () => (dragging = false));
    stageEl.addEventListener("pointerleave", leave);

    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);

    let smooth = 0;
    const start = performance.now();
    const frame = () => {
      if (!visible) return;
      time.value = (performance.now() - start) / 1000;
      const scrollVel = window.__lenis?.velocity ?? 0;
      if (!dragging) {
        offset += dragVel;
        dragVel *= 0.93;
        if (!reduce && !openRef.current) offset += 0.45;
        offset += scrollVel * 0.8;
      }
      const target = (dragging ? dragVel : dragVel + scrollVel * 0.8) * 1.4;
      smooth += (gsap.utils.clamp(-70, 70, target) - smooth) * 0.12;
      vel.value = reduce ? 0 : smooth;
      dragVel = dragging ? dragVel * 0.5 : dragVel;

      items.forEach((it, i) => {
        let x = i * (pw + gap) - offset;
        x = ((((x + total / 2) % total) + total) % total) - total / 2;
        it.mesh.position.set(x, 0, 0);
      });

      // Hover
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(items.map((it) => it.mesh))[0];
      const h = hit ? items.findIndex((it) => it.mesh === hit.object) : null;
      if (h !== hovered) {
        hovered = h;
        setHover(h);
        stageEl.style.cursor = h === null ? "grab" : "pointer";
      }
      items.forEach((it, i) => {
        const on = hovered === i ? 1 : 0;
        it.uniforms.uHover.value += (on - it.uniforms.uHover.value) * 0.1;
        const dim = hovered !== null && hovered !== i ? 1 : 0;
        it.uniforms.uDim.value += (dim - it.uniforms.uDim.value) * 0.08;
      });
      renderer.render(scene, camera);
    };
    gsap.ticker.add(frame);

    return () => {
      gsap.ticker.remove(frame);
      ro.disconnect();
      io.disconnect();
      stageEl.removeEventListener("pointerdown", down);
      stageEl.removeEventListener("pointermove", move);
      stageEl.removeEventListener("pointerup", up);
      stageEl.removeEventListener("pointerleave", leave);
      items.forEach((it) => {
        it.uniforms.uTex.value?.dispose();
        (it.mesh.material as THREE.Material).dispose();
      });
      geo.dispose();
      renderer.dispose();
    };
  }, []);

  const close = () => {
    const o = openRef.current;
    if (!o || !box.current) return;
    gsap.to(shade.current, { autoAlpha: 0, duration: 0.5, delay: 0.25 });
    gsap.to(box.current, {
      left: o.rect.left,
      top: o.rect.top,
      width: o.rect.width,
      height: o.rect.height,
      duration: 0.75,
      ease: "expo.inOut",
      onComplete: () => {
        setOpen(null);
        window.__lenis?.start();
      },
    });
  };

  // Full-screen view: grows out of the photo's spot on the strip, and shrinks back into it.
  useEffect(() => {
    openRef.current = open;
    if (!open || !box.current) return;
    const r = open.rect;
    const vw = window.innerWidth, vh = window.innerHeight;
    const aspect = r.width / r.height;
    const th = Math.min(vh * 0.84, (vw * 0.9) / aspect);
    const tw = th * aspect;
    window.__lenis?.stop();
    gsap.set(box.current, { left: r.left, top: r.top, width: r.width, height: r.height });
    gsap.to(box.current, { left: (vw - tw) / 2, top: (vh - th) / 2 - 16, width: tw, height: th, duration: 0.9, ease: "expo.inOut" });
    gsap.fromTo(shade.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6 });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);


  const shown = open ? stripPhotos[open.index] : null;

  return (
    <section ref={root} id="gallery" className="overflow-hidden py-28 md:py-32">
      <div className="gutter grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
        <h2 data-gal-in className="display text-[clamp(2.6rem,5.4vw,5.4rem)]">
          Seen at <span className="text-oxblood">the bar.</span>
        </h2>
        <p data-gal-in className="max-w-sm text-[15px] leading-[1.7] text-ink-soft">
          Drag to look around, or tap a photo to see it full size. More every day on{" "}
          <a href={brand.instagram} target="_blank" rel="noreferrer" className="u-link">
            Instagram
          </a>
          .
        </p>
      </div>

      <div data-gal-in ref={stage} className="relative mt-10 h-[56svh] cursor-grab md:h-[min(78svh,680px)] touch-pan-y select-none md:mt-16" aria-label="Photo strip, drag to scroll" role="region">
        <canvas ref={canvasRef} className="block h-full w-full" aria-hidden />
      </div>
      <p className="gutter mt-4 flex min-h-6 items-center justify-center gap-3 text-[14px]" aria-live="polite">
        {hover !== null ? (
          <>
            <span className="font-display tabular-nums text-oxblood">{String(hover + 1).padStart(2, "0")}</span>
            <span>{stripPhotos[hover].caption}</span>
          </>
        ) : (
          <span className="text-ink/45">Drag the photos</span>
        )}
      </p>

      {shown && (
        <div className="fixed inset-0 z-[80]" onClick={close} role="dialog" aria-modal="true" aria-label={shown.caption}>
          <div ref={shade} className="absolute inset-0 bg-ivory/95 backdrop-blur-sm" />
          <div ref={box} className="absolute overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={unsplash(shown.id, 900)} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
            {/* The strip already loaded the 900 px version, so it shows at once; the sharp one fades in over it */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={unsplash(shown.id, 1800)}
              alt={shown.caption}
              onLoad={(e) => gsap.to(e.currentTarget, { opacity: 1, duration: 0.4 })}
              className="absolute inset-0 h-full w-full object-cover opacity-0"
            />
          </div>
          <p className="absolute inset-x-0 bottom-6 text-center text-[14px]">
            {shown.caption} <span className="ml-3 text-ink/45">Click anywhere to close</span>
          </p>
        </div>
      )}
    </section>
  );
}
