import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "func.lol",
  description: "Lab experiments by Functionally Imperative.",
  icons: { icon: "/func-imp-favicon.png" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
