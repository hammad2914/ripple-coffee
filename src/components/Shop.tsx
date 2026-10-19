"use client";

import { useEffect, useRef, useState } from "react";
import Bag3D from "./Bag3D";
import { bars, brand, formatPKR, grinds, lastRoastDay, shopBeans } from "@/lib/data";
import { gsap, useGSAP, prefersReducedMotion } from "@/lib/gsap";

export default function Shop() {
  const root = useRef<HTMLElement>(null);
  const [sel, setSel] = useState(0);
  const [grind, setGrind] = useState(3);
  const [pickup, setPickup] = useState(0);
  const [qty, setQty] = useState(1);
  const [roasted, setRoasted] = useState("");

  // The roast date depends on today's date in Lahore, so it's set after mount
  useEffect(() => {
    const id = requestAnimationFrame(() => setRoasted(lastRoastDay()));
    return () => cancelAnimationFrame(id);
  }, []);

  useGSAP(
    () => {
      gsap.from("[data-shop-in]", {
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

  // Details rise in again whenever the origin changes
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.fromTo("[data-detail] > *", { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7, stagger: 0.05, ease: "expo.out" });
    },
    { scope: root, dependencies: [sel] },
  );

  const b = shopBeans[sel];
  const g = grinds[grind];
  const bar = bars[pickup];
  const subject = `Pickup order: ${qty} × ${b.origin} 250 g (${g.label})`;
  const body = `Hi Ripple,\n\nI'd like to order ${qty} × ${b.origin} 250 g, ${g.id === "whole" ? "whole bean" : `ground for ${g.label}`}, for pickup at ${bar.name} (${bar.area}).\n\nTotal: ${formatPKR(b.price * qty)}\n\nThank you.`;

  return (
    <section ref={root} id="beans" className="gutter py-28 md:py-36">
      <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
        <h2 data-shop-in className="display text-[clamp(2.6rem,5.4vw,5.4rem)]">
          Take it <span className="text-oxblood">home.</span>
        </h2>
        <p data-shop-in className="max-w-sm text-[15px] leading-[1.7] text-ink-soft">
          Roasted on Tuesdays and Fridays, bagged the same afternoon. Ground to order for whatever you brew with.
        </p>
      </div>

      <div className="mt-12 grid items-center gap-10 md:mt-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div data-shop-in className="relative mx-auto aspect-square w-full max-w-[620px]">
          <Bag3D bean={b} roasted={roasted} />
          <p className="label pointer-events-none absolute bottom-2 left-0 right-0 text-center">Drag to turn the bag</p>
        </div>

        <div data-shop-in>
          <div role="tablist" aria-label="Origins" className="flex gap-2">
            {shopBeans.map((x, i) => (
              <button
                key={x.id}
                type="button"
                role="tab"
                aria-selected={sel === i}
                onClick={() => setSel(i)}
                className={`px-4 py-2.5 text-[14px] transition-colors ${sel === i ? "bg-ink text-ivory" : "border border-ink/15 hover:border-ink/50"}`}
              >
                {x.origin}
              </button>
            ))}
          </div>

          <div data-detail className="mt-8">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="display text-[clamp(2.2rem,3.6vw,3.2rem)]">{b.origin}</h3>
              <p className="display text-[22px] tabular-nums tracking-[-0.03em]">
                {formatPKR(b.price)} <span className="text-[14px] font-normal tracking-normal text-ink/50">/ 250 g</span>
              </p>
            </div>
            <p className="mt-2 text-[14px] text-ink/60">
              {b.region} · {b.process} · {b.altitude}
            </p>
            <p className="mt-5 text-[17px]">{b.notes.join(", ")}.</p>

            <div className="mt-6 max-w-sm">
              <div className="flex justify-between text-[12px] text-ink/50">
                <span>Light</span>
                <span className="text-ink">{b.roastLabel} roast</span>
                <span>Dark</span>
              </div>
              <div className="relative mt-2 h-1.5 bg-gradient-to-r from-[#c9b06a] via-[#94592b] to-[#2e180b]">
                <span className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ivory bg-ink transition-[left] duration-700" style={{ left: `${b.roast * 100}%` }} />
              </div>
            </div>
            {roasted && <p className="mt-5 text-[13px] text-ink/55">This week&apos;s bags were roasted {roasted}.</p>}
          </div>

          <div className="mt-9 border-t border-ink/12 pt-7">
            <p className="text-[12px] text-ink/50">Grind it for</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {grinds.map((x, i) => (
                <button
                  key={x.id}
                  type="button"
                  aria-pressed={grind === i}
                  onClick={() => setGrind(i)}
                  className={`px-3.5 py-2 text-[13.5px] transition-colors ${grind === i ? "bg-oxblood text-ivory" : "bg-ink/[0.05] hover:bg-ink/10"}`}
                >
                  {x.label}
                </button>
              ))}
            </div>
            <p className="mt-4 text-[14.5px]">{g.size}</p>
            <p className="mt-1 text-[13.5px] text-ink/55">{g.recipe}</p>
          </div>

          <div className="mt-8 border-t border-ink/12 pt-7">
            <div className="flex flex-wrap items-end gap-x-8 gap-y-5">
              <div>
                <p className="text-[12px] text-ink/50">Pick up at</p>
                <select
                  value={pickup}
                  onChange={(e) => setPickup(Number(e.target.value))}
                  className="mt-2 h-11 border border-ink/15 bg-transparent px-3 pr-8 text-[14px] outline-none focus:border-ink/60"
                >
                  {bars.map((x, i) => (
                    <option key={x.id} value={i}>
                      {x.name}, {x.area}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-[12px] text-ink/50">Bags</p>
                <div className="mt-2 flex h-11 items-center border border-ink/15">
                  <button type="button" aria-label="One fewer bag" onClick={() => setQty((q) => Math.max(1, q - 1))} className="size-11 hover:bg-ink/5">
                    −
                  </button>
                  <span className="w-8 text-center tabular-nums">{qty}</span>
                  <button type="button" aria-label="One more bag" onClick={() => setQty((q) => Math.min(9, q + 1))} className="size-11 hover:bg-ink/5">
                    +
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              <a
                href={`mailto:${brand.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
                className="bg-ink px-7 py-4 text-[14px] text-ivory transition-colors hover:bg-oxblood"
              >
                Order for pickup · {formatPKR(b.price * qty)}
              </a>
              <p className="max-w-[16rem] text-[12.5px] leading-[1.6] text-ink/50">Opens your email with the order written. Ready the same day.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
