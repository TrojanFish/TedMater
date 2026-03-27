import type { Metadata } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import { AppProvider } from "@/lib/i18n";
import "./globals.css";

const outfit = Outfit({ 
  subsets: ["latin"],
  variable: "--font-heading",
});

const plusJakarta = Plus_Jakarta_Sans({ 
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "TEDMaster | AI-Powered TED English Learning",
  description: "Learn English through TED talks with AI vocabulary analysis, grammar breakdown, and shadowing practice.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className={`${outfit.variable} ${plusJakarta.variable} font-body antialiased min-h-full selection:bg-tertiary selection:text-foreground`}>
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
