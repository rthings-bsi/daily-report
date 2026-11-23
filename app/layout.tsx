import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { SidebarProvider } from "@/components/SidebarContext";
import { SettingsProvider } from "@/components/SettingsProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import LayoutContent from "@/components/LayoutContent";
import ChatBot from "@/components/ChatBot";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SPINDO Warehouse | Daily Report System",
  description: "Advanced Warehouse Inventory Movement Reporting System for SPINDO",
  icons: {
    icon: "/icon.png",
  },
};

const themeInitScript = `
(function() {
  try {
    var saved = localStorage.getItem('spindo-neu-theme');
    var mode = (saved === 'dark' || saved === 'light')
      ? saved
      : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = mode;
    if (mode === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${plusJakarta.variable} ${robotoMono.variable} antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className="min-h-screen bg-[var(--neu-bg)] text-[var(--neu-text)] font-sans transition-colors duration-200 selection:bg-[var(--neu-accent-soft)] selection:text-[var(--neu-accent)]"
        suppressHydrationWarning
      >
        <ThemeProvider>
          <SessionProvider>
            <SidebarProvider>
              <SettingsProvider>
                <LayoutContent>{children}</LayoutContent>
                <ChatBot />
              </SettingsProvider>
            </SidebarProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
