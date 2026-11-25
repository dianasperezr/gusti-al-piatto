import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gusti al piatto",
  description: "CMS para menús digitales de restaurantes.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body className="bg-background font-sans text-foreground antialiased">{children}</body>
    </html>
  );
}
