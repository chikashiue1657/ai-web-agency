# AI集客支援サービス MVP

沖縄エリアの店舗向け「AI集客支援」プラットフォームのMVP。
ホームページ制作ではなく**売上・集客・予約導線の改善**を価値として、
営業活動（店舗候補収集 → 優先度判定 → 提案書/仮サイト生成 → 人間が営業）を支援します。

> 設計原則: **完全自動化ではなく人間確認前提**。不明点は断定せず「（仮説）」と明示し、
> 実在しない店舗情報は生成しません。AI出力は説明可能性（reasons）を重視します。

---

## 全体アーキテクチャ

```
[収集: Google Places / Apify / CSV]
        │  (正規化: 純関数)
        ▼
   ┌──────────┐      ┌──────────────────────────────┐
   │  API/Action │───▶│  サービス層 (services.ts)       │
   └──────────┘      │  normalize / scoring / proposal│
        ▲            │  / site を repo・ログと結合      │
        │            └──────────────┬───────────────┘
   [管理画面 UI]                     ▼
   ダッシュボード             ┌─────────────┐
   店舗一覧 / 詳細            │ Repository層 │ ← Supabase or インメモリ
   仮サイトプレビュー          └─────────────┘
```

- **業務ロジックは純関数**（`src/lib/{normalize,scoring,proposal,site}`）に集約 → テスト容易・LLM非依存。
- **Repository層**でデータ保存先を抽象化。**Supabase未設定ならインメモリ・モック**にフォールバック（ダミーデータで即起動）。
- **LLMはオプション**。`ANTHROPIC_API_KEY`（または OpenAI）があれば二次補正、なければルールベースで完全動作。
- **APIはn8nから呼びやすいREST**。Zodで入力検証、共通エラーハンドリング、簡易APIキー認証（後で本認証へ差し替え可）。

## ディレクトリ構成

```
src/
├── app/
│   ├── page.tsx                  # ダッシュボード
│   ├── stores/                   # 店舗一覧（filters.tsx）/ 詳細（[id]）
│   ├── preview/[slug]/           # 仮デモサイトのプレビュー
│   ├── actions.ts                # Server Actions（生成/メモ/ステータス）
│   └── api/                      # ingest / leads/score / proposals / sites / stores
├── components/                   # UI部品（ui.tsx, markdown.tsx）
└── lib/
    ├── types.ts                  # ドメイン型（DBと1:1）
    ├── normalize/                # 店舗データ正規化（純関数 + URL抽出）
    ├── scoring/                  # 優先度判定（ルール + LLM補正）
    ├── proposal/                 # 提案書生成（テンプレ + LLM磨き）
    ├── site/                     # 仮サイト生成（schema/themes/seo/slug）
    ├── repo/                     # Repository（memory / supabase / factory）
    ├── llm/                      # プロバイダ非依存LLMクライアント
    ├── mock/                     # ダミーデータ
    ├── services.ts               # ユースケース オーケストレーション
    ├── api.ts                    # API共通（Zod/認証/エラー）
    └── logger.ts
supabase/schema.sql               # DBスキーマ
tests/                            # vitest 単体テスト
```

## セットアップ

```bash
npm install
cp .env.example .env.local   # 任意。未設定でもモックDBで動作
npm run dev                  # http://localhost:3000
```

- **Supabaseを使う場合**: `supabase/schema.sql` を実行し、`NEXT_PUBLIC_SUPABASE_URL` /
  `SUPABASE_SERVICE_ROLE_KEY` を設定。
- **LLM補正を使う場合**: `ANTHROPIC_API_KEY`（既定モデル `claude-opus-4-8`）を設定。

```bash
npm run test       # 単体テスト（31件）
npm run typecheck  # 型チェック
npm run build      # 本番ビルド
```

## API（n8nからの呼び出し例）

| メソッド | パス | 用途 |
|---|---|---|
| GET  | `/api/stores` | 一覧取得（`q,category,area,priority,has_website,sort`） |
| GET  | `/api/stores/:id` | 詳細（store+lead+proposals+sites+activity） |
| POST | `/api/ingest` | 取り込み `{source, items[]}` |
| POST | `/api/leads/score` | 優先度判定 `{store_id, use_llm?}` |
| POST | `/api/proposals` | 提案書生成 `{store_id, use_llm?, review_summary?}` |
| POST | `/api/sites` | 仮サイト生成 `{store_id, theme?, language?}` |

`INTERNAL_API_KEY` を設定すると全APIで `x-api-key` ヘッダ検証が有効化されます（未設定時は素通り）。

## DBスキーマ

`stores / leads / proposals / generated_sites / activity_logs`（詳細は `supabase/schema.sql`）。
`place_id` を一意キー第一候補とし、`tenant_id` をマルチテナント用に予約済み。

## 主要ロジックの要点

- **正規化**: 欠損値・URL表記揺れ・件数ノイズに強い純関数。`has_website` はポータル/SNS（食べログ/Instagram等）を除外して厳密判定。upsertは place_id 優先、無ければ name+address の近似一致（Dice係数）で重複統合。
- **優先度判定**: 0〜100点のルールスコア（HP無し+35が最重要）→ A≥70/B≥45/C。reasonsで説明可能。LLM補正は ±20 にクランプ。
- **提案書**: 実データのみ断定、欠損は「（仮説）」明示。業種別に文脈差分。
- **仮サイト**: JSON schema（Zod）ベース、業種別テーマ分岐、口コミ由来訴求、SEO生成、写真不足フォールバック、`isHypothesis`で仮説部分を明示。

## 今後の拡張ポイント

- **公開自動化**: `generated_sites.status/published_url` を起点に GitHub+Vercel デプロイ、Cloudflareで独自ドメイン接続。
- **CMS化**: サイトは `generated_json`(SiteDocument schema) で保持済み → Sanity等への移行が容易。
- **保守AI / 差分監視**: `activity_logs` を基盤に月次保守、Instagram/Googleマップ差分監視を追加。
- **マルチテナント / 認証**: `tenant_id` 予約済み。Supabase Auth + RLS（schema.sqlに雛形）。`checkApiKey` を本認証へ差し替え。
- **多言語ページ / SEO記事**: `language` フィールドと site schema を多言語展開。
