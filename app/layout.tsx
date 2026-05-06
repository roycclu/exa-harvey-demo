import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Exa Legal Research Demo",
  description: "Neural legal research workflows powered by Exa and OpenAI."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
