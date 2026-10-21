"use client";

import { useRef } from "react";
import FluidLatte, { type FluidLatteHandle, type LatteTheme } from "./FluidLatte";
import { gsap, SplitText, useGSAP, prefersReducedMotion } from "@/lib/gsap";

const latteTheme: LatteTheme = { table: "transparent", ceramic: [0.975, 0.965, 0.945], shadow: 0.7 };

export default function Hero() {
  const root = useRef<HTMLElement>(null);
  const cup = useRef<FluidLatteHandle>(null);
  const cupBox = useRef<HTMLDivElement>(null);

  // Slide the finished cup away and a fresh, empty one in; the pour starts as it arrives.
  const pourAgain = () => {
    if (prefersReducedMotion()) return cup.current?.pour();
    gsap
      .timeline()
      .to(cupBox.current, { xPercent: 14, rotate: 8, autoAlpha: 0, duration: 0.45, ease: "power2.in" })
      .add(() => cup.current?.pour())
      .fromTo(cupBox.current, { xPercent: -14, rotate: -8 }, { xPercent: 0, rotate: 0, autoAlpha: 1, duration: 0.9, ease: "expo.out" });
  };

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const split = SplitText.create("[data-h1]", { type: "lines", mask: "lines" });
      gsap
        .timeline({ defaults: { ease: "expo.out" } })
        .from(split.lines, { yPercent: 110, duration: 1.3, stagger: 0.1 }, 0.15)
        .from("[data-in]", { y: 20, autoAlpha: 0, duration: 1.1, stagger: 0.08 }, 0.5)
        .from("[data-cup]", { scale: 0.9, rotate: -10, autoAlpha: 0, duration: 1.8, ease: "expo.out" }, 0);
      return () => split.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} id="top" className="gutter grid min-h-svh items-center gap-12 pb-16 pt-28 md:grid-cols-[1.1fr_0.9fr] md:gap-10">
      <div className="order-2 md:order-1">
        <p data-in className="label">
          Specialty coffee, Lahore
        </p>
        <h1 data-h1 className="display mt-6 text-[clamp(3.2rem,7.2vw,7.6rem)]">
          The art of the
          <br />
          <span className="text-oxblood">small cup.</span>
        </h1>
        <div data-in className="mt-10 h-px w-full max-w-md bg-ink/15" />
        <p data-in className="mt-6 max-w-md text-[16px] leading-[1.7] text-ink-soft">
          Single-origin espresso, a slow bar and a bakery at three addresses in Lahore. Every cup is weighed, timed and poured by
          hand.
        </p>
        <div data-in className="mt-9 flex flex-wrap gap-3 text-[14px]">
          <a href="#locations" className="bg-ink px-6 py-3.5 text-ivory transition-colors hover:bg-oxblood">
            Find a bar
          </a>
          <a href="#menu" className="border border-ink/20 px-6 py-3.5 transition-colors hover:border-ink">
            See the menu
          </a>
        </div>
      </div>

      <figure className="order-1 md:order-2">
        {/* The cup sits straight on the page; the canvas bleeds past its box so the saucer shadow never clips */}
        <div ref={cupBox} data-cup className="relative mx-auto aspect-square w-full max-w-[600px]">
          <div className="absolute -inset-[14%]">
            <FluidLatte ref={cup} theme={latteTheme} size={0.215} />
          </div>
        </div>
        <figcaption data-in className="label relative mx-auto mt-2 flex max-w-[600px] items-center justify-between">
          <span>Flat white, poured for you. Move across it to stir.</span>
          <button type="button" onClick={pourAgain} className="u-link text-ink/70 hover:text-ink">
            Pour again
          </button>
        </figcaption>
      </figure>
    </section>
  );
}
