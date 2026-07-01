import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Neumos AI v1",
  description: "店舗のWeb集客コンテンツを自動生成するAIエンジン",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 text-gray-800">{children}</body>
    </html>
  );
}
