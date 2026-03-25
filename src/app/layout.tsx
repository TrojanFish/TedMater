import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppProvider } from "@/lib/i18n";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TEDMaster | AI-Powered TED English Learning",
  description: "Learn English through TED talks with AI vocabulary analysis, grammar breakdown, and shadowing practice.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className={`${inter.className} min-h-full`}>
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
