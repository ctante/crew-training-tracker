import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
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
    default: "Individual Training System (ITS)",
    template: "%s · Individual Training System (ITS)",
  },
  description: "Individual Training System (ITS) for crew across 10 restaurants.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const beta = process.env.NEXT_PUBLIC_BETA === "1";
  return (
    <html lang="en" className={`${fraunces.variable} ${sourceSans.variable} h-full antialiased`}>
      <body className="min-h-full">
        {beta ? (
          <div className="sticky top-0 z-50 bg-brick px-4 py-2 text-center text-sm font-bold tracking-wide text-white print:hidden">
            BETA / TEST SITE. Changes here do not affect the live restaurants. The live site is mcd-its.vercel.app.
          </div>
        ) : null}
        {children}
      </body>
    </html>
  );
}
