import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { connection } from "next/server";
import { Shell } from "@/components/shell";
import { countSampleTrainees } from "@/lib/data";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Crew Training Tracker",
    template: "%s · Crew Training Tracker",
  },
  description: "Individual training schedules for crew across 10 restaurants.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  await connection();
  const sampleCount = await countSampleTrainees();
  return (
    <html lang="en" className={`${fraunces.variable} ${sourceSans.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Shell sampleCount={sampleCount}>{children}</Shell>
      </body>
    </html>
  );
}
