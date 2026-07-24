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

## Thinking Engine（店舗診断）— StoreStrategy

店舗情報から営業戦略をAIで診断する中核エンジン（`src/lib/neumos/strategy.ts`, 純関数・テスト済み）。
ルールベース → 任意でLLM補正（`strategy-llm.ts`）。結果を **`StoreStrategy`**（`store_strategies` に 1:1 保存）へ集約:
強み / 弱み / 集客課題 / HP必要性 / SNS改善 / Googleビジネス改善 / 競合差別化 /
想定ターゲット / **受注確率(confidenceScore)** / 営業切り口 / おすすめ提案 / SEOキーワード /
HP構成・コンセプト / 優先度の根拠 / ノイモス受け渡し核 `generationBrief`。
店舗詳細の「AI診断」セクションで、なぜこの優先度か・改善余地・刺さる提案・HP構成を表示。

## ノイモスAI連携（店舗のWeb集客コンテンツ生成）— 営業支援→受注→生成→公開

ノイモスAIは「HP生成」ではなく**Web集客コンテンツ生成AI**として設計。
`StoreStrategy` から **`NeumosBrief`**（外部JSON契約）を組み立て、`generationType` を変えて
複数種類のコンテンツを生成できます（現段階はノイモスAI本体は未実装。Brief生成まで完成）。

**生成種別**（`GenerationType` / `src/lib/neumos/catalog.ts`）
website ✅（実装済） / landing_page / instagram_post / google_business_improvement /
blog_post / faq / seo_content / copywriting（以降は近日対応）。

生成エンジンを疎結合に保つ設計:

1. **受け渡し契約 `NeumosBrief`**（`src/lib/types.ts`）
   storeName / industry / area / targetCustomer / mainProblem / salesAngle /
   websiteGoal / siteConcept / recommendedPages / seoKeywords / tone / offer / generationType。
   `StoreStrategy.generationBrief`（種別非依存の核）に `generationType` を付与して生成。
   加えて任意項目 `realData`（`StoreRealData`）を持てる。Google Places由来の
   address/phone/opening_hours/rating/review_count/instagram_url/写真が
   storeに存在する場合のみ `buildStoreRealData(store)`（`src/lib/neumos/store-real-data.ts`）
   が埋める。Neumos AI側は存在する項目だけ店舗情報カード・ギャラリーへ反映し、
   無い項目は表示しない（捏造防止のため、無ければ省略する設計）。
   写真は `/api/places/photo` プロキシ経由のURLにして渡すため、
   Neumos AI側はGoogle APIキーを持たずに済む。
2. **ブリーフ組み立て `buildNeumosBrief(strategy, type)`**（`src/lib/neumos/neumos-brief.ts`, 純関数・テスト済み）
   + `requestContentGeneration()` が `buildStoreRealData()` の結果をマージする。
3. **アダプタ `src/lib/neumos/client.ts`（実接続）**

### Neumos API 連携（実接続）

`NEUMOS_API_URL` / `NEUMOS_API_KEY` が設定されていれば実APIへ送信、未設定なら
`mvp_content_generation_requests` に**下書き保存**（NeumosBrief のJSONプレビュー）。想定REST契約:

| 操作 | メソッド/パス | ボディ | レスポンス |
|---|---|---|---|
| 生成投入 | `POST {BASE}/v1/contents` | `{ generationType, brief }` | `{ requestId, status, previewUrl?, publishedUrl?, generatedContents? }` |
| 状態取得 | `GET {BASE}/v1/contents/{requestId}` | — | `{ requestId, status, previewUrl?, publishedUrl?, generatedContents?, error? }` |

- 認証: `Authorization: Bearer <NEUMOS_API_KEY>`。
- `status` は `queued|generating|preview|published|failed` に正規化（別表記も吸収）。
- 保存項目: `external_id(=requestId) / status / preview_url / published_url / generated_contents / error`。
- 本仕様が確定したら `client.ts` の `mapResponse` / エンドポイントを調整するだけ（UI/業務ロジック無改修）。

**フロー**: 「この店舗のホームページをAIで作成」→ `requestContentGeneration()` が
（戦略が無ければ診断してから）`NeumosBrief` を組み立て → Neumos へ投入 → 記録を保存。
店舗詳細の生成パネルで:

- **生成状況**（Queued / Generating / Preview / Published / Failed）をバッジ表示
- **「生成状況を更新」**で `GET /v1/contents/{requestId}` をポーリングし状態/URL/生成物を更新
- **Preview** / **公開サイト** のURLへ遷移、**生成物一覧**を表示
- **失敗時は「再生成」**（同種別で新規リクエスト＝履歴に残る）
- **生成履歴一覧**（種別・状態・日時・URL）

営業ステータス（未対応→DM送信→電話→商談→**成約**）と連動し、成約後に本番生成を促す導線。

## Neumos AI v1（別プロジェクト）

`neumos-ai/` に、店舗のWeb集客コンテンツ生成AIエンジン本体「Neumos AI v1」を実装済み
（独立した Next.js アプリ・別 `package.json`。将来的な単独リポジトリ切り出しを前提とした構成）。
本MVPとの接続方法・API契約・`generatedContents` の形状差分の扱いは
[`neumos-ai/README.md`](./neumos-ai/README.md) を参照。

## 今後の拡張ポイント

- **公開自動化**: `mvp_content_generation_requests.published_url` / `generated_sites.published_url` を起点に GitHub+Vercel デプロイ、Cloudflareで独自ドメイン接続。
- **CMS化**: サイトは `generated_json`(SiteDocument schema) で保持済み → Sanity等への移行が容易。
- **保守AI / 差分監視**: `activity_logs` を基盤に月次保守、Instagram/Googleマップ差分監視を追加。
- **マルチテナント / 認証**: `tenant_id` 予約済み。Supabase Auth + RLS（schema.sqlに雛形）。`checkApiKey` を本認証へ差し替え。
- **多言語ページ / SEO記事**: `language` フィールドと site schema を多言語展開。
