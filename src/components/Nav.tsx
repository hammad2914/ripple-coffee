"use client";

import { useRef, useState } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";

const links = [
  { href: "#menu", label: "Menu" },
  { href: "#journey", label: "The roast" },
  { href: "#beans", label: "Beans" },
  { href: "#locations", label: "Bars" },
];

export default function Nav() {
  const root = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useGSAP(
    () => {
      gsap.from(root.current, { yPercent: -100, duration: 1.1, ease: "expo.out", delay: 0.2 });
      // Based on scroll position, not a start/end window, so it stays on at the very bottom too
      ScrollTrigger.create({ start: 0, end: "max", onUpdate: (s) => setScrolled(s.scroll() > 40) });
    },
    { scope: root },
  );

  return (
    <header
      ref={root}
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow] duration-500 ${
        scrolled ? "bg-ivory/85 shadow-[0_1px_0_rgba(27,25,22,0.08)] backdrop-blur-lg" : ""
      }`}
    >
      <div className="gutter relative flex h-16 items-center justify-between">
        <nav className="flex gap-7 text-[13px]" aria-label="Main">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="hidden text-ink/70 transition-colors hover:text-ink sm:inline">
              {l.label}
            </a>
          ))}
        </nav>
        <a href="#top" className="display absolute left-1/2 -translate-x-1/2 text-[17px] font-semibold tracking-[0.32em]" aria-label="Ripple Coffee Co., back to top">
          RIPPLE
        </a>
        <a href="#locations" className="bg-ink px-4 py-2 text-[13px] text-ivory transition-colors hover:bg-oxblood">
          Find a bar
        </a>
      </div>
    </header>
  );
}
