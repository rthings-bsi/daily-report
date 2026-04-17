import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SPINDO Warehouse | Daily Report System",
  description: "Advanced Warehouse Inventory Movement Reporting System for SPINDO",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${inter.variable} ${outfit.variable} antialiased`}>
      <body className="min-h-screen bg-slate-50 font-sans">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
