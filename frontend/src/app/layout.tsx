import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { TopNav } from "@/components/layout/top-nav";
import { SpotlightProvider } from "@/components/spotlight/spotlight-provider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pegasus",
  description: "PM-Tool mit KI-Agenten",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <div className="flex h-screen flex-col">
          <TopNav />
          <main className="flex-1 overflow-hidden">{children}</main>
          <SpotlightProvider />
        </div>
      </body>
    </html>
  );
}
