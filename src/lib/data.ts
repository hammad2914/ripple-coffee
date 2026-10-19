import type { Recipe } from "@/components/Glass3D";

export const brand = {
  name: "Ripple Coffee Co.",
  handle: "@ripple.lahore",
  instagram: "https://instagram.com",
  email: "hello@ripple.coffee",
};

export type Drink = Recipe & { price: number; note: string; kind: "Hot" | "Cold" };

export const drinks: Drink[] = [
  {
    id: "Flat white",
    kind: "Hot",
    price: 950,
    note: "Ristretto double, silky microfoam.",
    layers: [
      { name: "Espresso", ml: 36, color: "#3b1c0e" },
      { name: "Steamed milk", ml: 110, color: "#e7d8c2" },
      { name: "Microfoam", ml: 14, color: "#f6efe4", foam: true },
    ],
  },
  {
    id: "Cortado",
    kind: "Hot",
    price: 850,
    note: "Equal parts espresso and warm milk.",
    layers: [
      { name: "Espresso", ml: 36, color: "#3b1c0e" },
      { name: "Warm milk", ml: 40, color: "#e2d0b6" },
      { name: "Foam", ml: 8, color: "#f6efe4", foam: true },
    ],
  },
  {
    id: "Cappuccino",
    kind: "Hot",
    price: 950,
    note: "A proper third of each.",
    layers: [
      { name: "Espresso", ml: 36, color: "#3b1c0e" },
      { name: "Steamed milk", ml: 60, color: "#e7d8c2" },
      { name: "Foam", ml: 60, color: "#f8f2e9", foam: true },
    ],
  },
  {
    id: "Mocha",
    kind: "Hot",
    price: 1100,
    note: "Dark chocolate, espresso, steamed milk.",
    layers: [
      { name: "Chocolate", ml: 25, color: "#4a2318" },
      { name: "Espresso", ml: 36, color: "#3b1c0e" },
      { name: "Steamed milk", ml: 100, color: "#d8c1a4" },
      { name: "Foam", ml: 14, color: "#f6efe4", foam: true },
    ],
  },
  {
    id: "Iced Spanish latte",
    kind: "Cold",
    price: 1150,
    note: "Condensed milk, cold milk, a shot on top.",
    ice: true,
    layers: [
      { name: "Condensed milk", ml: 30, color: "#e1c596" },
      { name: "Cold milk", ml: 160, color: "#f0e6d7" },
      { name: "Espresso", ml: 36, color: "#4a2412" },
    ],
  },
  {
    id: "Iced latte",
    kind: "Cold",
    price: 1050,
    note: "Double shot over cold milk and clear ice.",
    ice: true,
    layers: [
      { name: "Cold milk", ml: 180, color: "#f0e6d7" },
      { name: "Espresso", ml: 36, color: "#4a2412" },
    ],
  },
  {
    id: "Cold brew",
    kind: "Cold",
    price: 1050,
    note: "Eighteen hours, Sidama, over clear ice.",
    ice: true,
    layers: [{ name: "Cold brew", ml: 220, color: "#3e1d0c" }],
  },
  {
    id: "Espresso tonic",
    kind: "Cold",
    price: 1150,
    note: "Tonic, orange peel, a shot floated on top.",
    ice: true,
    layers: [
      { name: "Tonic water", ml: 170, color: "#e4ebe9" },
      { name: "Espresso", ml: 36, color: "#5a2b12" },
    ],
  },
];

/** The journey: one seed, five states. Bean values drive the WebGL bean; the copy is what happens at each stop. */
export const chapters = [
  {
    title: "It starts as fruit.",
    body: "Ripe cherries, picked by hand in Bensa, Sidama. Only the deep-red ones; the rest stay on the tree another week.",
    facts: ["2,100 m above sea level", "Picked in December"],
    bean: { shape: 0, roast: 0 },
    img: "photo-1762277142767-6e614520de15",
  },
  {
    title: "Washed, dried, rested.",
    body: "The fruit comes off. What's left is a pale green seed, dried for eighteen days on raised beds, then shipped to Lahore.",
    facts: ["18 days on the beds", "11% moisture"],
    bean: { shape: 1, roast: 0 },
    img: "photo-1703646619157-eb553d16d402",
  },
  {
    title: "Minute five: it yellows.",
    body: "In our 12 kg drum the bean loses its water, turns gold and smells of fresh bread. Nothing is coffee yet.",
    facts: ["150 °C", "Drying phase"],
    bean: { shape: 1, roast: 0.27 },
    img: "photo-1511537190424-bbbab87ac5eb",
  },
  {
    title: "Minute nine: first crack.",
    body: "It pops like popcorn. The sugars caramelise and the flavour you'll taste is decided in the next ninety seconds.",
    facts: ["196 °C", "Maillard + caramel"],
    bean: { shape: 1, roast: 0.62 },
    img: "photo-1607681034540-2c46cc71896d",
  },
  {
    title: "Dropped at 218 °C.",
    body: "Cooled in four minutes, rested for a week, then ground to order. Every bag is dated; we don't sell anything older than a month.",
    facts: ["11 minutes total", "Rested 7 days"],
    bean: { shape: 1, roast: 0.9 },
    img: "photo-1497935586351-b67a49e012bf",
  },
];

export type Bar = {
  id: string;
  name: string;
  area: string;
  address: string;
  open: number; // minutes after midnight, Lahore time
  close: number;
  closedOn?: number;
  hoursLabel: string;
  img: string;
  note: string;
  good: string[];
  lng: number;
  lat: number;
};

export const bars: Bar[] = [
  {
    id: "mm-alam",
    name: "M.M. Alam",
    area: "Gulberg III",
    address: "M.M. Alam Road, Gulberg III, Lahore",
    open: 8 * 60,
    close: 25 * 60,
    hoursLabel: "8 am – 1 am",
    img: "photo-1521017432531-fbd92d768814",
    note: "The flagship. Slow bar, forty seats and the Saturday cupping at eleven.",
    good: ["Slow bar", "Late nights", "Valet parking"],
    lng: 74.3503,
    lat: 31.5138,
  },
  {
    id: "y-block",
    name: "Y-Block",
    area: "DHA Phase 3",
    address: "Y-Block Commercial, DHA Phase 3, Lahore",
    open: 8 * 60,
    close: 24 * 60,
    hoursLabel: "8 am – midnight",
    img: "photo-1565650839149-2c48a094196c",
    note: "Our bakery bar. Croissants out of the oven at nine, big tables for working.",
    good: ["Bakery", "Wi-Fi + sockets", "Quiet mornings"],
    lng: 74.3781,
    lat: 31.4746,
  },
  {
    id: "gulberg",
    name: "Main Boulevard",
    area: "Gulberg II",
    address: "Main Boulevard, Gulberg II, Lahore",
    open: 7 * 60 + 30,
    close: 23 * 60,
    hoursLabel: "7:30 am – 11 pm",
    img: "photo-1453614512568-c4024d13c247",
    note: "The quick one. Standing bar, order-ahead pickup and the earliest first shot in town.",
    good: ["Takeaway", "Order ahead", "Opens 7:30"],
    lng: 74.3449,
    lat: 31.5226,
  },
];

/** A day at the bar, as photographed. */
export const day = [
  { time: "07:30", caption: "First shots pulled, dialled in against the morning humidity.", img: "photo-1507914372368-b2b085b925a1" },
  { time: "09:00", caption: "Croissants out of the oven at Y-Block.", img: "photo-1542372147193-a7aca54189cd" },
  { time: "13:00", caption: "Lunch rush. Six baristas, one rhythm.", img: "photo-1517701848373-805868efd0ac" },
  { time: "17:30", caption: "The slow bar opens. Pour-overs, one cup at a time.", img: "photo-1532713107108-dfb5d8d2fc42" },
  { time: "23:40", caption: "Still pouring on M.M. Alam.", img: "photo-1545418314-7ce0b9b53901" },
];

export const formatPKR = (n: number) => `Rs ${n.toLocaleString("en-PK")}`;

export type ShopBean = {
  id: string;
  origin: string;
  region: string;
  process: string;
  altitude: string;
  notes: string[];
  roast: number; // 0 light → 1 dark
  roastLabel: string;
  price: number;
  label: string; // label paper colour
  ink: string; // label print colour
};

export const shopBeans: ShopBean[] = [
  {
    id: "sidama",
    origin: "Sidama",
    region: "Bensa, Ethiopia",
    process: "Washed",
    altitude: "2,100 m",
    notes: ["Jasmine", "Bergamot", "White peach"],
    roast: 0.22,
    roastLabel: "Light",
    price: 3400,
    label: "#efe2d2",
    ink: "#7a2f22",
  },
  {
    id: "huila",
    origin: "Huila",
    region: "Pitalito, Colombia",
    process: "Washed",
    altitude: "1,750 m",
    notes: ["Red apple", "Panela", "Cocoa"],
    roast: 0.48,
    roastLabel: "Medium-light",
    price: 3100,
    label: "#dfe2d4",
    ink: "#34452f",
  },
  {
    id: "house",
    origin: "House",
    region: "Cerrado, Brazil + Huila",
    process: "Natural & washed",
    altitude: "1,100–1,750 m",
    notes: ["Dark chocolate", "Hazelnut", "Caramel"],
    roast: 0.7,
    roastLabel: "Medium",
    price: 2600,
    label: "#6e1e1e",
    ink: "#f3eee5",
  },
];

export const grinds = [
  { id: "espresso", label: "Espresso", size: "Fine, like powdered sugar.", recipe: "18 g in, 36 g out, about 28 seconds." },
  { id: "v60", label: "V60", size: "Medium-fine, like sea salt.", recipe: "15 g to 250 g water at 93 °C, three minutes." },
  { id: "press", label: "French press", size: "Coarse, like breadcrumbs.", recipe: "30 g to 500 g water, four minutes, then press." },
  { id: "whole", label: "Whole bean", size: "Left whole. Grind just before you brew.", recipe: "Keeps four weeks in the sealed bag." },
];

/** Most recent roast day (we roast Tuesdays and Fridays), in Lahore time. */
export function lastRoastDay(now = new Date()) {
  const tz = "Asia/Karachi";
  for (let back = 0; back < 7; back++) {
    const d = new Date(now.getTime() - back * 86_400_000);
    const wd = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short" }).format(d);
    if (wd === "Tue" || wd === "Fri") return new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short" }).format(d);
  }
  return "";
}

/** Photographs for the liquid strip. */
export const stripPhotos = [
  { id: "photo-1521017432531-fbd92d768814", caption: "Friday night at M.M. Alam" },
  { id: "photo-1507914372368-b2b085b925a1", caption: "First shots of the morning" },
  { id: "photo-1542372147193-a7aca54189cd", caption: "Flat white and a croissant, Y-Block" },
  { id: "photo-1517701848373-805868efd0ac", caption: "Steaming milk for the lunch rush" },
  { id: "photo-1532713107108-dfb5d8d2fc42", caption: "Pouring a rosetta" },
  { id: "photo-1545418314-7ce0b9b53901", caption: "The bar on Main Boulevard" },
  { id: "photo-1461023058943-07fcbe16d735", caption: "Iced latte, double shot" },
  { id: "photo-1565650839149-2c48a094196c", caption: "The quiet corner at Y-Block" },
  { id: "photo-1514066558159-fc8c737ef259", caption: "Microfoam, just right" },
  { id: "photo-1453614512568-c4024d13c247", caption: "Before the doors open" },
];

export const unsplash = (id: string, w: number) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=78`;
