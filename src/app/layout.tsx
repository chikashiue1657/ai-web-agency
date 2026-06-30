import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { isUsingMockDb } from "@/lib/repo";

export const metadata: Metadata = {
  title: "AI集客支援 管理画面",
  description: "沖縄エリア店舗向けAI集客支援サービス MVP 管理画面",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const mock = isUsingMockDb();
  return (
    <html lang="ja">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="bg-white border-b border-gray-200">
            <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
              <nav className="flex items-center gap-6">
                <Link href="/" className="font-bold text-brand-600">
                  AI集客支援
                </Link>
                <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
                  ダッシュボード
                </Link>
                <Link href="/stores" className="text-sm text-gray-600 hover:text-gray-900">
                  店舗一覧
                </Link>
              </nav>
              {mock && (
                <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-800">
                  モックDB（Supabase未設定）
                </span>
              )}
            </div>
          </header>
          <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">{children}</main>
          <footer className="border-t border-gray-200 py-4 text-center text-xs text-gray-400">
            AI集客支援サービス MVP — 人間確認前提の営業支援ツール
          </footer>
        </div>
      </body>
    </html>
  );
}
