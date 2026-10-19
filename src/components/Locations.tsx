"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Map as MLMap, Marker as MLMarker, LngLatBoundsLike } from "maplibre-gl";
import { bars } from "@/lib/data";
import { barStatus, karachiNow, type KarachiNow } from "@/lib/hours";
import { gsap, useGSAP } from "@/lib/gsap";

const PAPER = "#efe8dd";

/** Recolour OpenFreeMap "Liberty" into the site's palette: paper land, sage parks, quiet water, ivory 3D buildings. */
function paintMap(map: MLMap) {
  const paint = (id: string, prop: string, value: unknown) => {
    try {
      map.setPaintProperty(id, prop as Parameters<MLMap["setPaintProperty"]>[1], value as never);
    } catch {}
  };
  const hide = (id: string) => {
    try {
      map.setLayoutProperty(id, "visibility", "none");
    } catch {}
  };
  for (const layer of map.getStyle().layers ?? []) {
    const id = layer.id;
    if (layer.type === "raster") hide(id);
    else if (layer.type === "background") paint(id, "background-color", PAPER);
    else if (layer.type === "fill" && id === "water") paint(id, "fill-color", "#c9d2cd");
    else if (layer.type === "line" && id.startsWith("waterway")) paint(id, "line-color", "#bcc7c2");
    else if (layer.type === "fill" && /park|wood|grass|wetland|pitch/.test(id)) {
      paint(id, "fill-color", "#dde0cd");
      paint(id, "fill-opacity", 1);
    } else if (layer.type === "line" && id === "park_outline") hide(id);
    else if (layer.type === "fill" && /landuse|landcover|aeroway|road_area/.test(id)) paint(id, "fill-color", "#ebe4d8");
    else if (layer.type === "fill" && id === "building") paint(id, "fill-color", "#e3dbce");
    else if (layer.type === "fill-extrusion") {
      paint(id, "fill-extrusion-color", "#f1ece3");
      paint(id, "fill-extrusion-opacity", 0.92);
    } else if (layer.type === "line" && /casing/.test(id)) paint(id, "line-color", "#ddd3c4");
    else if (layer.type === "line" && /rail|hatching/.test(id)) paint(id, "line-color", "#d5cbbd");
    else if (layer.type === "line" && /motorway|trunk|primary/.test(id)) paint(id, "line-color", "#ffffff");
    else if (layer.type === "line" && /road|bridge|tunnel/.test(id)) paint(id, "line-color", "#f8f4ee");
    else if (layer.type === "line" && /boundary/.test(id)) hide(id);
    else if (layer.type === "symbol") {
      if (/poi|shield|arrow|airport|path|minor/.test(id)) {
        hide(id);
        continue;
      }
      // English names only; the style otherwise stacks Latin and Urdu
      try {
        map.setLayoutProperty(id, "text-field", ["coalesce", ["get", "name:en"], ["get", "name:latin"], ["get", "name"]]);
      } catch {}
      paint(id, "text-color", "#857b70");
      paint(id, "text-halo-color", PAPER);
      paint(id, "text-halo-width", 1.4);
    }
  }
  map.setLight({ anchor: "viewport", color: "#ffffff", intensity: 0.32, position: [1.4, 200, 40] });
  map.setSky({ "sky-color": "#f3eee5", "horizon-color": "#efe8dd", "fog-color": "#f3eee5", "sky-horizon-blend": 0.6, "horizon-fog-blend": 0.8, "fog-ground-blend": 0.4 });
}

function pin(name: string, index: number) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "rc-pin";
  el.setAttribute("aria-label", `Show ${name} on the map`);
  el.innerHTML = `<span class="rc-pin__pulse"></span><span class="rc-pin__dot">${index + 1}</span><span class="rc-pin__label">${name}</span>`;
  return el;
}

export default function Locations() {
  const root = useRef<HTMLElement>(null);
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const markers = useRef<MLMarker[]>([]);
  const orbit = useRef<number | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState<KarachiNow | null>(null);
  const [wide, setWide] = useState(true);

  // The footer's bar links ask the map to fly to a bar
  useEffect(() => {
    const onShow = (e: Event) => setActive((e as CustomEvent<number>).detail);
    window.addEventListener("ripple:show-bar", onShow);
    return () => window.removeEventListener("ripple:show-bar", onShow);
  }, []);

  useEffect(() => {
    const tick = () => setNow(karachiNow());
    const first = requestAnimationFrame(tick);
    const id = setInterval(tick, 30_000);
    const mq = window.matchMedia("(min-width: 1024px)");
    const onMq = () => setWide(mq.matches);
    const firstMq = requestAnimationFrame(onMq);
    mq.addEventListener("change", onMq);
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(firstMq);
      clearInterval(id);
      mq.removeEventListener("change", onMq);
    };
  }, []);

  // Build the map once the section is near the viewport
  useEffect(() => {
    let cancelled = false;
    const io = new IntersectionObserver(
      async ([e]) => {
        if (!e.isIntersecting || map.current) return;
        io.disconnect();
        const { Map, Marker, setWorkerUrl } = await import("maplibre-gl");
        // Served from public/ (copied on postinstall): the bundler can't resolve the worker next to its chunk.
        setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
        if (cancelled || !mapEl.current) return;
        const coarse = window.matchMedia("(pointer: coarse)").matches;
        const m = new Map({
          container: mapEl.current,
          style: "https://tiles.openfreemap.org/styles/liberty",
          center: [74.36, 31.5],
          zoom: 11.6,
          pitch: 45,
          bearing: -18,
          maxPitch: 72,
          attributionControl: { compact: true },
          scrollZoom: false,
          dragPan: !coarse,
          cooperativeGestures: coarse,
          canvasContextAttributes: { antialias: true },
        });
        map.current = m;
        m.on("style.load", () => paintMap(m));
        m.on("load", () => {
          markers.current = bars.map((b, i) => {
            const el = pin(b.name, i);
            el.addEventListener("click", () => setActive(i));
            return new Marker({ element: el, anchor: "bottom" }).setLngLat([b.lng, b.lat]).addTo(m);
          });
          setReady(true);
        });
        // Any manual drag stops the slow orbit
        m.on("dragstart", () => {
          if (orbit.current) cancelAnimationFrame(orbit.current);
          orbit.current = null;
        });
      },
      { rootMargin: "800px 0px" },
    );
    io.observe(root.current!);
    return () => {
      cancelled = true;
      io.disconnect();
      if (orbit.current) cancelAnimationFrame(orbit.current);
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Camera: overview of all three, or fly in and orbit the chosen bar
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    if (orbit.current) cancelAnimationFrame(orbit.current);
    orbit.current = null;
    markers.current.forEach((mk, i) => mk.getElement().toggleAttribute("data-active", i === active));
    const padding = wide ? { top: 80, bottom: 80, left: 460, right: 80 } : { top: 60, bottom: 60, left: 40, right: 40 };
    if (active === null) {
      const lngs = bars.map((b) => b.lng);
      const lats = bars.map((b) => b.lat);
      const bounds: LngLatBoundsLike = [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ];
      m.fitBounds(bounds, { padding, pitch: 45, bearing: -18, duration: 2200, essential: true });
      return;
    }
    const b = bars[active];
    m.flyTo({
      center: [b.lng, b.lat],
      zoom: 16.4,
      pitch: 62,
      bearing: [-28, 22, -8][active],
      padding,
      speed: 0.7,
      curve: 1.6,
      essential: true,
    });
    // Once the camera lands, drift slowly around the bar
    const startOrbit = () => {
      let last = performance.now();
      const step = (t: number) => {
        const dt = t - last;
        last = t;
        m.setBearing(m.getBearing() + dt * 0.0035);
        orbit.current = requestAnimationFrame(step);
      };
      orbit.current = requestAnimationFrame(step);
    };
    m.once("moveend", startOrbit);
    return () => {
      m.off("moveend", startOrbit);
    };
  }, [active, ready, wide]);

  useGSAP(
    () => {
      gsap.from("[data-loc-panel]", {
        y: 40,
        autoAlpha: 0,
        duration: 1.2,
        ease: "expo.out",
        scrollTrigger: { trigger: root.current, start: "top 60%" },
      });
    },
    { scope: root },
  );

  const b = active === null ? null : bars[active];
  const st = (i: number) => (now ? barStatus(bars[i], now) : null);

  return (
    <section ref={root} id="locations" className="relative bg-linen lg:h-svh lg:min-h-[720px]">
      <div className="relative h-[62svh] lg:absolute lg:inset-0 lg:h-auto">
        <div className="absolute inset-0">
          <div ref={mapEl} className="h-full w-full" />
        </div>
        {/* Soft fade into the page at the edges */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-ivory to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-linen to-transparent" />
        {active !== null && (
          <button
            type="button"
            onClick={() => setActive(null)}
            className="absolute right-4 top-20 z-10 bg-ivory/90 px-4 py-2 text-[13px] shadow-[0_8px_24px_-12px_rgba(27,25,22,0.4)] backdrop-blur hover:bg-ivory lg:right-8 lg:top-24"
          >
            ← All three bars
          </button>
        )}
      </div>

      <div className="gutter relative z-10 -mt-16 pb-16 lg:pointer-events-none lg:absolute lg:inset-y-0 lg:left-0 lg:mt-0 lg:flex lg:items-center lg:pb-0">
        <div
          data-loc-panel
          className="pointer-events-auto w-full bg-ivory p-6 shadow-[0_30px_80px_-30px_rgba(27,25,22,0.45)] sm:p-8 lg:w-[400px]"
        >
          <h2 className="display text-[clamp(2.2rem,3.4vw,3.2rem)]">
            Find us in <span className="text-oxblood">Lahore.</span>
          </h2>
          <p className="mt-3 text-[14px] leading-[1.6] text-ink/60">Three bars across Gulberg and DHA. Pick one and we&apos;ll take you there.</p>

          <ul className="mt-6">
            {bars.map((bar, i) => {
              const s = st(i);
              const on = active === i;
              return (
                <li key={bar.id} className="border-t border-ink/12 last:border-b">
                  <button type="button" onClick={() => setActive(on ? null : i)} aria-pressed={on} className="group flex w-full items-center gap-4 py-4 text-left">
                    <span
                      className={`grid size-7 shrink-0 place-items-center rounded-full text-[12px] font-medium transition-colors ${
                        on ? "bg-oxblood text-ivory" : "bg-ink/[0.06] text-ink group-hover:bg-oxblood group-hover:text-ivory"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="flex-1">
                      <span className="display block text-[20px] tracking-[-0.03em]">{bar.name}</span>
                      <span className="mt-0.5 flex items-center gap-2 text-[12.5px] text-ink/55">
                        {s && <span className={`size-1.5 rounded-full ${s.open ? "bg-live" : "bg-ink/30"}`} />}
                        {bar.area} · {s ? s.text : bar.hoursLabel}
                      </span>
                    </span>
                    <span className={`text-ink/40 transition-transform duration-500 ${on ? "rotate-90 text-oxblood" : "group-hover:translate-x-1"}`} aria-hidden>
                      →
                    </span>
                  </button>
                  <div className={`grid transition-[grid-template-rows] duration-700 ease-[var(--ease-out-expo)] ${on ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                    <div className="overflow-hidden">
                      <div className="pb-5">
                        <div className="relative aspect-[16/9] overflow-hidden">
                          <Image src={bar.img} alt={`${bar.name}, ${bar.area}`} fill sizes="400px" className="object-cover" />
                        </div>
                        <p className="mt-4 text-[14px] leading-[1.6] text-ink-soft">{bar.note}</p>
                        <p className="mt-2 text-[13px] text-ink/50">{bar.address}</p>
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          <span className="flex flex-wrap gap-1.5">
                            {bar.good.map((g) => (
                              <span key={g} className="bg-ink/[0.05] px-2.5 py-1 text-[12px]">
                                {g}
                              </span>
                            ))}
                          </span>
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${bar.lat},${bar.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            tabIndex={on ? 0 : -1}
                            className="bg-ink px-4 py-2 text-[13px] text-ivory transition-colors hover:bg-oxblood"
                          >
                            Directions
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {!b && now && (
            <p className="mt-5 text-[13px] text-ink/50">
              It&apos;s {now.label} in Lahore. {bars.filter((x) => barStatus(x, now).open).length} of 3 bars are open.
            </p>
          )}
        </div>
      </div>
      <span className="sr-only">Map data © OpenStreetMap contributors, tiles by OpenFreeMap. Pins: {bars.map((x) => x.name).join(", ")}.</span>
    </section>
  );
}
