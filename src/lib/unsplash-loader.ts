type LoaderArgs = { src: string; width: number; quality?: number };

export default function unsplashLoader({ src, width, quality }: LoaderArgs) {
  if (!src.startsWith("photo-")) return src;
  return `https://images.unsplash.com/${src}?auto=format&fit=crop&w=${width}&q=${quality ?? 72}`;
}
