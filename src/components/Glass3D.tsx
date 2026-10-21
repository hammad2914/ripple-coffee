"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { gsap, prefersReducedMotion } from "@/lib/gsap";

export type Pour = { name: string; ml: number; color: string; foam?: boolean };
export type Recipe = { id: string; layers: Pour[]; ice?: boolean };

/*
 * Glassware modelled in centimetres and lathed into solids, so the volumes are real:
 * 36 ml of espresso sits low in the round bowl of the double-walled glass, exactly as it would.
 * Lit by a small studio (two softbox strips and a top light) baked into an environment map,
 * which is what gives the glass its long vertical highlights.
 */

type Vessel = {
  shell: [number, number][]; // closed lathe profile (radius, height), axis to axis
  inner: [number, number][]; // liquid boundary, bottom to top: [height, radius]
  maxFill: number;
};

// Taller and slimmer than a tumbler: a 240 ml double-walled glass.
const DOUBLE: Vessel = {
  shell: [
    [0, 0], [2.55, 0], [2.86, 0.1], [3.02, 0.42], [3.06, 0.9], [3.3, 11.55], [3.33, 11.82], [3.29, 11.95], [3.2, 11.96],
    [3.16, 11.84], [3.07, 11.45], [2.94, 5.4], [2.8, 3.9], [2.4, 2.8], [1.66, 2.24], [0.84, 2.06], [0, 2.02],
  ],
  inner: [[2.07, 0], [2.1, 0.84], [2.28, 1.66], [2.84, 2.38], [3.94, 2.77], [5.4, 2.91], [11.4, 3.04]],
  maxFill: 10.6,
};

const HIGHBALL: Vessel = {
  shell: [
    [0, 0], [2.42, 0], [2.6, 0.1], [2.67, 0.32], [2.73, 12.6], [2.75, 12.85], [2.71, 12.96], [2.63, 12.96],
    [2.59, 12.85], [2.56, 1.62], [2.4, 1.43], [0, 1.38],
  ],
  inner: [[1.43, 0], [1.45, 2.32], [1.62, 2.5], [12.5, 2.53]],
  maxFill: 11.6,
};

const radiusAt = (v: Vessel, y: number) => {
  const p = v.inner;
  if (y <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) {
    if (y <= p[i][0]) {
      const t = (y - p[i - 1][0]) / (p[i][0] - p[i - 1][0]);
      return p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t;
    }
  }
  return p[p.length - 1][1];
};

/** Height of the liquid surface for a given volume (1 cm³ = 1 ml). */
const heightFor = (v: Vessel, ml: number) => {
  let vol = 0;
  const dy = 0.01;
  for (let y = v.inner[0][0]; y < v.maxFill; y += dy) {
    const r = radiusAt(v, y + dy / 2) - 0.02;
    vol += Math.PI * r * r * dy;
    if (vol >= ml) return y + dy;
  }
  return v.maxFill;
};

const latheBetween = (v: Vessel, y0: number, y1: number) => {
  const pts = [new THREE.Vector2(0, y0)];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const y = y0 + ((y1 - y0) * i) / n;
    pts.push(new THREE.Vector2(Math.max(0.001, radiusAt(v, y) - 0.025), y));
  }
  pts.push(new THREE.Vector2(0, y1));
  return new THREE.LatheGeometry(pts, 96);
};

function studioEnvironment(renderer: THREE.WebGLRenderer) {
  const scene = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(30, 20, 30), new THREE.MeshBasicMaterial({ color: 0xcfc7bc, side: THREE.BackSide }));
  room.position.y = 6;
  scene.add(room);
  const strip = (x: number, z: number, w: number, h: number, k: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k * 0.97), side: THREE.DoubleSide }));
    m.position.set(x, 6, z);
    m.lookAt(0, 6, 0);
    scene.add(m);
  };
  strip(-9, 4, 3, 16, 7);
  strip(10, 2, 2, 14, 4);
  strip(-2, -12, 8, 10, 1.6);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 2.9) }));
  top.position.set(0, 15.5, 0);
  top.rotation.x = Math.PI / 2;
  scene.add(top);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(scene, 0.03).texture;
  pmrem.dispose();
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
  });
  return env;
}

function contactShadow() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  grad.addColorStop(0, "rgba(40,26,16,0.55)");
  grad.addColorStop(0.45, "rgba(40,26,16,0.22)");
  grad.addColorStop(1, "rgba(40,26,16,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

type LiquidState = {
  h: number[]; colors: string[]; foam: boolean[]; names: string[]; ml: number[]; ice: number; labels: number; vessel: "double" | "highball"; swap: number;
  // The stream: its front falls from above (head 0→1), its tail follows it down when the pour ends (tail 0→1)
  head: number; tail: number; pourColor: string; pourFoam: boolean;
};

const STREAM_TOP = 19; // above the top of the frame

/** `replay`: bump it to pour the same recipe again from empty. */
export default function Glass3D({
  recipe,
  replay = 0,
  side = "right",
  background = "#F3EEE5",
  accent = "#6E1E1E",
}: {
  recipe: Recipe;
  replay?: number;
  side?: "left" | "right";
  background?: string;
  accent?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const api = useRef<{ setRecipe: (r: Recipe, fromEmpty?: boolean) => void } | null>(null);
  const latest = useRef(recipe);
  const mounted = useRef(false);
  const lastReplay = useRef(replay);
  const sideRef = useRef(side);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrapEl = wrap.current!;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    // No tone mapping: what you see through the glass must match the page colour around it exactly.
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(background);
    scene.environment = studioEnvironment(renderer);

    const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 200);
    const target = new THREE.Vector3(0, 5.6, 0);

    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(-6, 12, 8);
    scene.add(key);

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0,
      roughness: 0.02,
      transmission: 1,
      thickness: 0.35,
      ior: 1.5,
      specularIntensity: 1,
      envMapIntensity: 1.25,
      side: THREE.DoubleSide,
      transparent: true,
    });

    const vessels = {
      double: { def: DOUBLE, mesh: new THREE.Mesh(new THREE.LatheGeometry(DOUBLE.shell.map(([r, y]) => new THREE.Vector2(r, y)), 128), glassMat) },
      highball: { def: HIGHBALL, mesh: new THREE.Mesh(new THREE.LatheGeometry(HIGHBALL.shell.map(([r, y]) => new THREE.Vector2(r, y)), 128), glassMat) },
    };
    const group = new THREE.Group();
    scene.add(group);
    group.add(vessels.double.mesh, vessels.highball.mesh);

    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(13, 13), new THREE.MeshBasicMaterial({ map: contactShadow(), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.01;
    scene.add(shadow);

    // The pour: a slightly tapered column from above the frame down to the surface, a little off-centre like a jug's
    const streamGeo = new THREE.CylinderGeometry(1, 0.78, 1, 24, 1, true);
    streamGeo.translate(0, -0.5, 0);
    const streamMat = new THREE.MeshPhysicalMaterial({ color: 0x3a1a0c, roughness: 0.12, clearcoat: 0.7, envMapIntensity: 1.1 });
    const stream = new THREE.Mesh(streamGeo, streamMat);
    stream.visible = false;
    let streamHex = "";

    // Liquid layers (rebuilt as their heights change) and ice
    const layerMeshes: THREE.Mesh[] = [];
    const liquidMat = (hex: string, foam: boolean, clear: boolean) =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(hex),
        roughness: foam ? 0.85 : clear ? 0.08 : 0.32,
        sheen: foam ? 0.6 : 0,
        sheenColor: new THREE.Color(0xffffff),
        clearcoat: foam ? 0 : 0.35,
        clearcoatRoughness: 0.2,
        transparent: clear,
        opacity: clear ? 0.42 : 1,
        envMapIntensity: 0.8,
      });

    const iceMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.06, transparent: true, opacity: 0.38, clearcoat: 1, envMapIntensity: 1.6 });
    const ice = Array.from({ length: 5 }, (_, i) => {
      const m = new THREE.Mesh(new RoundedBoxGeometry(1.55, 1.55, 1.55, 3, 0.28), iceMat);
      m.rotation.set(i * 0.7, i * 1.3, i * 0.4);
      group.add(m);
      return m;
    });
    const iceSlots = [[-0.9, 0.4], [0.8, 0.6], [0.1, -0.9], [-0.4, 0.9], [0.9, -0.5]];

    const state: LiquidState = {
      h: [0, 0, 0, 0, 0], colors: [], foam: [], names: [], ml: [0, 0, 0, 0, 0], ice: 0, labels: 0, vessel: recipe.ice ? "highball" : "double", swap: 1,
      head: 0, tail: 0, pourColor: "#3a1a0c", pourFoam: false,
    };
    group.add(stream);
    let builtKey = "";

    const rebuild = () => {
      const v = vessels[state.vessel].def;
      const key = state.vessel + state.h.map((h) => h.toFixed(3)).join(",") + state.colors.join(",");
      if (key === builtKey) return;
      builtKey = key;
      layerMeshes.forEach((m) => {
        group.remove(m);
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      });
      layerMeshes.length = 0;
      let y = v.inner[0][0];
      state.h.forEach((top, i) => {
        if (top <= y + 0.005 || !state.colors[i]) return;
        const clear = state.names[i] === "Tonic water";
        const m = new THREE.Mesh(latheBetween(v, y, top), liquidMat(state.colors[i], state.foam[i], clear));
        group.add(m);
        layerMeshes.push(m);
        y = top;
      });
    };

    // Labels: an HTML overlay pinned to the right edge of each layer
    const labelEls = Array.from({ length: 5 }, () => {
      const el = document.createElement("div");
      el.className = "pointer-events-none absolute left-0 top-0 flex items-center gap-0 will-change-transform";
      el.innerHTML = `<span class="block size-[5px] rounded-full" style="background:${accent}"></span><span class="block h-px w-[var(--len)]" style="background:${accent};opacity:.55"></span><span class="leading-tight"><span class="block text-[11px] uppercase tracking-[0.14em] text-ink/70" data-n></span><span class="block font-display text-[19px] font-medium" style="color:${accent}" data-ml></span></span>`;
      overlay.current!.appendChild(el);
      return el;
    });
    const iceLabel = document.createElement("div");
    iceLabel.className = "pointer-events-none absolute left-0 top-0 text-[11px] uppercase tracking-[0.14em] text-ink/50";
    iceLabel.textContent = "Over clear ice";
    overlay.current!.appendChild(iceLabel);

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

    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e: PointerEvent) => {
      const r = wrapEl.getBoundingClientRect();
      mouse.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      mouse.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    wrapEl.addEventListener("pointermove", onMove);

    const reduce = prefersReducedMotion();
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);

    const tmp = new THREE.Vector3();
    const project = (x: number, y: number) => {
      tmp.set(x, y, 0).applyMatrix4(group.matrixWorld).project(camera);
      return { x: (tmp.x * 0.5 + 0.5) * w, y: (-tmp.y * 0.5 + 0.5) * h };
    };

    let gx = sideRef.current === "right" ? -2.4 : 2.4;
    const start = performance.now();
    const frame = () => {
      if (!visible) return;
      const t = (performance.now() - start) / 1000;
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;
      const tall = state.vessel === "highball";
      target.y = tall ? 6.6 : 6.1;
      const dist = tall ? 44 : 42;
      camera.position.set(mouse.x * 4, target.y + 4.2 - mouse.y * 2, dist);
      camera.lookAt(target);
      // The glass sits a little left so the labels have room on the right
      // It slides across when the labels switch sides
      const right = sideRef.current === "right";
      gx += ((right ? -2.4 : 2.4) - gx) * (reduce ? 1 : 0.08);
      group.position.x = gx;
      shadow.position.x = gx + 0.9;
      group.rotation.y = reduce ? 0 : Math.sin(t * 0.3) * 0.1;

      vessels.double.mesh.visible = state.vessel === "double";
      vessels.highball.mesh.visible = state.vessel === "highball";
      group.scale.setScalar(0.94 + 0.06 * state.swap);
      glassMat.opacity = state.swap;

      rebuild();
      const v = vessels[state.vessel].def;
      const surface = Math.max(v.inner[0][0], ...state.h);
      ice.forEach((m, i) => {
        m.visible = state.ice > 0.01 && !!vessels[state.vessel] && tall;
        const [ix, iz] = iceSlots[i];
        const yy = Math.min(surface, v.maxFill) - 0.9 - i * 1.25 + (1 - state.ice) * 6;
        m.position.set(ix * 1.05, Math.max(v.inner[0][0] + 0.9, yy), iz * 1.05);
        m.rotation.y += reduce ? 0 : 0.002;
      });

      const yTop = STREAM_TOP + (surface - STREAM_TOP) * state.tail;
      const yBot = STREAM_TOP + (surface - STREAM_TOP) * state.head;
      stream.visible = yTop - yBot > 0.02;
      if (stream.visible) {
        if (streamHex !== state.pourColor) {
          streamHex = state.pourColor;
          streamMat.color.set(streamHex);
        }
        // Foam is heavier and matte; liquids are a thin glossy rope that wavers a little
        const r = state.pourFoam ? 0.3 : 0.15;
        streamMat.roughness = state.pourFoam ? 0.85 : 0.12;
        stream.position.set(0.45 + Math.sin(t * 2.3) * 0.04, yTop, 0.3);
        stream.scale.set(r * (1 + Math.sin(t * 9) * 0.06), yTop - yBot, r);
      }

      renderer.render(scene, camera);

      // Place labels
      let y0 = v.inner[0][0];
      // Labels line up in one column to the right of the glass
      const col = right ? w * 0.6 : w * 0.4;
      // Thin layers sit close together, so each label's text keeps at least LABEL_GAP above the one below;
      // the dot and leader stay on the layer itself.
      const LABEL_GAP = 40;
      let below = Infinity;
      labelEls.forEach((el, i) => {
        const top = state.h[i];
        if (!state.names[i] || top <= y0 + 0.05) {
          el.style.opacity = "0";
          return;
        }
        const mid = (y0 + top) / 2;
        const p = project((radiusAt(v, mid) + 0.08) * (right ? 1 : -1), mid);
        const textY = Math.min(p.y, below - LABEL_GAP);
        below = textY;
        (el.lastElementChild as HTMLElement).style.transform = `translateY(${textY - p.y}px)`;
        el.style.opacity = String(state.labels);
        // Mirrored on the left: text, leader, dot, with the dot at the glass
        el.style.flexDirection = right ? "row" : "row-reverse";
        const text = el.lastElementChild as HTMLElement;
        text.style.margin = right ? "0 0 0 12px" : "0 12px 0 0";
        text.style.textAlign = right ? "left" : "right";
        el.style.transform = `translate(${p.x}px, ${p.y - 3}px)` + (right ? "" : " translateX(-100%)");
        el.style.setProperty("--len", `${Math.max(14, right ? col - p.x - 5 : p.x - col - 5)}px`);
        (el.querySelector("[data-n]") as HTMLElement).textContent = state.names[i];
        (el.querySelector("[data-ml]") as HTMLElement).textContent = `${Math.round(state.ml[i])} ml`;
        y0 = top;
      });
      const ip = project(radiusAt(v, surface) + 1.4, surface + 1.2);
      iceLabel.style.opacity = String(tall ? state.ice * state.labels * 0.9 : 0);
      iceLabel.style.transform = right ? `translate(${col + 17}px, ${ip.y}px)` : `translate(${col - 17}px, ${ip.y}px) translateX(-100%)`;
    };
    gsap.ticker.add(frame);

    // Pour: drain the old drink, swap the vessel if needed, then fill bottom-up by volume.
    let tl: gsap.core.Timeline | null = null;
    let first = true;
    let current: Recipe | null = null;
    api.current = {
      setRecipe(r: Recipe, fromEmpty = false) {
        if (r === current && !fromEmpty) return;
        current = r;
        tl?.kill();
        const nextVessel = r.ice ? "highball" : "double";
        tl = gsap.timeline();
        const quick = reduce;
        state.head = state.tail = 0;
        // GSAP treats arrays as lists of targets, so heights are driven through a 0→1 proxy instead.
        const drive = (dur: number, ease: string, apply: (k: number) => void) => {
          const o = { k: 0 };
          return gsap.to(o, { k: 1, duration: dur, ease, onUpdate: () => apply(o.k) });
        };
        if (fromEmpty) {
          // A fresh glass: start empty, no drain
          state.labels = state.ice = 0;
          state.vessel = nextVessel;
          state.swap = 1;
        } else if (!first && !quick) {
          tl.to(state, { labels: 0, ice: 0, duration: 0.25 });
          let fromH: number[] = [];
          let fromMl: number[] = [];
          const floor = vessels[state.vessel].def.inner[0][0];
          tl.call(() => {
            fromH = [...state.h];
            fromMl = [...state.ml];
          }, [], 0);
          tl.add(
            drive(0.45, "power2.in", (k) => {
              state.h.forEach((_, i) => (state.h[i] = fromH[i] + (floor - fromH[i]) * k));
              state.ml.forEach((_, i) => (state.ml[i] = fromMl[i] * (1 - k)));
            }),
            0,
          );
          if (nextVessel !== state.vessel) tl.to(state, { swap: 0, duration: 0.25 }).call(() => (state.vessel = nextVessel)).to(state, { swap: 1, duration: 0.4 });
        } else state.vessel = nextVessel;
        tl.call(() => {
          const v = vessels[state.vessel].def;
          state.colors = r.layers.map((l) => l.color);
          state.foam = r.layers.map((l) => !!l.foam);
          state.names = r.layers.map((l) => l.name);
          // Mutate in place: the pour tweens below already hold references to these arrays.
          state.h.fill(v.inner[0][0]);
          state.ml.fill(0);
        });
        let cum = 0;
        r.layers.forEach((l, i) => {
          cum += l.ml;
          const v = vessels[nextVessel].def;
          const targetH = heightFor(v, cum);
          const startH = i === 0 ? v.inner[0][0] : heightFor(v, cum - l.ml);
          const layer = gsap.timeline().call(() => {
            // Every layer above this one starts at this layer's floor
            for (let k = i; k < 5; k++) state.h[k] = Math.max(state.h[k], startH);
            state.pourColor = l.color;
            state.pourFoam = !!l.foam;
          });
          // The first layer waits for the stream to fall into the glass
          if (i === 0) layer.to(state, { head: 1, duration: quick ? 0 : 0.28, ease: "power2.in" });
          tl!.add(
            layer
              .add(
                drive(quick ? 0 : 0.8, "power2.out", (k) => {
                  state.h[i] = startH + (targetH - startH) * k;
                  for (let j = i + 1; j < 5; j++) state.h[j] = state.h[i];
                  state.ml[i] = l.ml * k;
                }),
                i === 0 ? ">" : 0,
              ),
            // The first layer must start after the reset above; later ones overlap the previous pour.
            quick || i === 0 ? ">" : ">-0.3",
          );
        });
        // The stream's tail falls in after it, then it's gone
        tl.to(state, { tail: 1, duration: quick ? 0 : 0.25, ease: "power2.in" }).set(state, { head: 0, tail: 0 });
        if (r.ice) tl.to(state, { ice: 1, duration: quick ? 0 : 0.7, ease: "back.out(1.4)" });
        tl.to(state, { labels: 1, duration: quick ? 0 : 0.5 });
        first = false;
      },
    };
    api.current.setRecipe(latest.current);
    mounted.current = true;

    return () => {
      tl?.kill();
      gsap.ticker.remove(frame);
      ro.disconnect();
      io.disconnect();
      wrapEl.removeEventListener("pointermove", onMove);
      labelEls.forEach((el) => el.remove());
      iceLabel.remove();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const m = o.material as THREE.Material & { map?: THREE.Texture };
          m.map?.dispose();
          m.dispose();
        }
      });
      scene.environment?.dispose();
      renderer.dispose();
      api.current = null;
    };
    // The scene is built once; recipe changes go through api.setRecipe below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [background, accent]);

  useEffect(() => {
    sideRef.current = side;
  }, [side]);

  useEffect(() => {
    latest.current = recipe;
    // The scene effect pours the first recipe itself; this handles every change after that.
    const fresh = replay !== lastReplay.current;
    lastReplay.current = replay;
    if (mounted.current) api.current?.setRecipe(recipe, fresh);
  }, [recipe, replay]);

  return (
    <div ref={wrap} className="relative h-full w-full">
      <canvas ref={canvasRef} className="block h-full w-full" aria-hidden />
      <div ref={overlay} className="absolute inset-0 overflow-visible" />
      <span className="sr-only">
        {recipe.id}: {recipe.layers.map((l) => `${l.name} ${l.ml} ml`).join(", ")}
        {recipe.ice ? ", over ice" : ""}
      </span>
    </div>
  );
}
