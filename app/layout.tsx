import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // `default` covers routes without their own title (e.g. the boards list);
  // `template` lets per-board pages supply just the board name. Previously this
  // was a hardcoded string, so every board URL unfurled with the same fixed
  // title in Slack/Teams regardless of which board it pointed at.
  title: {
    default: "Retro Board",
    template: "%s · Retro Board",
  },
  description: "Sprint retrospective board",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
