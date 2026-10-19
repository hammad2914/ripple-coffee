"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import Bean3D, { type BeanState } from "./Bean3D";
import { chapters } from "@/lib/data";
import { gsap, ScrollTrigger, useGSAP, prefersReducedMotion } from "@/lib/gsap";

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Scroll turns one 3D bean from cherry to roasted, in front of photographs of each stage. */
export default function Journey() {
  const root = useRef<HTMLElement>(null);
  const bean = useRef<BeanState>({ x: 0, roast: 0, pop: 0 });
  const [step, setStep] = useState(0);
  const stepRef = useRef(0);

  useGSAP(
    () => {
      const n = chapters.length;
      ScrollTrigger.create({
        trigger: root.current,
        start: "top top",
        end: () => `+=${window.innerHeight * (n - 0.5)}`,
        pin: true,
        scrub: 0.6,
        onUpdate: (self) => {
          // Hold on each chapter, then blend into the next across the last 40% of it.
          const x = self.progress * (n - 1);
          const i = Math.min(n - 2, Math.floor(x));
          const f = smooth(gsap.utils.clamp(0, 1, (x - i - 0.6) / 0.4));
          const a = chapters[i].bean;
          const b = chapters[i + 1].bean;
          bean.current.x = x;
          bean.current.roast = gsap.utils.interpolate(a.roast, b.roast, f);
          bean.current.pop = Math.max(0, 1 - Math.abs(x - 2.9) * 3);
          gsap.set("[data-fill]", { scaleX: self.progress });
          // Switch copy and photo halfway through the blend into the next chapter.
          const s = Math.min(n - 1, Math.floor(x + 0.2));
          if (s !== stepRef.current) {
            stepRef.current = s;
            setStep(s);
          }
        },
      });
    },
    { scope: root },
  );

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.fromTo("[data-copy] > *", { y: 22, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, stagger: 0.07, ease: "expo.out" });
    },
    { scope: root, dependencies: [step] },
  );

  const c = chapters[step];

  return (
    <section ref={root} id="journey" className="relative h-svh overflow-hidden bg-ink text-ivory">
      {/* Photographs, crossfading with a slow push-in */}
      {chapters.map((ch, i) => (
        <div
          key={ch.img}
          className={`absolute inset-0 transition-opacity duration-[1400ms] ease-out ${i === step ? "opacity-100" : "opacity-0"}`}
          aria-hidden={i !== step}
        >
          <Image
            src={ch.img}
            alt=""
            fill
            sizes="100vw"
            priority={i === 0}
            className={`object-cover transition-transform duration-[6000ms] ease-out ${i === step ? "scale-105" : "scale-115"}`}
          />
        </div>
      ))}
      <div className="absolute inset-0 bg-gradient-to-r from-[#120e0b]/90 via-[#120e0b]/55 to-[#120e0b]/25" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#120e0b]/70 via-transparent to-transparent" />

      <div className="gutter relative grid h-full grid-rows-[1fr_auto] pb-8 pt-24 md:pt-20">
        <div className="grid items-center gap-6 md:grid-cols-[0.9fr_1.1fr]">
          <div data-copy className="order-2 md:order-1">
            <p className="text-[12px] text-ivory/60">
              The roast, start to finish · {String(step + 1).padStart(2, "0")} / {String(chapters.length).padStart(2, "0")}
            </p>
            <h2 className="display mt-5 text-[clamp(2.4rem,4.8vw,4.6rem)]">{c.title}</h2>
            <p className="mt-5 max-w-md text-[16px] leading-[1.7] text-ivory/75">{c.body}</p>
            <div className="mt-7 flex flex-wrap gap-x-8 gap-y-2 text-[14px]">
              {c.facts.map((f) => (
                <span key={f} className="border-t border-ivory/30 pt-2">
                  {f}
                </span>
              ))}
            </div>
          </div>
          <div className="relative order-1 mx-auto aspect-square w-[min(100%,62svh)] md:order-2">
            {/* Canvas overhangs the frame so smoke and chaff can drift past it */}
            <div className="absolute -inset-[35%]">
              <Bean3D state={bean} spread={1.7} />
            </div>
          </div>
        </div>

        <div>
          <div className="relative h-px bg-ivory/20">
            <div data-fill className="absolute inset-0 origin-left scale-x-0 bg-ivory" />
          </div>
          <ol className="mt-3 grid grid-cols-5 text-[12px] text-ivory/45">
            {["Cherry", "Green", "Yellowing", "First crack", "Roasted"].map((l, i) => (
              <li key={l} className={`transition-colors duration-500 ${i <= step ? "text-ivory" : ""} ${i === 4 ? "text-right" : i > 0 ? "text-center" : ""}`}>
                {l}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
