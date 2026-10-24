import "./globals.css";

import { Inter } from "next/font/google";
import { JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@usesend/ui";
import { Toaster } from "@usesend/ui/src/toaster";
import { FranceschiniAnalytics } from "@colinfran/analytics";


import { TRPCReactProvider } from "~/trpc/react";
import { Metadata } from "next";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Franceschini Email",
  description: "Send and monitor transactional email with Franceschini Email.",
  icons: [{ rel: "icon", url: "/icon.svg", type: "image/svg+xml" }],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="bg-background">
      <body
        className={`font-sans ${inter.variable} ${jetbrainsMono.variable} app bg-background`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Toaster />
          <TRPCReactProvider>{children}</TRPCReactProvider>
        </ThemeProvider>
        <FranceschiniAnalytics websiteId="web_dYowBBrWVc3NO8hhA2ZD"/>
      </body>
    </html>
  );
}
