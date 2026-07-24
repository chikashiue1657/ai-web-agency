# Neumos AI v1

店舗情報・AI診断・営業提案内容を受け取り、**店舗向けのWeb集客コンテンツを自動生成する** AIエンジン。

> Neumos AIは「HTMLを組み立てるだけのAI」ではない。
> 強みを分析し、集客課題を整理し、ターゲット顧客を定義し、サイトコンセプトを固めた
> **うえで** ページ構成・SEO・本文を生成する、マーケティング戦略エンジン。

`ai-web-agency`（沖縄エリア店舗向け「AI集客支援サービス MVP」）とは別プロジェクトとして
このディレクトリ配下に構築（独立した `package.json` / Next.js アプリ）。将来的に
単独リポジトリへ切り出す前提の構成にしている。

---

## Neumos AI の思考パイプライン

```
StoreBrief（店舗情報・AI診断・営業提案）
   │
   ▼
① 強み分析 (analyzeStrengths)
② 集客課題整理 (analyzeChallenges)
③ ターゲット顧客定義 (defineTargetPersona)
④ 差別化ポイント (defineDifferentiators)
   │  ─── ここまでを StrategyAnalysis としてまとめる ───
   ▼
⑤ サイトコンセプト作成 (buildConcept)
⑥ ページ構成作成 (buildPageStructure)
⑦ SEOキーワード反映 (buildSeo)
⑧ 本文生成（Hero / About / Service / Feature / Gallery / Access / FAQ / Contact / Instagram / GBP改善案）
```

- ①〜⑧はすべて `src/lib/engine/rule-based.ts` に**純関数**として実装。LLMキー未設定でも
  この戦略パイプラインだけで完全なコンテンツが生成できる（AI集客支援MVPの
  「LLMはオプション」という設計思想を踏襲）。
- LLMキーが設定されている場合は `src/lib/engine/website.ts` がルールベースの
  `StrategyAnalysis` を下敷きにLLMへ渡し、同じ思考ステップを踏んだうえで文章の質を
  高める（`src/lib/engine/prompts.ts` のシステムプロンプトで思考順序を強制）。
  LLM出力はZodスキーマ（`GeneratedWebsiteContentsSchema`）で検証し、壊れたJSONの場合は
  自動的にルールベース結果へフォールバックする（例外を投げない）。

## Website Renderer（実際に公開できるホームページの生成）

`generatedContents` からNext.jsコンポーネントを組み立て、`/preview/[requestId]` に
アクセスすると**実際に公開できる状態のレスポンシブなホームページ**がそのまま表示される
（`src/components/website/`）。

| コンポーネント | 内容 |
|---|---|
| `Header` | 店舗名 + セクションへのアンカーナビ（モバイルはハンバーガーメニュー、クライアントコンポーネント） |
| `Hero` | キャッチコピー・エリア/業種バッジ・CTAボタン |
| `About` | サイトコンセプト + 強み（`sections`のうち`kind:"about"`） |
| `Service` | メニュー・サービス紹介カード（`kind:"service"`） |
| `Feature` | 選ばれる理由を番号付きカードで表示（`kind:"feature"`） |
| `Gallery` | 実写真が無い前提のデザイン性プレースホルダー（グラデーション+キャプション） |
| `Faq` | `<details>`によるアコーディオン（JS無しでも動作） |
| `Access` | エリア・行き方 + Google Maps埋め込み（APIキー不要の`output=embed`） |
| `Contact` | CTA + 問い合わせ手段一覧 |
| `Footer` | 店舗名・エリア・トップへ戻るリンク |

`WebsiteRenderer`（`src/components/website/WebsiteRenderer.tsx`）がこれらを1つに合成する。
すべてTailwindでモバイルファースト・レスポンシブ対応（`sm:`/`md:`/`lg:`ブレークポイント）。

- **About/Service/Featureは必ず生成される**: `src/lib/engine/rule-based.ts` の
  `ensureRequiredKinds()` が、`recommendedPages`にそれらに該当するページが無い場合でも
  デフォルトページ（お店の強み/メニュー・サービス/選ばれる理由）を自動的に補う。
  LLM生成時も `GeneratedWebsiteContentsSchema` が `sections` に
  `about`/`service`/`feature` を最低1件ずつ含むことを検証し、欠けていればルールベースに
  フォールバックするため、Website Rendererが空セクションを描画することはない。
- **Gallery**: 実写真が無い前提のため`caption`/`altText`のみを生成し、グラデーション+
  カメラアイコンのプレースホルダーで表現（実写真に差し替え可能な設計）。
- **Access**: `AccessInfo.mapQuery`（店舗名+エリア）を使い、APIキー不要の
  `https://www.google.com/maps?q=...&output=embed` でマップを埋め込む。
- 静的HTML書き出し版（`src/lib/preview/render.ts` → `GET /api/preview/{requestId}/raw`）も
  同じセクション構成に追従しており、Next.js非依存で単体HTMLとして配布・移植できる。

## ディレクトリ構成

```
neumos-ai/
├── src/
│   ├── app/
│   │   ├── page.tsx                       # トップ（API概要・対応generationType一覧）
│   │   ├── preview/[requestId]/page.tsx   # 生成結果プレビュー（Website Rendererをそのまま表示）
│   │   └── api/
│   │       ├── generate/route.ts          # POST /api/generate（ネイティブ契約）
│   │       ├── preview/[requestId]/raw/   # 単体HTML書き出し（静的エクスポート用）
│   │       └── v1/contents/               # AI集客支援MVP互換ブリッジ（後述）
│   ├── components/website/                # Website Renderer本体
│   │   ├── Header.tsx / Hero.tsx / About.tsx / Service.tsx / Feature.tsx
│   │   ├── Gallery.tsx / Faq.tsx / Access.tsx / Contact.tsx / Footer.tsx
│   │   ├── WebsiteRenderer.tsx            # 上記9+1コンポーネントを合成
│   │   └── utils.ts                       # 本文の箇条書きパース等
│   └── lib/
│       ├── types.ts        # StoreBrief / GenerationType / GeneratedWebsiteContents 等の契約
│       ├── validation.ts   # Zodスキーマ（入力検証・LLM出力検証）
│       ├── catalog.ts      # generationType ラベル一元管理
│       ├── generate.ts     # 生成〜保存の共通オーケストレーション
│       ├── store.ts        # 生成結果の永続化ストア（Supabase / 未設定時はインメモリ）
│       ├── bridge.ts       # MVP互換の GeneratedContent[] へ変換
│       ├── llm/client.ts   # プロバイダ非依存LLMクライアント（Anthropic優先/OpenAI切替可）
│       ├── engine/
│       │   ├── rule-based.ts  # マーケティング思考パイプライン（純関数・テスト済み）
│       │   ├── prompts.ts     # LLM用プロンプト（思考順序を強制するsystem prompt）
│       │   ├── website.ts     # generationType="website" のオーケストレーション
│       │   └── index.ts       # generationType ディスパッチャ（拡張ポイント）
│       └── preview/render.ts  # 生成物 → 単体HTMLドキュメント
└── tests/                     # vitest（23件、コンポーネントの描画テスト含む）
```

## セットアップ

```bash
cd neumos-ai
npm install
cp .env.example .env.local   # 任意。未設定でもルールベース＋インメモリで完全動作
npm run dev                  # http://localhost:3000
```

```bash
npm run typecheck
npm run build
npm run test        # vitest
```

### 永続化（Production必須）

`/preview/[requestId]` はVercelのようなサーバーレス環境で複数インスタンス・
再起動をまたいで参照できる必要があるため、Production運用では **Supabase設定が必須**。

1. Supabaseで新規プロジェクトを作成（AI集客支援MVPとは別プロジェクト。DBを共有しない設計）
2. `supabase/schema.sql` をSQL Editorで実行（`neumos_content_generation_requests`テーブルを作成）
3. `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` を設定
   （`SUPABASE_URL`はサーバ専用のため`NEXT_PUBLIC_`接頭辞は不要。既に
   `NEXT_PUBLIC_SUPABASE_URL`を設定済みの場合はそちらもフォールバックとして読む）

**注意**: MVPと同一のSupabaseプロジェクトを共有する運用になった場合でも、
テーブル名が`neumos_`接頭辞付き（`neumos_content_generation_requests`）のため、
MVP側の`mvp_content_generation_requests`とは衝突しない。過去に両者が同じ
テーブル名`content_generation_requests`を取り合い、片方のcreate/drop tableが
もう片方のカラムを消してしまう事故が発生したため、この接頭辞は変更しないこと。

未設定のまま（ローカル開発等）だとインメモリにフォールバックし、同一プロセス内でのみ
プレビューが参照できる（サーバーレスでは再起動・別インスタンスで失われる）。

## API

### `POST /api/generate`（v1のネイティブ契約）

**入力**

```json
{
  "generationType": "website",
  "brief": {
    "storeName": "沖縄そば処 花",
    "industry": "沖縄そば店",
    "area": "那覇市首里",
    "targetCustomer": "地元客・観光客",
    "mainProblem": "観光客への認知度が低くリピートも少ない",
    "salesAngle": "自家製麺と昔ながらの出汁",
    "websiteGoal": "来店予約と口コミ増加",
    "siteConcept": "首里の路地にある昔ながらの沖縄そば店",
    "recommendedPages": ["トップ", "メニュー", "アクセス", "お客様の声"],
    "seoKeywords": ["那覇市 沖縄そば", "首里 そば"],
    "tone": "あたたかい・懐かしい",
    "offer": "初回来店で小鉢サービス"
  }
}
```

**出力**（`200`）

```json
{
  "requestId": "…",
  "status": "preview",
  "previewUrl": "http://localhost:3000/preview/…",
  "publishedUrl": null,
  "generatedContents": {
    "concept": "…",
    "heroTitle": "…",
    "heroSubtitle": "…",
    "sections": [{ "id": "section-1", "kind": "about", "heading": "…", "body": "…" }],
    "gallery": [{ "id": "gallery-1", "caption": "…", "altText": "…" }],
    "access": { "areaLabel": "…", "addressHint": "…", "mapQuery": "…" },
    "contactMethods": [{ "label": "…", "href": "tel:… または https://… （実データが無い連絡手段はhrefを持たない）" }],
    "cta": { "headline": "…", "body": "…", "buttonLabel": "…", "href": "tel:… または \"#contact\"（実データが無ければ常にページ内アンカー）" },
    "seoTitle": "…",
    "metaDescription": "…",
    "faq": [{ "question": "…", "answer": "…" }],
    "instagramCaption": "…",
    "googleBusinessImprovement": ["…"],
    "strategy": { "strengths": ["…"], "challenges": ["…"], "targetPersona": "…", "differentiators": ["…"] }
  }
}
```

- `generationType` が `"website"` 以外（`landing_page` / `instagram_post` /
  `google_business_improvement` / `blog_post` / `faq` / `seo_content` / `copywriting`）の場合、
  入力検証は通過するが `501 Not Implemented` を返す（`implementedGenerationTypes` で実装済み一覧を返却）。
  型・Zodスキーマ・カタログにはすでに全種別を定義済みのため、実装時は
  `src/lib/engine/index.ts` の `switch` にハンドラを1つ追加するだけで拡張できる。
- 生成結果は `requestId` をキーにサーバ側で保持され、`GET /preview/{requestId}` で確認できる。
- 入力不正時は `400`、生成失敗時は `500` を返す。
- `contactMethods`/`cta.href` は、リクエストの `brief.realData`（`address`/`phone`/
  `openingHours`/`instagramUrl`/`googleRating`/`googleReviewCount`/`photoUrls`、全項目任意）に
  実際に存在する連絡手段だけをリンク先として組み立てる（`src/lib/engine/real-data-links.ts`）。
  電話番号が無いのに「電話で予約する」のようなクリックしても機能しないボタンを表示しないための
  設計で、これは生成方式（ルールベース/LLM）に依らず必ず適用される。realDataが無ければ
  `cta.href` は常にページ内アンカー `"#contact"` になる。

### `GET /preview/{requestId}`

Website Rendererが組み立てた**実際に公開できる状態のレスポンシブなホームページ**をそのまま
表示するプレビュー画面（Next.jsコンポーネントとして直接レンダリング。iframeではない）。
単体HTML書き出し版は `GET /api/preview/{requestId}/raw` から確認できる。

---

## AI集客支援MVPとの接続方法

AI集客支援MVP（`../`）は `src/lib/neumos/client.ts` で以下のREST契約を想定して実装済み：

| 操作 | メソッド/パス | ボディ | レスポンス |
|---|---|---|---|
| 生成投入 | `POST {NEUMOS_API_URL}/v1/contents` | `{ generationType, brief }` | `{ requestId, status, previewUrl?, publishedUrl?, generatedContents? }` |
| 状態取得 | `GET {NEUMOS_API_URL}/v1/contents/{requestId}` | — | 同上 |

Neumos AI v1は、この契約に対応する**互換ブリッジ**を用意している：

- `POST /v1/contents` — `POST /api/generate` と同じ生成処理を実行する。
- `GET /v1/contents/{requestId}` — 生成結果の状態を返す（v1は同期生成のため常に `status: "preview"`）。

> ⚠️ **このルートは意図的に `/api` の外（`src/app/v1/contents/route.ts`）に置いている。**
> Next.js App Routerでは `src/app/api/v1/contents/route.ts` は `/api/v1/contents` に
> マッピングされてしまい、MVP側 `client.ts` が叩く `POST {NEUMOS_API_URL}/v1/contents`
> と一致せず404になる（実際にこのズレが原因で「コンテンツ生成依頼に失敗しました」が
> 発生していた）。ルートを追加・変更する際は `npm run build` の `Route (app)` 出力で
> 実際のパスが `/v1/contents` になっていることを必ず確認すること。

### 接続手順

1. Neumos AI v1をデプロイし、公開URL（例: `https://neumos-ai.example.com`）を控える。
2. AI集客支援MVP側の環境変数に設定する。

   ```bash
   # ai-web-agency/.env.local
   NEUMOS_API_URL=https://neumos-ai.example.com
   NEUMOS_API_KEY=（任意の値。v1側では認証未実装のため検証はしないが、
                    本番運用時はNeumos AI側にAPIキー検証を追加すること）
   ```

3. MVP側は `NEUMOS_API_URL` が設定されると、店舗詳細の「この店舗のホームページをAIで作成」
   ボタンから `POST {NEUMOS_API_URL}/v1/contents` を叩き、MVP自身の`mvp_content_generation_requests`に
   `requestId(=external_id)` / `status` / `previewUrl` / `publishedUrl` / `generatedContents` を保存する。
   「生成状況を更新」ボタンで `GET {NEUMOS_API_URL}/v1/contents/{requestId}` をポーリングする。

### `generatedContents` の形状差分について

- **Neumos AI v1のネイティブ契約**（`/api/generate`）: 本README冒頭の通り、`concept` /
  `heroTitle` / `sections` などの**構造化オブジェクト**を返す（マーケティング戦略の
  中間成果物 `strategy` も含む）。
- **MVP互換ブリッジ**（`/v1/contents`）: MVP側の型 `GeneratedContent[]`
  （`{ type?, title?, url?, body?, meta? }` の緩い配列）に変換して返す
  （`src/lib/bridge.ts` の `toLegacyGeneratedContents`）。これにより、MVP側の
  「生成物一覧」表示コンポーネント（`neumos-panel.tsx`）は無改修でそのまま動作する。
- 将来的にMVP側の型をNeumos AI v1のネイティブ契約（構造化オブジェクト）に合わせて
  拡張する場合は、MVP側 `src/lib/types.ts` の `GeneratedContent` を更新し、
  `/api/generate` を直接呼ぶよう `client.ts` を切り替えればよい。

### トラブルシューティング: 「コンテンツ生成依頼に失敗しました」

MVP側でこのエラーが出た場合の確認手順（`requestContentGenerationAction` →
`requestContentGeneration` → `submitContentGeneration` の順に追う）。

1. **ログを確認する**（Vercelなら Project → Functions → Logs、ローカルなら`npm run dev`の標準出力）。
   `submitContentGeneration()`は毎回 `neumos submit request` / `neumos submit response` を
   構造化ログ出力する（endpoint・request body・マスク済みAuthorization・status・response body）。
   ログが1件も出ていなければ、`requestContentGeneration()`より前段（AI診断 `runStoreDiagnosis` や
   `repo.createContentGenerationRequest`）で例外が発生している可能性が高い。
2. **`NEUMOS_API_URL` / `NEUMOS_API_KEY` がProductionに設定されているか確認する。**
   `.env.local`はデプロイに含まれないため、Vercel等のダッシュボードでProduction環境変数として
   別途設定する必要がある。`neumos submit skipped: not configured` ログが出ていれば未設定。
   `neumos config status`ログの`NEUMOS_API_URL_host`で、意図したホストが読めているか確認できる。
3. **エンドポイントがREADMEと一致しているか確認する。**
   本READMEが定める契約は `POST {NEUMOS_API_URL}/v1/contents`（`/api`を含まない）。
   `NEUMOS_API_URL`にパスを足していないか（例: 誤って`.../api`まで含めていないか）を確認する。
   含めていると実際には`.../api/v1/contents`を叩いてしまい404になる
   （`neumos config warning: NEUMOS_API_URL contains a path`ログで検出できる）。
   Neumos AI v1側のルートも `src/app/v1/contents/route.ts`（`app/api/`配下ではない）に
   あることを確認し、`npm run build`の`Route (app)`出力で実際のパスが`/v1/contents`に
   なっているか確認する。
4. **送信JSONとAPIの期待するJSONを比較する。**
   MVPは `{ generationType, brief }`（`brief`は`NeumosBrief`全体）を送る。
   Neumos AI v1の`GenerateRequestSchema`（`src/lib/validation.ts`）が期待するのは
   `storeName/industry/area/targetCustomer/mainProblem/salesAngle/websiteGoal/siteConcept/
   recommendedPages/seoKeywords/tone/offer`の12フィールドで、名称・要求（非空文字列）は
   MVP側`NeumosBrief`と1:1で一致する（`brief`内の余分な`generationType`はZodが無視するため
   問題ない）。`400`が返る場合はログの`requestBody`と本スキーマを見比べ、
   空文字列になっているフィールドが無いか確認する。
5. **画面にエラー本文が表示されない/読みにくい場合**は`neumos-panel.tsx`の該当リクエストの
   「理由:」欄を確認する。`client.ts`は`response.text()`を切り詰めずにそのまま`error`へ格納するため、
   長いHTMLエラーページ等も含めて全文が`<pre>`内にスクロール表示される。

---

## 生成種別（`generationType`）の拡張設計

| 種別 | v1実装 | 説明 |
|---|---|---|
| `website` | ✅ | 店舗の公式サイト一式（Hero/セクション/CTA/FAQ/SEO） |
| `landing_page` | 拡張予定 | キャンペーン/予約特化の1枚ページ |
| `instagram_post` | 拡張予定 | 投稿キャプション・ハッシュタグ案（`instagramCaption` は既にwebsite生成に同梱） |
| `google_business_improvement` | 拡張予定 | GBP説明文・カテゴリ・投稿の改善提案（同上、`googleBusinessImprovement` に同梱） |
| `blog_post` | 拡張予定 | 集客用の記事コンテンツ |
| `faq` | 拡張予定 | よくある質問の生成・拡充単体版 |
| `seo_content` | 拡張予定 | 検索流入向けページ/文章 |
| `copywriting` | 拡張予定 | 訴求コピー案の複数バリエーション |

同じ `StoreBrief`（＝MVPの `NeumosBrief` からgenerationTypeを除いた核）から、
`generationType` を変えるだけで別種別のコンテンツを生成できるように、
戦略パイプライン（強み/課題/ターゲット/コンセプト）とコンテンツ生成を分離した設計にしている。
新しい種別を実装する際は:

1. `src/lib/types.ts` の `GeneratedContentsMap` に生成物の型を追加
2. `src/lib/engine/<type>.ts` を実装（`rule-based`のstrategyを再利用可能）
3. `src/lib/engine/index.ts` の `switch` にケースを追加
4. `IMPLEMENTED_GENERATION_TYPES` に追加

## 制約・今後の拡張ポイント

- **プレビューの永続化**: `src/lib/store.ts` はSupabase（`neumos_content_generation_requests`
  テーブル）に保存する。`SUPABASE_URL`（または`NEXT_PUBLIC_SUPABASE_URL`）/
  `SUPABASE_SERVICE_ROLE_KEY`が未設定の場合のみインメモリにフォールバックする
  （ローカル開発向け。Vercelサーバーレスでは複数インスタンス・再起動をまたげないため、Productionでは
  必ずSupabaseを設定すること）。
- **公開自動化**: `publishedUrl` は現状常に `null`。静的ホスティングへのデプロイや
  独自ドメイン接続は今後の拡張ポイント（`preview/render.ts` の出力はビルド非依存の
  単体HTMLのため、そのまま静的配信可能）。
- **認証**: `/v1/contents` は現状 `Authorization` ヘッダを検証しない。本番運用では
  MVPの `INTERNAL_API_KEY` と同様の仕組みを追加すること。
- **多言語対応**: `StoreBrief` に `language` を追加し、`prompts.ts` / `rule-based.ts` を
  言語別に分岐させることで対応可能。
