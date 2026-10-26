import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider, ThemeToggle } from "@/components/theme-toggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hosts · Observability",
  description: "Host detail pages for cloud VMs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <TooltipProvider>
            <div className="border-b">
              <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-8">
                <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
                  <span className="size-2.5 rounded-sm bg-foreground" />
                  Observability
                </Link>
                <ThemeToggle />
              </div>
            </div>
            {children}
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
