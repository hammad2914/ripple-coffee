"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";

/**
 * A flat white seen from above, simulated as a real fluid (Stam's stable fluids on the GPU).
 * Dye R = foamed milk sitting on top; dye G = milk that has already mixed into the coffee.
 * A scripted pour draws a heart; stirring smears the foam and mixes it in, lightening the coffee where you stir.
 */

export type LatteTheme = {
  table: "transparent" | [number, number, number];
  ceramic: [number, number, number];
  shadow: number; // 0–1 strength of contact shadows
};
export type FluidLatteHandle = { pour: () => void };

const VEL_RES = 128;
const DYE_RES = 512;

const VS = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

// The cup interior is a disk inscribed in the sim square; everything outside it is wall.
const COMMON = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform vec2 uTexel;
bool wall(vec2 uv) { return length(uv - 0.5) > 0.485; }
`;

const ADVECT = COMMON + `
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform float uDt;
uniform float uDissipation;
void main() {
  vec2 v = texture(uVelocity, vUv).xy;
  vec2 coord = vUv - uDt * v * uTexel;
  o = uDissipation * texture(uSource, coord);
  if (wall(vUv)) o = vec4(0.0);
}`;

// Dye advection with mixing: foam that's being moved fast dissolves into the coffee (R → G).
const ADVECT_DYE = COMMON + `
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform float uDt;
uniform vec2 uDyeTexel;
void main() {
  vec2 v = texture(uVelocity, vUv).xy;
  vec2 coord = vUv - uDt * v * uTexel;
  vec4 s = texture(uSource, coord);
  float speed = length(v);
  float loss = s.r * clamp(0.00002 + speed * 0.00009, 0.0, 0.09);
  float g = (texture(uSource, coord + vec2(uDyeTexel.x, 0.0)).g + texture(uSource, coord - vec2(uDyeTexel.x, 0.0)).g +
             texture(uSource, coord + vec2(0.0, uDyeTexel.y)).g + texture(uSource, coord - vec2(0.0, uDyeTexel.y)).g) * 0.25;
  o = vec4(s.r - loss, mix(s.g, g, 0.25) * 0.99985 + loss, 0.0, 1.0);
  if (wall(vUv)) o = vec4(0.0, s.g, 0.0, 1.0);
}`;

const SPLAT = COMMON + `
uniform sampler2D uTarget;
uniform vec2 uPoint;
uniform vec3 uValue;
uniform float uRadius;
void main() {
  vec2 p = vUv - uPoint;
  vec3 add = exp(-dot(p, p) / uRadius) * uValue;
  o = vec4(texture(uTarget, vUv).xyz + add, 1.0);
}`;

// Latte art laid onto the surface as the pour progresses: a layered heart, tip toward the handle.
const STAMP = COMMON + `
uniform sampler2D uTarget;
uniform float uProgress;
float dot2(vec2 v) { return dot(v, v); }
float sdHeart(vec2 p) {
  p.x = abs(p.x);
  if (p.y + p.x > 1.0) return sqrt(dot2(p - vec2(0.25, 0.75))) - sqrt(2.0) / 4.0;
  return sqrt(min(dot2(p - vec2(0.0, 1.0)), dot2(p - 0.5 * max(p.x + p.y, 0.0)))) * sign(p.x - p.y);
}
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
void main() {
  vec4 base = texture(uTarget, vUv);
  vec2 q = (vUv - 0.5) / 0.485;
  float a = 0.42;                     // turn the tip toward the handle (lower right)
  q = mat2(cos(a), -sin(a), sin(a), cos(a)) * q;
  vec2 hq = (q - vec2(0.0, -0.6)) / 1.06;
  float wob = (noise(q * 7.0) - 0.5) * 0.045 + (noise(q * 19.0) - 0.5) * 0.015;
  float d = sdHeart(hq) + wob;
  float inside = smoothstep(0.012, -0.012, d);
  // Layers: thin coffee lines between white wings, like a poured heart
  float rings = fract(-d * 4.6 + 0.3);
  float gap = smoothstep(0.0, 0.025, rings) * (1.0 - smoothstep(0.085, 0.12, rings));
  gap *= smoothstep(0.03, 0.08, -d) * (1.0 - smoothstep(0.3, 0.36, -d));
  float pull = (1.0 - smoothstep(0.01, 0.022, abs(q.x + wob * 0.4))) * step(-0.5, q.y) * step(q.y, 0.42);
  float foam = inside * (1.0 - gap) * (1.0 - pull * 0.9) * 1.1;
  // Reveal from the pour point outward
  float reveal = smoothstep(uProgress * 1.05, uProgress * 1.05 - 0.12, length(q - vec2(0.0, 0.05)));
  // While the pour passes over a spot, the art defines it exactly; after that the fluid owns it.
  o = vec4(mix(base.r, foam, reveal), base.g, 0.0, 1.0);
}`;

const CURL = COMMON + `
uniform sampler2D uVelocity;
void main() {
  float L = texture(uVelocity, vUv - vec2(uTexel.x, 0.0)).y;
  float R = texture(uVelocity, vUv + vec2(uTexel.x, 0.0)).y;
  float T = texture(uVelocity, vUv + vec2(0.0, uTexel.y)).x;
  float B = texture(uVelocity, vUv - vec2(0.0, uTexel.y)).x;
  o = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`;

const VORTICITY = COMMON + `
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float uCurlStrength;
uniform float uDt;
void main() {
  float L = texture(uCurl, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uCurl, vUv + vec2(uTexel.x, 0.0)).x;
  float T = texture(uCurl, vUv + vec2(0.0, uTexel.y)).x;
  float B = texture(uCurl, vUv - vec2(0.0, uTexel.y)).x;
  float C = texture(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= uCurlStrength * C;
  force.y *= -1.0;
  vec2 v = texture(uVelocity, vUv).xy + force * uDt;
  o = vec4(clamp(v, -700.0, 700.0), 0.0, 1.0);
}`;

const DIVERGENCE = COMMON + `
uniform sampler2D uVelocity;
void main() {
  vec2 C = texture(uVelocity, vUv).xy;
  vec2 l = vUv - vec2(uTexel.x, 0.0), r = vUv + vec2(uTexel.x, 0.0);
  vec2 t = vUv + vec2(0.0, uTexel.y), b = vUv - vec2(0.0, uTexel.y);
  float L = wall(l) ? -C.x : texture(uVelocity, l).x;
  float R = wall(r) ? -C.x : texture(uVelocity, r).x;
  float T = wall(t) ? -C.y : texture(uVelocity, t).y;
  float B = wall(b) ? -C.y : texture(uVelocity, b).y;
  o = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`;

const PRESSURE = COMMON + `
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
void main() {
  float C = texture(uPressure, vUv).x;
  vec2 l = vUv - vec2(uTexel.x, 0.0), r = vUv + vec2(uTexel.x, 0.0);
  vec2 t = vUv + vec2(0.0, uTexel.y), b = vUv - vec2(0.0, uTexel.y);
  float L = wall(l) ? C : texture(uPressure, l).x;
  float R = wall(r) ? C : texture(uPressure, r).x;
  float T = wall(t) ? C : texture(uPressure, t).x;
  float B = wall(b) ? C : texture(uPressure, b).x;
  float div = texture(uDivergence, vUv).x;
  o = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0);
}`;

const GRADIENT = COMMON + `
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
void main() {
  float L = texture(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
  float T = texture(uPressure, vUv + vec2(0.0, uTexel.y)).x;
  float B = texture(uPressure, vUv - vec2(0.0, uTexel.y)).x;
  vec2 v = texture(uVelocity, vUv).xy - vec2(R - L, T - B);
  o = vec4(wall(vUv) ? vec2(0.0) : v, 0.0, 1.0);
}`;

const SCALE = COMMON + `
uniform sampler2D uTarget;
uniform float uValue;
void main() { o = uValue * texture(uTarget, vUv); }`;

// Final image: saucer, cup and the latte surface.
const DISPLAY = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uDye;
uniform vec2 uRes;
uniform vec2 uCenter;
uniform float uRadius;
uniform float uTime;
uniform float uIntro;
uniform vec3 uCeramic;
uniform float uShadow;
uniform vec4 uTable;   // rgb + 1 when opaque, 0 when transparent

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p; a *= 0.5; }
  return v;
}
float sdCapsule(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}
vec3 glaze(float s) { return uCeramic * s; }

vec3 col = vec3(0.0);
float alpha = 0.0;
void over(vec3 c, float a) { col = c * a + col * (1.0 - a); alpha = a + alpha * (1.0 - a); }

void main() {
  vec2 frag = gl_FragCoord.xy;
  if (uTable.a > 0.5) {
    vec2 uv = frag / uRes;
    float lamp = 1.0 - smoothstep(0.0, 1.2, length((uv - vec2(0.32, 0.82)) * vec2(uRes.x / uRes.y, 1.0)));
    vec3 t = uTable.rgb * (0.72 + 0.55 * lamp * lamp) + (hash(frag) - 0.5) * 0.012;
    over(t, 1.0);
  }
  float R = uRadius;
  vec2 p = (frag - uCenter) / R;
  float r = length(p);
  vec2 dir = p / max(r, 1e-4);
  float px = 1.0 / R;
  vec2 L = normalize(vec2(-0.5, 0.82));
  vec3 sh = vec3(0.08, 0.05, 0.03);

  float sd = length(p - vec2(0.1, -0.15)) - 1.78;
  over(sh, 0.55 * uShadow * (1.0 - smoothstep(-0.3, 0.35, sd)));
  float saucer = 1.0 - smoothstep(-px, px, r - 1.78);
  {
    float t = r / 1.78;
    float lip = smoothstep(0.82, 0.95, t) * (1.0 - smoothstep(0.97, 1.0, t));
    float well = smoothstep(0.62, 0.70, t) * (1.0 - smoothstep(0.70, 0.80, t));
    float s = 0.86 + 0.14 * dot(dir, L) * lip - 0.1 * well * dot(dir, L) + 0.05 * (1.0 - t);
    over(glaze(s) * (0.985 + 0.03 * noise(frag * 0.6)), saucer);
  }
  float cs = length(p - vec2(0.12, -0.16)) - 1.16;
  over(sh, 0.5 * uShadow * (1.0 - smoothstep(-0.1, 0.32, cs)));
  vec2 ha = vec2(1.05, -0.28), hb = vec2(1.55, -0.5);
  over(sh, 0.35 * uShadow * (1.0 - smoothstep(-0.06, 0.2, sdCapsule(p - vec2(0.08, -0.1), ha, hb, 0.15))));
  float handle = 1.0 - smoothstep(-px, px, sdCapsule(p, ha, hb, 0.15));
  {
    vec2 ba = normalize(hb - ha);
    vec2 nrm = vec2(-ba.y, ba.x);
    float across = clamp(dot(p - ha, nrm) / 0.15, -1.0, 1.0);
    over(glaze(0.84 + 0.16 * dot(nrm * across, L) + 0.05 * (1.0 - abs(across))), handle);
  }
  float cup = 1.0 - smoothstep(-px, px, r - 1.16);
  {
    float t = clamp((r - 1.06) / 0.10, 0.0, 1.0);
    vec2 n = dir * cos(t * 3.14159);
    vec3 lipCol = glaze(0.9 + 0.12 * dot(n, L) + 0.05 * sin(t * 3.14159));
    vec3 wallCol = glaze(0.64 + 0.3 * dot(-dir, L));
    over(mix(wallCol, lipCol, smoothstep(1.06 - px, 1.06 + px, r)), cup);
  }

  float liq = 1.0 - smoothstep(1.0 - px * 1.5, 1.0, r);
  if (liq > 0.0) {
    vec2 suv = p * 0.485 + 0.5;
    vec2 tx = vec2(1.5 / ${DYE_RES}.0);
    vec4 d = texture(uDye, suv);
    float cream = d.r;
    float mixed = clamp(d.g * 1.3, 0.0, 1.0);

    // Coffee: warm crema glow in the middle, darker toward the wall, fine speckle
    float speck = fbm(p * 9.0 + 3.0);
    vec3 coffee = mix(vec3(0.53, 0.30, 0.15), vec3(0.27, 0.13, 0.06), smoothstep(0.1, 1.0, r));
    coffee *= 0.9 + 0.2 * speck;
    coffee = mix(coffee, vec3(0.62, 0.42, 0.26), mixed * 0.7);

    // Foam with a brown halo where it thins out, and microfoam grain
    float c = smoothstep(0.32, 0.85, cream);
    float halo = smoothstep(0.02, 0.32, cream) * (1.0 - c);
    coffee = mix(coffee, vec3(0.66, 0.46, 0.29), halo * 0.75);
    vec3 foam = vec3(0.97, 0.935, 0.875) * (0.95 + 0.07 * fbm(p * 38.0));
    vec3 lc = mix(coffee, foam, c);

    // Relief: foam stands slightly proud of the coffee
    float dx = texture(uDye, suv + vec2(tx.x, 0.0)).r - texture(uDye, suv - vec2(tx.x, 0.0)).r;
    float dy = texture(uDye, suv + vec2(0.0, tx.y)).r - texture(uDye, suv - vec2(0.0, tx.y)).r;
    vec3 n = normalize(vec3(-dx * 2.2, -dy * 2.2, 1.0));
    vec3 l3 = normalize(vec3(-0.45, 0.65, 0.9));
    lc *= 0.9 + 0.16 * dot(n, l3);
    lc += vec3(1.0) * pow(max(reflect(-l3, n).z, 0.0), 40.0) * 0.12 * c;

    // Window reflection and the shading near the wall
    vec2 hp = p - vec2(-0.36, 0.42);
    lc += vec3(1.0, 0.96, 0.9) * pow(1.0 - smoothstep(0.0, 0.34, length(hp * vec2(1.0, 1.7))), 2.0) * 0.1;
    float men = smoothstep(0.955, 0.99, r) * (1.0 - smoothstep(0.99, 1.0, r));
    lc += vec3(0.22, 0.16, 0.1) * men * (0.5 + 0.5 * dot(-dir, L));
    lc *= 1.0 - 0.25 * smoothstep(0.82, 1.0, r) * max(dot(dir, L), 0.0);
    over(lc, liq);
  }

  o = vec4(col, alpha) * uIntro;
}`;

type FBO = { tex: WebGLTexture; fb: WebGLFramebuffer; w: number; h: number };
type DoubleFBO = { read: FBO; write: FBO; swap: () => void };

const FluidLatte = forwardRef<FluidLatteHandle, { theme: LatteTheme; intro?: React.RefObject<number>; className?: string; size?: number }>(
  function FluidLatte({ theme, intro, className = "", size = 0.214 }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const pourFn = useRef<() => void>(() => {});
    useImperativeHandle(ref, () => ({ pour: () => pourFn.current() }), []);

    useEffect(() => {
      const canvas = canvasRef.current!;
      const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: true });
      if (!gl || !(gl.getExtension("EXT_color_buffer_float") || gl.getExtension("EXT_color_buffer_half_float"))) {
        canvas.dataset.fallback = "true";
        return;
      }

      const compile = (type: number, src: string) => {
        const s = gl.createShader(type)!;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
        return s;
      };
      const vs = compile(gl.VERTEX_SHADER, VS);
      const programs: WebGLProgram[] = [];
      const make = (fs: string) => {
        const p = gl.createProgram()!;
        gl.attachShader(p, vs);
        gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
        gl.bindAttribLocation(p, 0, "aPos");
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link");
        programs.push(p);
        const cache = new Map<string, WebGLUniformLocation | null>();
        return {
          use() {
            gl.useProgram(p);
          },
          u(name: string) {
            if (!cache.has(name)) cache.set(name, gl.getUniformLocation(p, name));
            return cache.get(name)!;
          },
        };
      };

      let P: Record<string, ReturnType<typeof make>>;
      try {
        P = {
          advect: make(ADVECT),
          advectDye: make(ADVECT_DYE),
          splat: make(SPLAT),
          stamp: make(STAMP),
          curl: make(CURL),
          vorticity: make(VORTICITY),
          divergence: make(DIVERGENCE),
          pressure: make(PRESSURE),
          gradient: make(GRADIENT),
          scale: make(SCALE),
          display: make(DISPLAY),
        };
      } catch (e) {
        console.error(e);
        canvas.dataset.fallback = "true";
        return;
      }

      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      const textures: WebGLTexture[] = [];
      const framebuffers: WebGLFramebuffer[] = [];
      const fbo = (w: number, h: number, internal: number, format: number): FBO => {
        const tex = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, gl.HALF_FLOAT, null);
        const fb = gl.createFramebuffer()!;
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        gl.viewport(0, 0, w, h);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        textures.push(tex);
        framebuffers.push(fb);
        return { tex, fb, w, h };
      };
      const double = (w: number, h: number, internal: number, format: number): DoubleFBO => {
        const d = { read: fbo(w, h, internal, format), write: fbo(w, h, internal, format), swap() {
          const t = d.read;
          d.read = d.write;
          d.write = t;
        } };
        return d;
      };

      const velocity = double(VEL_RES, VEL_RES, gl.RG16F, gl.RG);
      const dye = double(DYE_RES, DYE_RES, gl.RGBA16F, gl.RGBA);
      const pressure = double(VEL_RES, VEL_RES, gl.R16F, gl.RED);
      const divergence = fbo(VEL_RES, VEL_RES, gl.R16F, gl.RED);
      const curl = fbo(VEL_RES, VEL_RES, gl.R16F, gl.RED);

      const blit = (target: FBO | null) => {
        if (target) {
          gl.viewport(0, 0, target.w, target.h);
          gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb);
        } else {
          gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };
      const bind = (unit: number, tex: WebGLTexture) => {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        return unit;
      };
      const vTexel = [1 / VEL_RES, 1 / VEL_RES] as const;

      const splat = (x: number, y: number, dx: number, dy: number, cream: number, radius: number) => {
        gl.disable(gl.BLEND);
        P.splat.use();
        gl.uniform2f(P.splat.u("uTexel"), ...vTexel);
        gl.uniform1i(P.splat.u("uTarget"), bind(0, velocity.read.tex));
        gl.uniform2f(P.splat.u("uPoint"), x, y);
        gl.uniform3f(P.splat.u("uValue"), dx, dy, 0);
        gl.uniform1f(P.splat.u("uRadius"), radius);
        blit(velocity.write);
        velocity.swap();
        if (cream > 0) {
          gl.uniform1i(P.splat.u("uTarget"), bind(0, dye.read.tex));
          gl.uniform3f(P.splat.u("uValue"), cream, 0, 0);
          blit(dye.write);
          dye.swap();
        }
      };

      const step = (dt: number) => {
        gl.disable(gl.BLEND);
        P.curl.use();
        gl.uniform2f(P.curl.u("uTexel"), ...vTexel);
        gl.uniform1i(P.curl.u("uVelocity"), bind(0, velocity.read.tex));
        blit(curl);

        P.vorticity.use();
        gl.uniform2f(P.vorticity.u("uTexel"), ...vTexel);
        gl.uniform1i(P.vorticity.u("uVelocity"), bind(0, velocity.read.tex));
        gl.uniform1i(P.vorticity.u("uCurl"), bind(1, curl.tex));
        gl.uniform1f(P.vorticity.u("uCurlStrength"), 3);
        gl.uniform1f(P.vorticity.u("uDt"), dt);
        blit(velocity.write);
        velocity.swap();

        P.divergence.use();
        gl.uniform2f(P.divergence.u("uTexel"), ...vTexel);
        gl.uniform1i(P.divergence.u("uVelocity"), bind(0, velocity.read.tex));
        blit(divergence);

        P.scale.use();
        gl.uniform1i(P.scale.u("uTarget"), bind(0, pressure.read.tex));
        gl.uniform1f(P.scale.u("uValue"), 0.8);
        blit(pressure.write);
        pressure.swap();

        P.pressure.use();
        gl.uniform2f(P.pressure.u("uTexel"), ...vTexel);
        gl.uniform1i(P.pressure.u("uDivergence"), bind(1, divergence.tex));
        for (let i = 0; i < 22; i++) {
          gl.uniform1i(P.pressure.u("uPressure"), bind(0, pressure.read.tex));
          blit(pressure.write);
          pressure.swap();
        }

        P.gradient.use();
        gl.uniform2f(P.gradient.u("uTexel"), ...vTexel);
        gl.uniform1i(P.gradient.u("uPressure"), bind(0, pressure.read.tex));
        gl.uniform1i(P.gradient.u("uVelocity"), bind(1, velocity.read.tex));
        blit(velocity.write);
        velocity.swap();

        P.advect.use();
        gl.uniform2f(P.advect.u("uTexel"), ...vTexel);
        gl.uniform1i(P.advect.u("uVelocity"), bind(0, velocity.read.tex));
        gl.uniform1i(P.advect.u("uSource"), bind(0, velocity.read.tex));
        gl.uniform1f(P.advect.u("uDt"), dt);
        gl.uniform1f(P.advect.u("uDissipation"), 0.994);
        blit(velocity.write);
        velocity.swap();

        P.advectDye.use();
        gl.uniform2f(P.advectDye.u("uTexel"), ...vTexel);
        gl.uniform2f(P.advectDye.u("uDyeTexel"), 1 / DYE_RES, 1 / DYE_RES);
        gl.uniform1i(P.advectDye.u("uVelocity"), bind(0, velocity.read.tex));
        gl.uniform1i(P.advectDye.u("uSource"), bind(1, dye.read.tex));
        gl.uniform1f(P.advectDye.u("uDt"), dt);
        blit(dye.write);
        dye.swap();
      };

      const clearAll = () => {
        for (const d of [velocity, dye, pressure]) {
          for (const f of [d.read, d.write]) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, f.fb);
            gl.clearColor(0, 0, 0, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
          }
        }
      };

      // The pour, as a timeline of pour-point positions: fill a disc, then pull through to draw the heart.
      let pourT = -1;
      const POUR = 1.9;
      const stamp = (progress: number) => {
        gl.disable(gl.BLEND);
        P.stamp.use();
        gl.uniform1i(P.stamp.u("uTarget"), bind(0, dye.read.tex));
        gl.uniform1f(P.stamp.u("uProgress"), progress);
        blit(dye.write);
        dye.swap();
      };
      // The pour: foam spreads out from the stream while the surface keeps moving under it.
      const pourAt = (t: number) => {
        if (t > POUR) return;
        stamp(Math.min(1, t / (POUR * 0.8)));

      };
  pourFn.current = () => {
        clearAll();
        pourT = 0;
      };

      // Pointer stirring: velocity only, the foam moves with the coffee.
      let w = 0, h = 0, dpr = 1;
      const resize = () => {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        w = Math.round(canvas.clientWidth * dpr);
        h = Math.round(canvas.clientHeight * dpr);
        canvas.width = w;
        canvas.height = h;
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(canvas);
      const cupR = () => Math.min(w, h) * size;

      let last: { x: number; y: number } | null = null;
      const pending: { x: number; y: number; dx: number; dy: number }[] = [];
      const toSim = (e: PointerEvent) => {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * dpr;
        const y = (rect.height - (e.clientY - rect.top)) * dpr;
        const R = cupR();
        return { x: ((x - w / 2) / R) * 0.485 + 0.5, y: ((y - h / 2) / R) * 0.485 + 0.5 };
      };
      const onMove = (e: PointerEvent) => {
        const s = toSim(e);
        if (last && Math.hypot(s.x - 0.5, s.y - 0.5) < 0.47) {
          const clampF = (v: number) => Math.max(-650, Math.min(650, v));
          if (pending.length < 24) pending.push({ x: s.x, y: s.y, dx: clampF((s.x - last.x) * 7000), dy: clampF((s.y - last.y) * 7000) });
        }
        last = s;
      };
      const onLeave = () => (last = null);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerleave", onLeave);

      const reduce = prefersReducedMotion();
      let visible = true;
      const io = new IntersectionObserver(([en]) => (visible = en.isIntersecting));
      io.observe(canvas);

      const STEP = 1 / 60;
      let acc = 0;
      let lastTime = performance.now();
      const start = lastTime;
      if (!reduce) pourT = 0;
      else {
        // Reduced motion: run the pour instantly so the heart is there, then stay still.
        for (let t = 0; t < POUR; t += STEP) {
          pourAt(t);
          step(STEP);
        }
        pourT = -1;
      }

      const frame = () => {
        if (!visible) return;
        const now = performance.now();
        acc += Math.min((now - lastTime) / 1000, 0.25);
        lastTime = now;
        const maxSteps = (window as unknown as { __fluidMaxSteps?: number }).__fluidMaxSteps ?? 4;
        let n = 0;
        while (acc >= STEP && n < maxSteps && !reduce) {
          if (pourT >= 0) {
            pourAt(pourT);
            pourT += STEP;
            if (pourT > POUR) pourT = -1;
          }
          // A few strokes per step, so a burst of pointer events can't blow the field up.
          for (let k = 0; k < 3 && pending.length; k++) {
            const p = pending.shift()!;
            splat(p.x, p.y, p.dx, p.dy, 0, 0.0022);
          }
          step(STEP);
          acc -= STEP;
          n++;
        }
        if (n === maxSteps) acc = 0;

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, w, h);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        P.display.use();
        gl.uniform1i(P.display.u("uDye"), bind(0, dye.read.tex));
        gl.uniform2f(P.display.u("uRes"), w, h);
        gl.uniform2f(P.display.u("uCenter"), w / 2, h / 2);
        gl.uniform1f(P.display.u("uRadius"), cupR());
        gl.uniform1f(P.display.u("uTime"), (now - start) / 1000);
        gl.uniform1f(P.display.u("uIntro"), intro?.current ?? 1);
        gl.uniform3f(P.display.u("uCeramic"), ...theme.ceramic);
        gl.uniform1f(P.display.u("uShadow"), theme.shadow);
        if (theme.table === "transparent") gl.uniform4f(P.display.u("uTable"), 0, 0, 0, 0);
        else gl.uniform4f(P.display.u("uTable"), ...theme.table, 1);
        blit(null);
      };
      gsap.ticker.add(frame);

      return () => {
        gsap.ticker.remove(frame);
        ro.disconnect();
        io.disconnect();
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("pointerleave", onLeave);
        pourFn.current = () => {};
        textures.forEach((t) => gl.deleteTexture(t));
        framebuffers.forEach((f) => gl.deleteFramebuffer(f));
        programs.forEach((p) => gl.deleteProgram(p));
        gl.deleteBuffer(buf);
        gl.deleteVertexArray(vao);
      };
    }, [theme, intro, size]);

    return (
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="A flat white from above. Move across the coffee to stir the milk in."
        className={`h-full w-full touch-pan-y data-[fallback=true]:rounded-full data-[fallback=true]:bg-[radial-gradient(circle,#f3ece1_0,#f3ece1_9%,#8a5a35_14%,#4a2a17_21%,#efe9df_21.5%,#e7e0d6_37%,transparent_37.5%)] ${className}`}
      />
    );
  },
);

export default FluidLatte;
