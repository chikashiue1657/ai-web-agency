"use client";
/**
 * AI診断パネル（Thinking Engine）。
 * - 「AI診断を作成」で店舗を診断し StoreStrategy を生成・保存。
 * - なぜこの優先度か / 改善余地 / 刺さる営業提案 / HP構成 などを表示（item3）。
 */
import { useState, useTransition } from "react";
import { runDiagnosisAction } from "@/app/actions";
import { ErrorDetailPanel, useErrorDetailToggle, type NeumosErrorDetail } from "@/components/error-detail";
import type { StoreStrategy } from "@/lib/types";

export function DiagnosisPanel({
  storeId,
  initialStrategy,
}: {
  storeId: string;
  initialStrategy: StoreStrategy | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [strategy, setStrategy] = useState<StoreStrategy | null>(initialStrategy);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<NeumosErrorDetail | null>(null);
  const detailToggle = useErrorDetailToggle();

  function run() {
    setError(null);
    setErrorDetail(null);
    detailToggle.reset();
    startTransition(async () => {
      const res = await runDiagnosisAction(storeId);
      if (res.ok) setStrategy(res.strategy);
      else {
        setError(res.error);
        setErrorDetail(res.errorDetail);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={run}
          disabled={isPending}
          className="text-sm px-4 py-2 rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 font-medium"
        >
          {isPending ? "診断中…" : strategy ? "AI診断を再作成" : "AI診断を作成"}
        </button>
        {strategy && (
          <span className="text-sm text-gray-500">
            受注確率{" "}
            <span className="font-bold text-gray-800">{strategy.confidenceScore}%</span>
            <span className="ml-2 text-xs text-gray-400">
              （{strategy.method === "rule+llm" ? "ルール+AI補正" : "ルールベース"}）
            </span>
          </span>
        )}
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-600">エラー: {error}</p>
          <ErrorDetailPanel
            detail={errorDetail}
            rawJson={errorDetail ? JSON.stringify(errorDetail) : error}
            isOpen={detailToggle.isOpen}
            onToggle={detailToggle.toggle}
            isCopied={detailToggle.isCopied}
            onCopy={() => detailToggle.copy(errorDetail ? JSON.stringify(errorDetail, null, 2) : error)}
          />
        </div>
      )}

      {!strategy && !error && (
        <p className="text-sm text-gray-400">
          「AI診断を作成」で、店舗の強み・弱み・集客課題・受注確率・営業切り口・提案内容を診断します。
        </p>
      )}

      {strategy && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <Block title="なぜこの優先度か">
            <p>{strategy.priorityRationale}</p>
          </Block>
          <Block title="想定ターゲット">
            <p>{strategy.targetCustomer}</p>
          </Block>

          <Block title="強み">
            <List items={strategy.strengths} />
          </Block>
          <Block title="弱み・改善余地">
            <List items={strategy.weaknesses} />
          </Block>

          <Block title="集客課題">
            <List items={strategy.marketingProblems} />
          </Block>
          <Block title="刺さる営業提案">
            <p className="font-medium">{strategy.recommendedOffer}</p>
            <p className="text-gray-600 mt-1">切り口: {strategy.salesAngle}</p>
          </Block>

          <Block title="HPを作るなら（構成・コンセプト）">
            <p className="mb-1">{strategy.websiteConcept}</p>
            <p className="text-gray-600 text-xs mb-1">ゴール: {strategy.websiteGoal}</p>
            <div className="flex flex-wrap gap-1">
              {strategy.recommendedPages.map((p) => (
                <span key={p} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                  {p}
                </span>
              ))}
            </div>
          </Block>
          <Block title="HPの必要性 / 差別化">
            <p className="mb-1">{strategy.websiteNecessity}</p>
            <p className="text-gray-600">{strategy.differentiation}</p>
          </Block>

          <Block title="SNS改善点">
            <List items={strategy.snsImprovements} />
          </Block>
          <Block title="Googleビジネス改善点">
            <List items={strategy.googleBusinessImprovements} />
          </Block>

          <Block title="SEOキーワード（案）">
            <div className="flex flex-wrap gap-1">
              {strategy.seoKeywords.map((k) => (
                <span key={k} className="text-xs px-1.5 py-0.5 rounded bg-brand-50 text-brand-700">
                  {k}
                </span>
              ))}
            </div>
          </Block>
        </div>
      )}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-100 rounded p-3 bg-gray-50">
      <div className="text-xs text-gray-500 mb-1">{title}</div>
      {children}
    </div>
  );
}

function List({ items }: { items: string[] }) {
  if (!items.length) return <p className="text-gray-400">-</p>;
  return (
    <ul className="list-disc pl-5 space-y-0.5">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}
