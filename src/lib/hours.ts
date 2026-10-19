import type { Bar } from "./data";

export type KarachiNow = { day: number; minutes: number; label: string };

export function karachiNow(date = new Date()): KarachiNow {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const h = Number(get("hour"));
  const m = Number(get("minute"));
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return { day: days.indexOf(get("weekday")), minutes: h * 60 + m, label };
}

export type BarStatus = { open: boolean; text: string };

const fmt = (mins: number) => {
  const m = ((mins % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  if (h24 === 0 && mm === 0) return "midnight";
  const h = h24 % 12 || 12;
  return `${h}${mm ? `:${String(mm).padStart(2, "0")}` : ""} ${h24 < 12 ? "am" : "pm"}`;
};

export function barStatus(bar: Bar, now: KarachiNow): BarStatus {
  const prevDay = (now.day + 6) % 7;
  // Today's shift, or the tail of yesterday's late shift after midnight.
  const todayOpen = bar.closedOn !== now.day && now.minutes >= bar.open && now.minutes < bar.close;
  const lateTail = bar.close > 1440 && bar.closedOn !== prevDay && now.minutes < bar.close - 1440;
  if (todayOpen || lateTail) {
    const closesAt = lateTail ? bar.close - 1440 : bar.close;
    const left = closesAt - now.minutes;
    return { open: true, text: left <= 60 ? `Closing soon, at ${fmt(closesAt)}` : `Open until ${fmt(closesAt)}` };
  }
  if (bar.closedOn === now.day) return { open: false, text: `Closed today, opens tomorrow ${fmt(bar.open)}` };
  if (now.minutes < bar.open) return { open: false, text: `Opens at ${fmt(bar.open)}` };
  return { open: false, text: `Opens tomorrow ${fmt(bar.open)}` };
}
