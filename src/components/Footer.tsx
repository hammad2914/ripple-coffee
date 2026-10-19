"use client";

import { useEffect, useRef, useState } from "react";
import { bars, brand } from "@/lib/data";
import { barStatus, karachiNow, type KarachiNow } from "@/lib/hours";
import BeanSpill from "./BeanSpill";

const explore = [
  { href: "#menu", label: "Menu" },
  { href: "#journey", label: "The roast" },
  { href: "#beans", label: "Beans" },
  { href: "#gallery", label: "Gallery" },
  { href: "#locations", label: "Map" },
];

const clock = (m: number) => {
  const mm = ((m % 1440) + 1440) % 1440;
  const h = Math.floor(mm / 60);
  if (h === 0 && mm % 60 === 0) return "midnight";
  return `${h % 12 || 12}${mm % 60 ? `:${String(mm % 60).padStart(2, "0")}` : ""} ${h < 12 ? "am" : "pm"}`;
};

/** One sentence about right now in Lahore: who's open, and who closes first. */
function liveLine(now: KarachiNow) {
  const open = bars.filter((b) => barStatus(b, now).open);
  if (open.length === 0) {
    const first = [...bars].sort((a, b) => a.open - b.open)[0];
    return `All three bars are closed. First shot at ${clock(first.open)} on ${first.name}.`;
  }
  // Closing times on tonight's clock (after midnight runs past 1440)
  const t = now.minutes < 6 * 60 ? now.minutes + 1440 : now.minutes;
  const byClose = [...open].sort((a, b) => a.close - b.close);
  const last = byClose[byClose.length - 1];
  const first = byClose[0];
  if (open.length === 1) return `It's ${now.label} here. Only ${last.name} is still pouring, until ${clock(last.close)}.`;
  const soon = first.close - t <= 90 ? ` ${first.name} closes first, at ${clock(first.close)}.` : "";
  return `It's ${now.label} here. ${open.length === bars.length ? "All three bars are" : `${open.length} bars are`} open, ${last.name} until ${clock(last.close)}.${soon}`;
}


export default function Footer() {
  const root = useRef<HTMLElement>(null);
  const [now, setNow] = useState<KarachiNow | null>(null);
  const [email, setEmail] = useState("");

  useEffect(() => {
    const tick = () => setNow(karachiNow());
    const first = requestAnimationFrame(tick);
    const id = setInterval(tick, 30_000);
    return () => {
      cancelAnimationFrame(first);
      clearInterval(id);
    };
  }, []);

  const showBar = (i: number) => {
    const target = document.getElementById("locations");
    if (target) {
      if (window.__lenis) window.__lenis.scrollTo(target, { duration: 1.4 });
      else target.scrollIntoView({ behavior: "smooth" });
    }
    window.dispatchEvent(new CustomEvent("ripple:show-bar", { detail: i }));
  };

  const validEmail = /\S+@\S+\.\S+/.test(email);

  return (
    <footer ref={root} className="relative overflow-hidden bg-ink text-ivory">
      <BeanSpill />

      <div className="gutter relative pb-10 pt-24 md:pt-32">
        <h2 className="display text-[clamp(2.8rem,6vw,6rem)]">
          See you at <span className="text-[#c98b80]">the bar.</span>
        </h2>
        <p className="mt-6 min-h-[1.7em] max-w-2xl text-[17px] leading-[1.6] text-ivory/70" aria-live="polite">
          {now ? liveLine(now) : " "}
        </p>

        <div className="mt-16 grid gap-12 border-t border-ivory/12 pt-12 md:mt-24 md:grid-cols-[1.2fr_0.7fr_0.9fr_1.3fr] md:gap-10">
          <div>
            <p className="text-[12px] text-ivory/40">Bars</p>
            <ul className="mt-4 space-y-4">
              {bars.map((b, i) => {
                const s = now ? barStatus(b, now) : null;
                return (
                  <li key={b.id}>
                    <button type="button" onClick={() => showBar(i)} className="group text-left">
                      <span className="flex items-center gap-2.5 text-[15px]">
                        <span className={`size-1.5 rounded-full ${s?.open ? "bg-[#7fcf95]" : "bg-ivory/30"}`} />
                        <span className="transition-colors group-hover:text-[#c98b80]">{b.name}</span>
                        <span className="text-ivory/30 transition-transform duration-500 group-hover:translate-x-1">→</span>
                      </span>
                      <span className="mt-0.5 block pl-4 text-[13px] text-ivory/45">
                        {b.area} · {b.hoursLabel}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <p className="text-[12px] text-ivory/40">Explore</p>
            <ul className="mt-4 space-y-2.5 text-[15px]">
              {explore.map((x) => (
                <li key={x.href}>
                  <a href={x.href} className="text-ivory/80 transition-colors hover:text-ivory">
                    {x.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[12px] text-ivory/40">Say hello</p>
            <ul className="mt-4 space-y-2.5 text-[15px]">
              <li>
                <a href={`mailto:${brand.email}`} className="u-link">
                  {brand.email}
                </a>
              </li>
              <li>
                <a href={brand.instagram} target="_blank" rel="noreferrer" className="text-ivory/80 hover:text-ivory">
                  Instagram {brand.handle}
                </a>
              </li>
              <li>
                <a href={`mailto:${brand.email}?subject=${encodeURIComponent("Wholesale enquiry")}`} className="text-ivory/80 hover:text-ivory">
                  Beans for your café or office
                </a>
              </li>
            </ul>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!validEmail) return;
              const body = `Please add ${email} to Roast notes.`;
              window.location.href = `mailto:${brand.email}?subject=${encodeURIComponent("Roast notes")}&body=${encodeURIComponent(body)}`;
            }}
          >
            <p className="text-[12px] text-ivory/40">Roast notes</p>
            <p className="mt-4 max-w-xs text-[15px] leading-[1.6] text-ivory/75">Once a month: new origins, cupping dates, nothing else.</p>
            <div className="mt-5 flex max-w-sm border border-ivory/20 focus-within:border-ivory/60">
              <label htmlFor="roast-notes" className="sr-only">
                Email address
              </label>
              <input
                id="roast-notes"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-12 min-w-0 flex-1 bg-transparent px-4 text-[15px] text-ivory outline-none placeholder:text-ivory/30"
              />
              <button type="submit" disabled={!validEmail} className="bg-ivory px-5 text-[14px] text-ink transition-opacity disabled:opacity-40">
                Join
              </button>
            </div>
            <p className="mt-2 text-[12px] text-ivory/35">Opens your email app with the request written.</p>
          </form>
        </div>

        <div className="mt-20 flex flex-col gap-3 border-t border-ivory/12 pt-6 text-[12.5px] text-ivory/40 md:flex-row md:items-center md:justify-between">
          <p>
            <span className="display mr-3 text-[14px] font-semibold tracking-[0.3em] text-ivory/80">RIPPLE</span>© 2026 {brand.name}, Lahore
          </p>
          <p>Concept site · photos from Unsplash · map © OpenStreetMap</p>
          <a href="#top" className="text-ivory/70 transition-colors hover:text-ivory">
            Back to top ↑
          </a>
        </div>
      </div>
    </footer>
  );
}
