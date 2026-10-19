"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { gsap, prefersReducedMotion } from "@/lib/gsap";

/** x: position through the five chapters (0 cherry … 4 roasted). roast: 0 green → 1 dark. pop: first-crack swell. */
export type BeanState = { x: number; roast: number; pop: number };

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = THREE.MathUtils.lerp;
const TAU = Math.PI * 2;

/** Real roast colours, sRGB: green, yellowing, cinnamon, medium, dark. */
const ramp = ["#7d8a5c", "#b39050", "#94592b", "#5a3218", "#2e180b"].map((c) => new THREE.Color(c));
const roastColour = (r: number, out: THREE.Color) => {
  const x = Math.min(0.9999, Math.max(0, r)) * (ramp.length - 1);
  const i = Math.floor(x);
  return out.copy(ramp[i]).lerp(ramp[i + 1], x - i);
};

/** A wrinkled-skin normal map, generated once from layered noise. */
export function wrinkleNormalMap() {
  const N = 512;
  const h = new Float32Array(N * N);
  const rnd = (x: number, y: number) => {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const noise = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = rnd(xi % 64, yi % 64), b = rnd((xi + 1) % 64, yi % 64), c = rnd(xi % 64, (yi + 1) % 64), d = rnd((xi + 1) % 64, (yi + 1) % 64);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      let v = 0, amp = 0.5, f = 8;
      for (let o = 0; o < 5; o++) {
        v += amp * noise((x / N) * f, (y / N) * f * 2.2);
        f *= 2;
        amp *= 0.5;
      }
      h[y * N + x] = v;
    }
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const l = h[y * N + ((x - 1 + N) % N)], r = h[y * N + ((x + 1) % N)];
      const t = h[((y - 1 + N) % N) * N + x], b = h[((y + 1) % N) * N + x];
      const nx = (l - r) * 22, ny = (t - b) * 22, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const i = (y * N + x) * 4;
      data[i] = ((nx / len) * 0.5 + 0.5) * 255;
      data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      data[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Sphere morphed into a coffee bean: oval, flat face, S-shaped centre cut.
 * Cherry is the base; morph 0 is the bean, morph 1 the same bean after first crack (swollen, crease split open).
 */
export function beanGeometry(ws = 180, hs = 140) {
  const geo = new THREE.SphereGeometry(1, ws, hs);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const n = pos.count;
  const cherry = new Float32Array(n * 3);
  const bean = new Float32Array(n * 3);
  const cracked = new Float32Array(n * 3);
  // RGBA: three r186 only compiles morphed vertex colours on the 4-channel path.
  const baseCol = new Float32Array(n * 4);
  const beanCol = new Float32Array(n * 4);
  const crackedCol = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    // Cherry: a slightly squashed sphere with a dimple where the stem was
    const stem = Math.exp(-((x * x + z * z) / 0.02)) * (y > 0 ? 1 : 0);
    cherry.set([x * 0.82, y * 0.78 - stem * 0.06, z * 0.82], i * 3);
    // Bean: long axis vertical, flat face toward +z, crease down the middle of the face
    // Organic irregularity so it doesn't read as a perfect pill
    const wob = 1 + 0.035 * Math.sin(x * 5.1 + y * 3.3) * Math.cos(z * 4.2 - y * 2.1);
    const bx = x * 0.62 * wob, by = y * 0.82 * wob;
    let bz = z * 0.52 * wob;
    if (bz > 0) bz *= 0.7;
    const along = 1 - smoothstep(0.55, 0.8, Math.abs(by));
    const d = bx - 0.045 * Math.sin(by * 3.6 + 0.4);
    const face = smoothstep(0.05, 0.25, bz);
    const cut = Math.exp(-((d / 0.045) ** 2)) * along * face;
    const lip = Math.exp(-((d / 0.09) ** 2)) * along * face;
    bean.set([bx, by, bz + lip * 0.035 - cut * 0.28], i * 3);
    // After first crack: a little bigger, the cut wider and deeper, its lips pushed out
    const cutC = Math.exp(-((d / 0.07) ** 2)) * along * face;
    const lipC = Math.exp(-((d / 0.13) ** 2)) * along * face;
    cracked.set([bx * 1.05, by * 1.04, (bz + lipC * 0.06 - cutC * 0.36) * 1.05], i * 3);
    baseCol.set([0.82, 0.82, 0.82, 1], i * 4);
    // Crease shading, with the pale thread of silverskin in its centre
    const shade = 1 - Math.exp(-((d / 0.07) ** 2)) * along * face * 0.78;
    const silver = Math.exp(-((d / 0.012) ** 2)) * along * face * 0.5;
    const c = 0.82 * shade + silver * 0.45;
    beanCol.set([c, c * 0.98, c * 0.9, 1], i * 4);
    // The opened crease is darker, with the chaff inside showing pale
    const shadeC = 1 - Math.exp(-((d / 0.1) ** 2)) * along * face * 0.85;
    const silverC = Math.exp(-((d / 0.02) ** 2)) * along * face * 0.7;
    const cc = 0.82 * shadeC + silverC * 0.6;
    crackedCol.set([cc, cc * 0.97, cc * 0.86, 1], i * 4);
  }
  geo.setAttribute("position", new THREE.BufferAttribute(cherry, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(baseCol, 4));
  geo.computeVertexNormals();
  const normals = (p: Float32Array) => {
    const tmp = new THREE.BufferGeometry();
    tmp.setAttribute("position", new THREE.BufferAttribute(p, 3));
    tmp.setIndex(geo.index);
    tmp.computeVertexNormals();
    const nrm = tmp.attributes.normal as THREE.BufferAttribute;
    tmp.dispose();
    return nrm;
  };
  geo.morphAttributes.position = [new THREE.BufferAttribute(bean, 3), new THREE.BufferAttribute(cracked, 3)];
  geo.morphAttributes.normal = [normals(bean), normals(cracked)];
  geo.morphAttributes.color = [new THREE.BufferAttribute(beanCol, 4), new THREE.BufferAttribute(crackedCol, 4)];
  return geo;
}

/** A soft round puff for smoke sprites. */
function puffTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.4, "rgba(255,255,255,0.35)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A small curled, ragged flake of chaff. */
function flakeGeometry() {
  const geo = new THREE.CircleGeometry(0.5, 10, 0, TAU);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 1; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const r = 0.75 + 0.45 * Math.abs(Math.sin(i * 2.7));
    p.setXYZ(i, x * r, y * r * 0.45, -0.4 * (x * x + y * y));
  }
  geo.computeVertexNormals();
  return geo;
}

// Pose per chapter: [x, rx, ry, rz, zoom]. Between keys the bean eases, so each chapter has its own move:
// the cherry turns, the bean flips end over end, turns its back while chaff peels, faces you for the crack, then settles.
const POSES: [number, number, number, number, number][] = [
  [0, 0.25, -0.7, 0.2, 0.85],
  [0.6, 0.1, 0.5, 0.3, 0.88],
  [1.0, 0, 0, 0.32, 0.95],
  [1.6, TAU, 0.3, -0.25, 1.15],
  [2.0, TAU, 1.3, 0.1, 0.98],
  [2.6, TAU + 0.25, 2.5, 0.2, 0.98],
  [3.0, TAU, TAU, 0.32, 1.05],
  [3.6, TAU, TAU + 0.12, 0.32, 1.1],
  [4.0, TAU + 0.45, TAU + 0.7, 0.5, 0.92],
];
const pose = (x: number) => {
  let i = 0;
  while (i < POSES.length - 2 && x > POSES[i + 1][0]) i++;
  const a = POSES[i], b = POSES[i + 1];
  const f = smoothstep(a[0], b[0], x);
  return { rx: lerp(a[1], b[1], f), ry: lerp(a[2], b[2], f), rz: lerp(a[3], b[3], f), zoom: lerp(a[4], b[4], f) };
};

// Deterministic randoms, so the chaff and smoke land the same way every visit
const rnd = (i: number) => {
  const s = Math.sin(i * 91.7 + 13.1) * 43758.5453;
  return s - Math.floor(s);
};

const FLAKES = 16;
const PUFF = 18;
const WISPS = 18;

/**
 * The roast as one bean. The canvas is `spread` times larger than the bean's frame so smoke and chaff
 * have room to drift without hitting its edges.
 */
export default function Bean3D({ state, spread = 1, className = "" }: { state: React.RefObject<BeanState>; spread?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    scene.environment = pmrem.fromScene(room, 0.04).texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
    const key = new THREE.DirectionalLight(0xfff2e2, 2.4);
    key.position.set(-3, 3, 4);
    const rim = new THREE.DirectionalLight(0xffe2c4, 2.2);
    rim.position.set(3.5, 1.5, -3);
    scene.add(key, rim);

    // pivot: tilt + crack swell. body: the chapter pose. Inside it the bean, its twin, and the cherry skin.
    const pivot = new THREE.Group();
    const body = new THREE.Group();
    pivot.add(body);
    scene.add(pivot);

    const normalMap = wrinkleNormalMap();
    const geo = beanGeometry();
    const mat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      normalMap,
      normalScale: new THREE.Vector2(0.6, 0.6),
      roughness: 0.6,
      clearcoatRoughness: 0.18,
      sheenRoughness: 0.6,
      envMapIntensity: 0.55,
    });
    const hero = new THREE.Mesh(geo, mat);
    hero.morphTargetInfluences = [1, 0];
    body.add(hero);

    // A cherry holds two beans, flat faces together. The twin leaves with the skin.
    const twinMat = mat.clone();
    const twin = new THREE.Mesh(geo, twinMat);
    twin.morphTargetInfluences = [1, 0];
    body.add(twin);

    // Cherry skin in two halves (front and back of the bean's face), glossy red outside, pulp inside
    const skinOut = new THREE.MeshPhysicalMaterial({ color: "#5a0a0c", roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.22, envMapIntensity: 0.8 });
    const skinIn = new THREE.MeshStandardMaterial({ color: "#dcc47e", roughness: 0.35, side: THREE.BackSide });
    const halves = [0, Math.PI].map((phi) => {
      const g = new THREE.SphereGeometry(1, 72, 48, phi, Math.PI);
      const half = new THREE.Group();
      half.add(new THREE.Mesh(g, skinOut), new THREE.Mesh(g, skinIn));
      body.add(half);
      return { half, g };
    });

    // Chaff: flakes sitting on the bean's surface that peel off during yellowing
    const beanPos = geo.morphAttributes.position![0];
    const beanNrm = geo.morphAttributes.normal![0];
    const flakeGeo = flakeGeometry();
    const Z = new THREE.Vector3(0, 0, 1);
    const flakes = Array.from({ length: FLAKES }, (_, i) => {
      // Pick a vertex away from the tips
      let v = 0;
      for (let tries = 0; tries < 50; tries++) {
        v = Math.floor(rnd(i * 7 + tries) * beanPos.count);
        if (Math.abs(beanPos.getY(v)) < 0.6) break;
      }
      const p = new THREE.Vector3().fromBufferAttribute(beanPos, v);
      const nrm = new THREE.Vector3().fromBufferAttribute(beanNrm, v).normalize();
      const q0 = new THREE.Quaternion().setFromUnitVectors(Z, nrm).multiply(new THREE.Quaternion().setFromAxisAngle(Z, rnd(i + 40) * TAU));
      const m = new THREE.MeshStandardMaterial({ color: "#c4ad80", roughness: 0.95, side: THREE.DoubleSide, transparent: true, opacity: 0 });
      const mesh = new THREE.Mesh(flakeGeo, m);
      mesh.visible = false;
      scene.add(mesh);
      const axis = new THREE.Vector3(rnd(i + 3) - 0.5, rnd(i + 5) - 0.5, rnd(i + 9) - 0.5).normalize();
      return { mesh, m, p, nrm, q0, axis, size: 0.08 + rnd(i + 11) * 0.08, at: 2.05 + rnd(i + 17) * 0.65 };
    });

    // Smoke: a puff at first crack, then wisps curling off the roasted bean
    const puffTex = puffTexture();
    const smoke = Array.from({ length: PUFF + WISPS }, (_, i) => {
      const m = new THREE.SpriteMaterial({ map: puffTex, color: "#d8d0c6", transparent: true, depthWrite: false, opacity: 0 });
      const s = new THREE.Sprite(m);
      s.visible = false;
      scene.add(s);
      const a = rnd(i + 100) * TAU;
      return { s, m, dir: new THREE.Vector3(Math.cos(a), Math.sin(a) * 0.8 + 0.25, (rnd(i + 200) - 0.5) * 0.6).normalize() };
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
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);

    const reduce = prefersReducedMotion();
    const tmpC = new THREE.Color();
    const tmpV = new THREE.Vector3();
    const tmpN = new THREE.Vector3();
    const tmpQ = new THREE.Quaternion();
    const spin = new THREE.Quaternion();
    const heroQ = new THREE.Quaternion();
    const center = new THREE.Vector3();
    const start = performance.now();
    let orbit = 0, lastT = 0;
    const frame = () => {
      if (!visible) return;
      const t = reduce ? 0 : (performance.now() - start) / 1000;
      const dt = Math.min(0.05, t - lastT);
      lastT = t;
      const s = state.current;
      const x = s.x;

      // Bean surface: matte and wrinkled when green, smoother as it darkens, oily once roasted
      roastColour(s.roast, tmpC);
      mat.color.copy(tmpC);
      const oil = smoothstep(3.5, 4, x);
      mat.roughness = lerp(0.8, 0.5, smoothstep(0.55, 1, s.roast)) - oil * 0.2;
      mat.clearcoat = oil * 0.5;
      const wrinkle = lerp(0.9, 0.25, smoothstep(0.2, 0.7, s.roast));
      mat.normalScale.set(wrinkle, wrinkle);
      mat.sheen = (1 - smoothstep(0.1, 0.4, s.roast)) * 0.3;
      const crack = smoothstep(2.78, 2.95, x);
      hero.morphTargetInfluences![0] = 1 - crack;
      hero.morphTargetInfluences![1] = crack;

      // Pose for this point in the story, plus a slow orbit once it's roasted
      const p = pose(x);
      orbit += dt * 0.35 * oil;
      const idle = reduce ? 0 : 1;
      body.rotation.set(p.rx + Math.sin(t * 0.6) * 0.05 * idle, p.ry + orbit + Math.sin(t * 0.45) * 0.08 * idle, 0);
      pivot.rotation.z = p.rz;
      pivot.position.y = Math.sin(t * 0.8) * 0.03 * idle;
      pivot.scale.setScalar(1 + s.pop * 0.07);

      // Camera: pulled back by `spread` so the bean keeps its size, with a jolt at the crack
      const jolt = Math.exp(-(((x - 2.9) / 0.06) ** 2)) * idle;
      camera.position.set(Math.sin(t * 55) * 0.05 * jolt, 0.15 + Math.cos(t * 47) * 0.04 * jolt, (4.6 * spread) / p.zoom);
      camera.lookAt(0, 0, 0);

      // Cherry: closed, then split along the bean's face. The halves and the twin drop out of the frame
      // (the canvas runs past the section's bottom edge, so they leave the screen rather than fade).
      const open = smoothstep(0.35, 0.95, x);
      hero.position.z = -0.3 * (1 - open);
      const [front, back] = halves;
      front.half.visible = back.half.visible = twin.visible = open < 0.999;
      front.half.scale.set(0.94, 0.9, 0.94);
      back.half.scale.set(0.94, 0.9, 0.94);
      front.half.position.set(1.0 * open, 0.5 * open - 5 * open * open, 0.3 * open);
      front.half.rotation.set(open * 1.2, -open * 1.6, open * 0.6);
      back.half.position.set(-1.1 * open, 0.3 * open - 4.6 * open * open, -0.4 * open);
      back.half.rotation.set(0, open * 1.4, -open * 0.8);
      twin.position.set(0.7 * open, 0.2 * open - 5.4 * open * open, 0.3 + 0.2 * open);
      twin.rotation.set(open * 2.2, Math.PI, open * 1.4);
      twinMat.color.copy(mat.color);
      twinMat.roughness = mat.roughness;
      twinMat.normalScale.copy(mat.normalScale);
      twinMat.sheen = mat.sheen;

      // Where the bean is in the world, for the chaff and smoke
      hero.updateWorldMatrix(true, false);
      hero.getWorldQuaternion(heroQ);
      center.setFromMatrixPosition(hero.matrixWorld);
      const scale = pivot.scale.x;

      for (let i = 0; i < FLAKES; i++) {
        const f = flakes[i];
        const k = smoothstep(f.at, f.at + 0.55, x);
        const show = smoothstep(1.8, 2.0, x) * (1 - smoothstep(0.45, 1, k)) * 0.85;
        f.mesh.visible = show > 0.001;
        if (!f.mesh.visible) continue;
        f.m.opacity = show;
        tmpV.copy(f.p).applyMatrix4(hero.matrixWorld);
        tmpN.copy(f.nrm).transformDirection(hero.matrixWorld);
        // Lift off along the surface normal, then drift up and sideways
        tmpV.addScaledVector(tmpN, 0.012 + k * 0.7);
        tmpV.x += Math.sin(i * 2.1) * 0.5 * k;
        tmpV.y += k * k * 1.4;
        f.mesh.position.copy(tmpV);
        spin.setFromAxisAngle(f.axis, k * 5);
        f.mesh.quaternion.copy(heroQ).multiply(f.q0).premultiply(tmpQ.copy(spin));
        f.mesh.scale.setScalar(f.size * scale);
      }

      // Puff: bursts out at the crack and fades as you scroll on
      const kp = smoothstep(2.86, 3.45, x);
      for (let i = 0; i < PUFF; i++) {
        const sm = smoke[i];
        const k = Math.min(1, kp * (0.8 + rnd(i + 300) * 0.4));
        const a = k > 0 && k < 1 ? Math.pow(1 - k, 1.5) * 0.5 * smoothstep(0, 0.05, k) : 0;
        sm.s.visible = a > 0.002;
        if (!sm.s.visible) continue;
        sm.s.position.copy(center).addScaledVector(sm.dir, 0.35 + k * 1.2);
        sm.s.position.y += k * 0.5 + Math.sin(t * 0.7 + i) * 0.03;
        sm.s.scale.setScalar(0.5 + k * 1.7);
        sm.m.opacity = a;
        sm.m.rotation = i * 1.3 + t * 0.1;
      }
      // Wisps: a slow, continuous curl off the top once it's roasted
      const wr = smoothstep(3.3, 3.8, x);
      for (let i = 0; i < WISPS; i++) {
        const sm = smoke[PUFF + i];
        const life = (t * 0.12 + i / WISPS) % 1;
        const a = Math.sin(life * Math.PI) * 0.2 * wr;
        sm.s.visible = a > 0.002;
        if (!sm.s.visible) continue;
        sm.s.position.set(
          center.x + Math.sin(life * 5 + i * 1.7) * 0.2 * (life + 0.2) + (rnd(i + 400) - 0.5) * 0.25,
          center.y + 0.5 + life * 1.8,
          center.z + 0.1,
        );
        sm.s.scale.setScalar(0.35 + life * 1.3);
        sm.m.opacity = a;
        sm.m.rotation = i * 0.9 + life * 1.5;
      }

      renderer.render(scene, camera);
    };
    gsap.ticker.add(frame);

    return () => {
      gsap.ticker.remove(frame);
      ro.disconnect();
      io.disconnect();
      geo.dispose();
      mat.dispose();
      twinMat.dispose();
      skinOut.dispose();
      skinIn.dispose();
      halves.forEach((hv) => hv.g.dispose());
      flakeGeo.dispose();
      flakes.forEach((f) => f.m.dispose());
      smoke.forEach((sm) => sm.m.dispose());
      puffTex.dispose();
      normalMap.dispose();
      scene.environment?.dispose();
      renderer.dispose();
    };
  }, [state, spread]);

  return <canvas ref={ref} aria-hidden className={`pointer-events-none h-full w-full [filter:drop-shadow(0_40px_40px_rgba(0,0,0,0.45))] ${className}`} />;
}
