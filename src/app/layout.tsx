import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Mailing",
  description: "Personal AI mail assistant"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
