import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Board",
  description: "A Trello-style kanban board designed for agentic workflows."
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
