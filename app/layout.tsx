import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prontuario Eletronico",
  description: "Modulo clinico orientado por decisao com timeline, evidencias e conformidade."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
