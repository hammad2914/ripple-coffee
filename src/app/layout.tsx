import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import "./globals.css";

const display = Inter_Tight({ variable: "--font-inter-tight", subsets: ["latin"], weight: ["300", "400", "500", "600"] });
const sans = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ripple Coffee Co. · Specialty coffee in Lahore",
  description:
    "Single-origin espresso, a slow bar and a bakery at three addresses in Lahore: M.M. Alam Road, DHA Phase 6 and Gulberg III.",
  openGraph: {
    title: "Ripple Coffee Co.",
    description: "The art of the small cup. Specialty coffee in Lahore.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#F3EEE5",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
