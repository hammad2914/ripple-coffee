"use client";

import { useRef, useState } from "react";
import Glass3D from "./Glass3D";
import { drinks, formatPKR } from "@/lib/data";
import { gsap, useGSAP } from "@/lib/gsap";

const groups = [
  { kind: "Hot" as const, label: "Hot, in double-walled glass" },
  { kind: "Cold" as const, label: "Cold, over clear ice" },
];

/** Pick a drink: the glass drains and pours its recipe, with every amount drawn on. */
export default function Menu() {
  const root = useRef<HTMLElement>(null);
  const [sel, setSel] = useState(0);

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
    },
    { scope: root },
  );

  return (
    <section ref={root} id="menu" className="gutter py-28 md:py-36">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <h2 data-menu-in className="display text-[clamp(2.6rem,5.4vw,5.4rem)]">
          What&apos;s in <span className="text-oxblood">the glass.</span>
        </h2>
        <p data-menu-in className="max-w-sm text-[15px] leading-[1.7] text-ink-soft">
          Every recipe, measured. Oat or almond milk on request. Prices include tax.
        </p>
      </div>

      <div className="mt-14 grid gap-12 md:mt-20 md:grid-cols-[0.95fr_1.05fr] md:items-start">
        <div>
          {groups.map((g) => (
            <div key={g.kind} data-menu-in className="mb-10 last:mb-0">
              <p className="label mb-3">{g.label}</p>
              <ul>
                {drinks.map((d, i) =>
                  d.kind !== g.kind ? null : (
                    <li key={d.id} className="border-t border-ink/12 last:border-b">
                      <button
                        type="button"
                        onClick={() => setSel(i)}
                        aria-pressed={sel === i}
                        className="group grid w-full grid-cols-[1fr_auto] items-baseline gap-4 py-4 text-left"
                      >
                        <span>
                          <span
                            className={`display block text-[clamp(1.4rem,2.1vw,1.9rem)] tracking-[-0.035em] transition-colors ${
                              sel === i ? "text-oxblood" : "group-hover:text-oxblood"
                            }`}
                          >
                            {d.id}
                          </span>
                          <span className="mt-1 block text-[13.5px] text-ink/55">{d.note}</span>
                        </span>
                        <span className="text-[14px] tabular-nums text-ink/70">{formatPKR(d.price)}</span>
                      </button>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className="order-first md:order-none md:sticky md:top-24">
          <div className="relative h-[54svh] w-full md:h-[min(76svh,640px)]">
            <Glass3D recipe={drinks[sel]} />
          </div>
          <p className="label mt-2 text-center">
            {drinks[sel].id} · {drinks[sel].layers.reduce((s, l) => s + l.ml, 0)} ml
          </p>
        </div>
      </div>
    </section>
  );
}
