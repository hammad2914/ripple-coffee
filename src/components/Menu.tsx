"use client";

import { useId, useRef, useState, useSyncExternalStore } from "react";
import Glass3D from "./Glass3D";
import { drinks, formatPKR, type Drink } from "@/lib/data";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";

const groups = [
  { kind: "Hot" as const, label: "Hot, in double-walled glass" },
  { kind: "Cold" as const, label: "Cold, over clear ice" },
];

// Wide screens get the glass in its own column between the lists; narrow ones open it under the tapped row.
const WIDE = "(min-width: 768px)";
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(WIDE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

const totalMl = (d: Drink) => d.layers.reduce((s, l) => s + l.ml, 0);

/** A small line drawing of the drink's glass with its layers filled in to scale. */
function GlassIcon({ d }: { d: Drink }) {
  const clip = useId();
  const cold = !!d.ice;
  // Inner liquid space: [left, right, top, bottom] and how many ml fill it to the top
  const [l, r, top, bot, cap] = cold ? [7.5, 20.5, 6, 36.5, 330] : [7.5, 20.5, 9, 35, 240];
  const layers = d.layers.reduce<{ y: number; hgt: number; color: string; key: string }[]>((acc, layer) => {
    const hgt = ((bot - top) * layer.ml) / cap;
    const y = (acc.length ? acc[acc.length - 1].y : bot) - hgt;
    return [...acc, { y, hgt, color: layer.color, key: layer.name }];
  }, []);
  const surface = layers[layers.length - 1].y;
  const bowl = `M${l} ${top} V${bot - 5} Q${l} ${bot} 14 ${bot} Q${r} ${bot} ${r} ${bot - 5} V${top}`;
  return (
    <svg viewBox="0 0 28 40" className="h-10 w-7 shrink-0 text-ink/45" aria-hidden>
      <defs>
        <clipPath id={clip}>{cold ? <rect x={l} y={top} width={r - l} height={bot - top} rx={0.8} /> : <path d={`${bowl} Z`} />}</clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        {layers.map((s) => (
          <rect key={s.key} x={l - 1} y={s.y} width={r - l + 2} height={s.hgt + 0.3} fill={s.color} />
        ))}
        {cold && (
          <g fill="none" stroke="rgb(255 255 255 / 0.7)" strokeWidth={0.8}>
            <rect x={9} y={surface + 1.5} width={5} height={5} rx={1} transform={`rotate(-8 11.5 ${surface + 4})`} />
            <rect x={14} y={surface + 5} width={5} height={5} rx={1} transform={`rotate(10 16.5 ${surface + 7.5})`} />
          </g>
        )}
      </g>
      {/* The glass: an outer wall, and for hot drinks the inner bowl of the double wall */}
      <g fill="none" stroke="currentColor" strokeWidth={1.1} strokeLinejoin="round">
        {cold ? <path d="M5.5 2 L6 37.5 Q6 39 7.5 39 H20.5 Q22 39 22 37.5 L22.5 2" /> : <path d="M4 2 L5.2 37 Q5.4 39 7.4 39 H20.6 Q22.6 39 22.8 37 L24 2" />}
        {!cold && <path d={bowl} opacity={0.55} />}
      </g>
    </svg>
  );
}

/**
 * Hot and cold side by side, as at Loop, with the glass between them. Hover a drink and the glass pours it,
 * every amount drawn on, labels on the side away from the list you're in.
 */
export default function Menu() {
  const root = useRef<HTMLElement>(null);
  const [sel, setSel] = useState(0);
  const [replay, setReplay] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const wide = useSyncExternalStore(subscribe, () => window.matchMedia(WIDE).matches, () => true);

  useGSAP(
    () => {
      gsap.from("[data-menu-in]", {
        y: 30,
        autoAlpha: 0,
        duration: 1.1,
        stagger: 0.06,
        ease: "expo.out",
        scrollTrigger: { trigger: root.current, start: "top 70%" },
      });
      // Pour the first drink as the menu arrives, so the glass doesn't just sit there full
      ScrollTrigger.create({ trigger: root.current, start: "top 55%", once: true, onEnter: () => setReplay((n) => n + 1) });
    },
    { scope: root },
  );

  const d = drinks[sel];
  const row = (drink: Drink, i: number) => {
    const on = wide ? sel === i : open === i;
    return (
      <li key={drink.id} className="border-t border-ink/12 last:border-b">
        <button
          type="button"
          aria-pressed={wide ? sel === i : undefined}
          aria-expanded={wide ? undefined : open === i}
          onPointerEnter={() => wide && setSel(i)}
          onFocus={() => wide && setSel(i)}
          onClick={() => {
            if (!wide) setOpen(open === i ? null : i);
            else if (sel === i) setReplay((n) => n + 1);
            else setSel(i);
          }}
          className="group grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 py-5 text-left"
        >
          <GlassIcon d={drink} />
          <span>
            <span
              className={`display block text-[clamp(1.3rem,1.7vw,1.65rem)] tracking-[-0.035em] transition-colors ${on ? "text-oxblood" : "group-hover:text-oxblood"}`}
            >
              {drink.id}
            </span>
            <span className="mt-1 block text-[13.5px] text-ink/55">{drink.note}</span>
          </span>
          <span className="text-[14px] tabular-nums text-ink/70">{formatPKR(drink.price)}</span>
        </button>
        {!wide && open === i && (
          <div className="pb-6">
            <div className="relative h-[52svh] w-full">
              <Glass3D recipe={drink} />
            </div>
            <p className="label mt-1 text-center">
              {drink.id} · {totalMl(drink)} ml
            </p>
          </div>
        )}
      </li>
    );
  };
  const list = (kind: "Hot" | "Cold", label: string) => (
    <div key={kind} data-menu-in>
      <p className="label mb-3">{label}</p>
      <ul>{drinks.map((drink, i) => (drink.kind === kind ? row(drink, i) : null))}</ul>
    </div>
  );

  return (
    <section ref={root} id="menu" className="gutter py-28 md:py-36">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <h2 data-menu-in className="display text-[clamp(2.6rem,5.4vw,5.4rem)]">
          What&apos;s in <span className="text-oxblood">the glass.</span>
        </h2>
        <p data-menu-in className="max-w-sm text-[15px] leading-[1.7] text-ink-soft">
          Every recipe, measured. {wide ? "Hover a drink to see it poured." : "Tap a drink to see it poured."} Oat or almond milk on request.
          Prices include tax.
        </p>
      </div>

      <div className="mt-14 grid gap-y-12 md:mt-20 md:grid-cols-[1fr_minmax(280px,0.8fr)_1fr] md:gap-x-8 lg:gap-x-12">
        {list(groups[0].kind, groups[0].label)}
        {wide && (
          <div data-menu-in className="relative">
            <div className="relative h-[440px] w-full">
              <Glass3D recipe={d} replay={replay} side={d.kind === "Hot" ? "right" : "left"} />
            </div>
            <p className="label mt-1 text-center">
              {d.id} · {totalMl(d)} ml · {formatPKR(d.price)}
            </p>
          </div>
        )}
        {list(groups[1].kind, groups[1].label)}
      </div>
    </section>
  );
}
