import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DM_Sans } from "next/font/google";
import { AppNav } from "@/components/AppNav";
import { AuthSessionProvider } from "@/components/AuthSessionProvider";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Chat",
  description: "Single-thread chat demo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className={dmSans.variable}>
      <body>
        <AuthSessionProvider>
          <AppNav />
          <div className="app-main">{children}</div>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
