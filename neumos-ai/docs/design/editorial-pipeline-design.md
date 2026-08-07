# 編集パイプライン技術設計書 v2(承認待ち・未実装)

対象ブランチ: `agent/demo-video-phase0-1`
対象アプリ: `neumos-ai`(v2カフェ限定デザインエンジンのみ。v1・root MVPは対象外)
ステータス: **設計のみ。コード変更・コミット・push・PR更新は一切行っていない。**

改訂: レビュー(75〜80点評価)で指摘された4点を反映した第2版。差分は各章冒頭に「**v1→v2差分**」として明記する。

```
Observation → Artifacts → Filter → Compress → Arrange → Renderable → Presentation → Render
                                                                                  └─ Utility Layer(独立)
```

v1からの変更点は`Renderable`層の追加のみが構造上の変更で、他3点(Arrange戦略の外部化、absorbedCountの降格、Motionの依存方向)はインターフェース・責務境界の修正。

---

## 0. この設計書の読み方

依頼26項目の指定順ではなく、実装順(型 → Filter → Compress → Arrange → Renderable → Presentation → Render → 既存資産 → リスク → フェーズ → テスト → 検証 → 完了報告フォーマット)に並べ替えている。対応表を末尾に付す。

---

## 1. レビュー指摘4点への対応方針(サマリ)

| # | 指摘 | 対応 |
|---|---|---|
| 1 | Arrangeが類似度最小化(クラスタリング)専用になっており、リズム生成の余地が無い | `arrangeArtifacts(artifacts, strategy)`の`strategy`を外部から差し替え可能なインターフェースにする。今回実装するのは類似度最小化戦略(`clusterStrategy`)のみだが、将来の`rhythmStrategy`(交互配置)を型シグネチャレベルで排除しない(7章) |
| 2 | `absorbedCount`をPresentationの強い入力(`viewport`判定)に使っており、「撮影枚数」を「情報量」と誤読するリスクがある | Presentationの判定入力から`absorbedCount`を除外し、デバッグ・トレース専用フィールドに格下げする。画像の`Occupy`判定は解像度・縦横比という技術的制約のみを使う(9章) |
| 3 | Motionが`Presentation → Motion`という依存方向になっており、Renderの実装(DOM/CSS)が変わった際にPresentation側の意味づけが陳腐化する | `Render → Motion`に修正。Motion決定ロジックはRender層のコンポーネント内部に置き、Presentationは`primitive`という値を返すだけでMotionを一切知らない(10章) |
| 4 | `Artifact`が最終的な編集単位になっており、将来「複数Artifactを1つの表示単位として束ねる」ができない | `Artifact`と`Presentation`の間に薄い`Renderable`アダプタ層を追加する。今回は1 Artifact = 1 Renderableの恒等変換のみ実装するが、型は`Renderable.artifacts: Artifact[]`(複数可)として将来の束ね処理を型レベルで許容する(8章) |

指摘のうち以下2点は「私ならこうする」という所感として受け取り、必須条件ではないと理解した上で個別に判断した(19章参照):

- Presentation Primitiveの命名(`inline`/`stack`等のUI部品的な名前 → `Occupy`/`Sequence`/`Isolate`/`Support`/`Pair`への抽象化): **採用する**。理由は9章。
- 「Phase 0: Artifactだけを半年眺める期間」: **正式なPhaseとしては追加しない**が、理由と代替案を19章に記載。

---

## 2. 変更対象ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `src/lib/engine/photo-strategy.ts` | `PhotoTier`分類ロジックは維持。`buildPhotoPlan`のHero/Story/Gallery役割分担は新パイプラインでは不使用にするが、削除はせず`@deprecated`コメントのみ付与(段階的廃止、14章) |
| `src/lib/engine/section-plan-v2.ts` | 変更しない(後続フェーズで整理。今回は新パイプラインと並行稼働) |
| `src/components/website-v2/WebsiteRendererV2.tsx` | Phase 6でのみ、新パイプラインの出力を試験的に描画する分岐を追加(既存分岐は残す) |

## 3. 新規ファイル一覧

| ファイル | 役割 |
|---|---|
| `src/lib/editorial/artifact.ts` | `Artifact`型、`toArtifacts()` |
| `src/lib/editorial/filter.ts` | `filterArtifacts()`、`UtilityFacts`型 |
| `src/lib/editorial/similarity.ts` | 画像dHash・テキストJaccard類似度の共通関数 |
| `src/lib/editorial/compress.ts` | `compressArtifacts()` |
| `src/lib/editorial/arrange.ts` | `arrangeArtifacts()`、`ArrangeStrategy`型、`clusterStrategy` |
| `src/lib/editorial/renderable.ts` | **(新規追加)** `Renderable`型、`toRenderables()` |
| `src/lib/editorial/presentation.ts` | `assignPresentation()`、`PresentationPrimitive`型 |
| `src/components/website-v2/editorial/PresentedRenderableV2.tsx` | Primitiveごとの汎用レンダリングコンポーネント。Motion決定ロジックもここに内包する |
| `src/components/website-v2/editorial/UtilityLayerV2.tsx` | Utility Layer描画(既存`AccessHoursV2`/`StoreFactsV2`/`CTAV2`の実務情報部分を集約) |
| `tests/editorial-*.test.ts` 全6本 | 後述のテスト設計に対応 |

既存ファイルの全面置換は行わない。`src/lib/editorial/`配下はすべて新規ディレクトリとして追加する。

---

## 4. `Artifact`の型

**v1→v2差分**: `absorbedCount`の用途を「Presentationへの入力」から「デバッグ・トレース専用」に変更する旨をコメントで明示。型自体の構造は変わらない。

```ts
// src/lib/editorial/artifact.ts

export type ArtifactMedia = "image" | "text";

interface BaseArtifact {
  /** 安定id。例: "photo:3" "text:concept" "text:menu:1" "text:review:0" */
  id: string;
  media: ArtifactMedia;
  /** Observation内での出現順。並び替えの根拠には使わない。Arrangeの決定的tie-breakにのみ使う。 */
  sourceOrder: number;
}

export interface ImageArtifact extends BaseArtifact {
  media: "image";
  url: string;
  /** Compressのデコード処理(dHash計算)の副産物として得られる。追加の取得コストは無い。 */
  width?: number;
  height?: number;
  /**
   * Compress前は常に0。Compressが「この1枚が何枚を代表しているか」を書き込む。
   * デバッグ・reasons[]トレース専用。Presentationの判定入力としては使わない
   * (「撮影枚数の多さ」と「情報としての重要度」は別物であり、混同するとバースト撮影
   * された1シーンが不当にviewport扱いされるリスクがあるため。9章参照)。
   */
  absorbedCount: number;
  requiresDisclosure?: string;
}

export interface TextArtifact extends BaseArtifact {
  media: "text";
  text: string;
  charCount: number;
  /** 画像と同様、デバッグ専用。Presentationの判定入力には使わない。 */
  absorbedCount: number;
}

export type Artifact = ImageArtifact | TextArtifact;

export function toArtifacts(brief: StoreBrief, contents: GeneratedWebsiteContents): Artifact[];
```

`toArtifacts()`が抽出するEditorial候補(Filter前の全量。まだeditorial/utility分離前):

- 画像: `brief.realData.photoUrls`(各URLを1件)、`brief.realData.supplementalImages`(各画像を1件、`requiresDisclosure`に`disclosure`文言を設定)
- テキスト: `contents.concept`、`contents.sections`(`kind`が`"about"|"feature"`のものを`splitBulletLines`で分割、既存`SignatureV2`/`StoryV2`と同じ分割関数を再利用)、`brief.realData.menuItems[].description`(存在し40文字以上のもののみ。名前だけ・短い説明はUtility側のメニュー一覧に委ねる)、`brief.realData.reviews[].text`

`toArtifacts()`自体は「これはEditorialでこれはUtility」を判断しない。分類はFilterの責務(次章)。

---

## 5. Utility ArtifactとEditorial Artifactの区別方法

区別は**フィールド単位の固定ルール**であり、内容やbrief内容による判断は一切行わない。

**常にUtility(Artifactを経由せず、`UtilityFacts`という別の単純な構造体に直接マッピングする)**:

```ts
export interface UtilityFacts {
  address?: string;
  phone?: string;
  openingHours?: string[];
  closedDays?: string;
  mapQuery?: string;
  googleMapsUrl?: string;
  instagramUrl?: string;
  googleRating?: number;
  googleReviewCount?: number;
  menuItems?: RealMenuItem[]; // 名前・価格の一覧。来店前に確認する実用情報として扱う
  contactMethods?: ContactMethod[];
  ctaHref?: string;
}
```

営業時間・住所・電話・地図・予約導線・SNS・評価件数・メニューの品目名と価格は、**内容に関わらず**常にここへ入り、`filter()`の対象(Compress/Arrange/Presentation)を一切通らない。既存`StoreRealData`のフィールド名からほぼ1:1でマッピングするだけの純関数(`buildUtilityFacts(brief, contents): UtilityFacts`)であり、判断ロジックを持たない。

**Editorial候補になり得るもの**: `toArtifacts()`が生成した画像・テキストArtifactのうち、上記Utilityフィールドの生成元になっていないもの全部(4章のリスト)。

この分離は「重要度」ではなく「情報の性質」による固定振り分けである点を明記する。メニューの品目説明(長文プロース)だけがEditorial候補になり、品目名・価格そのものはUtilityへ固定される。

---

## 6. `filter()`の入力・出力・責務

```ts
export interface FilterResult {
  editorial: Artifact[];
  utility: UtilityFacts;
}

export function filterArtifacts(brief: StoreBrief, contents: GeneratedWebsiteContents): FilterResult;
```

責務は以下の4点のみ(意味・重要度・ブランド性・主役の判断はしない):

1. **空データ・無効データの除外**: 空文字列テキスト、`charCount === 0`、無効URL(`canonicalizePhotoUrl`で正規化できないもの以外は許容。既存`dedupePhotoUrls`のフォールバック方針を踏襲)を除く。
2. **Editorial/Utility分離**: 5章の固定ルールをそのまま適用。
3. **技術上限の適用**: 画像は既存`selectDisplayPhotos`(重複排除+12枚均等サンプリング)をそのまま呼び出す。テキストには別途上限を設けない(実質的に`concept`1件+`about/feature`数件+メニュー説明+レビューで、経験上20件を超えることはない。上限超過時の安全策は7章のCompressで担保する)。
4. **既存の写真上限・URL重複排除との統合**: `photo-curation.ts`の`selectDisplayPhotos`をそのまま呼び出す(新規実装しない)。

`filterArtifacts`は元の`brief`/`contents`を変更しない(既存方針の踏襲)。

---

## 7. `compress()`の入力・出力・類似度方式

```ts
export interface CompressResult {
  artifacts: Artifact[]; // 代表のみ。absorbedCount(デバッグ用)が更新されている
}

export function compressArtifacts(editorial: Artifact[]): CompressResult;
```

責務は**重複除去のみ**。画像の意味分類・被写体推測は行わない。近似度が閾値を超えたクラスタを検出し、各クラスタから代表1件(クラスタ内で`sourceOrder`が最小のもの。決定的)を残し、`absorbedCount`にクラスタサイズ-1を加算する(4章の通り、この値はデバッグ専用でありPresentationには渡らない)。元データ(URL・テキスト)は書き換えない。

### 画像近似度: 方式比較

| 方式 | 追加依存 | ネイティブ依存 | Node/Next.js適合 | GH Actions適合 | 誤検出傾向 | 実装・テスト容易性 |
|---|---|---|---|---|---|---|
| **dHash(差分ハッシュ)手実装 + `jimp`でデコード** | `jimp`のみ | 無し | ◎ | ◎(ビルド不要) | リサイズ・軽微圧縮差に強い。回転には弱い(今回の用途では回転差は想定外なので許容) | ◎ 30〜40行、単体テストしやすい |
| pHash(`image-hash`パッケージ、内部で`jimp`使用) | `image-hash`+`jimp` | 無し | ○ | ○ | dHashよりやや高精度だがDCT計算がブラックボックス化 | △ 内部ロジックが外部依存、閾値調整の説明がしにくい |
| aHash(平均ハッシュ)手実装 | `jimp`のみ | 無し | ◎ | ◎ | グラデーション画像で誤検出しやすい(空・壁など単色に近い写真を誤って畳む恐れ) | ◎ 実装最小(20行) |
| `sharp`ベース(`sharp-phash`等) | `sharp` | **有り**(libvips) | ○(prebuiltあり) | △(ランナー種別によりビルド時間・キャッシュ増、将来のarch変更で壊れるリスク) | 高精度 | △ ネイティブ依存のデバッグコスト |
| 追加依存なし(URL文字列比較のみ、現状の`dedupePhotoUrls`を流用) | 無し | 無し | ◎ | ◎ | **「軽微なリサイズ」「色味だけ異なる画像」等、別ファイルだが視覚的に同一という要求ケースを検出できない** | ◎ だが要求仕様を満たさない |

**推奨: dHash手実装 + `jimp`(デコード専用)。**

理由: (1)ネイティブ依存が無くGitHub Actions/Next.jsどちらでもビルド不要、(2)アルゴリズム自体をリポジトリ内の純関数として書けるため`deterministic-hash.ts`と同じ思想(小さく・依存最小・決定的・単体テストしやすい)を維持できる、(3)pHashより実装が単純で「なぜこの2枚を畳んだか」を説明しやすい(距離値をそのままログ・テストに出せる)。aHashは実装がさらに単純だが、単色に近い店舗外観・内観写真での誤検出リスクが要求仕様の「構図が異なる画像は残す」に抵触するため採用しない。

具体的なdHashアルゴリズム: 画像を9×8グレースケールにリサイズ→隣接ピクセルの明度差の符号(64bit)をハッシュ化→2枚のハミング距離を計算→距離が閾値(初期値: 64bit中5以下、後述のテストケースで調整)以下なら同一クラスタ。デコード時に得られる元画像の`width`/`height`は`ImageArtifact`にそのまま書き込む(9章のPresentation判定で追加コスト無しに使う)。

`jimp`は新規依存になるため、Phase 3着手時に`npm view jimp`で現行バージョン・週間ダウンロード数・最終更新日を確認し、install size(`node_modules`への追加サイズ)をCIログで実測してから正式追加する。

### テキスト近似度: 方式比較

| 方式 | 追加依存 | 特徴 |
|---|---|---|
| **文字2-gramのJaccard係数(閾値0.92以上)** | 無し | 完全一致・空白句読点差を確実に検出しつつ、語彙が近いが内容の異なる文(「自家焙煎の深煎り」と「自家焙煎の浅煎り」等)を閾値を高く取ることで誤って畳まない |
| 文字列正規化+完全一致のみ | 無し | 実装最小だが「空白・句読点だけ異なる」以外の軽微な表記ゆれ(全角半角等)を取りこぼす |
| 単語n-gram/形態素解析ベース | 形態素解析器(`kuromoji`等) | 日本語の分かち書きが必要で依存が重くなる。今回の要求(ほぼ同一の重複表現のみ検出)には過剰 |

**推奨: 正規化(空白・句読点除去、NFKC正規化で全角半角統一)後の文字2-gram Jaccard係数、閾値0.92。** 追加依存なし。「似ているが意味の異なるテキスト」は0.92という高閾値により大半のケースで誤って畳まれない(Phase 4のテストケースで閾値を実データに対して検証する)。

---

## 8. `arrange()`のグラフ・距離モデル(指摘1への対応、レビュー第2版でさらに拡張)

**v1→v2差分**: `arrangeArtifacts`が単一の類似度最小化アルゴリズムに固定されていたのを、`ArrangeStrategy`という差し替え可能なインターフェースの上に構築する形へ変更。「リズム生成」を今回実装はしないが、型シグネチャで閉じないようにする。

**v2→v3差分(第2版レビュー反映)**: `ArrangeStrategy`を「コスト関数の差し替え」ではなく「経路生成アルゴリズム全体の差し替え」まで許容するインターフェースに拡張する。Rhythm(系列全体の履歴・位置・連続長を見る必要がある配置)はローカルなペアワイズコストだけでは表現できないため、`cost(a,b)`止まりのインターフェースでは将来閉じてしまうという指摘を反映。

```ts
/** 2つのArtifact(同一media限定)の「近さ」を返す。低いほど隣接を優先。 */
export type ArrangeCostFn = (a: Artifact, b: Artifact) => number;

/** 経路生成コンテキスト。将来の戦略が履歴・位置・連続長を参照できるようにするための引数。 */
export interface ArrangeContext {
  /** 決定的tie-break用のseed(deterministic-hash.tsへ渡す)。 */
  seed: string;
}

export interface ArrangeStrategy {
  name: string;
  /**
   * 経路生成そのものを担う。ClusterStrategyは内部でNearestNeighbor+2-optを
   * cost()経由で呼ぶが、将来のRhythmStrategyはcost()を経由せず、履歴・直前n件の
   * media種別・連続長を直接見て経路を組み立ててよい(この関数の内部実装は自由)。
   */
  buildPath(artifacts: Artifact[], ctx: ArrangeContext): Artifact[];
}

/**
 * 既定戦略。内部でNearestNeighbor+2-optアルゴリズムを、dHash/Jaccard距離を
 * costとして呼び出す(=類似度最小化=クラスタリング)。今回実装するのはこの1戦略のみ。
 */
export const clusterStrategy: ArrangeStrategy = {
  name: "cluster",
  buildPath(artifacts, ctx) {
    return nearestNeighborThenTwoOpt(artifacts, similarityCost, ctx.seed); // 内部ヘルパー、非公開
  },
};

/**
 * 将来の拡張点として型シグネチャ上は許容するが、今回は実装しない(20章)。
 * buildPath内で「直近k件の連続長」を見ながら、同一クラスタが続きすぎたら
 * 別クラスタから1件差し込む、といった系列全体を見た配置(A→B→A'→B'→A'')を
 * 直接組み立てる想定。cost()を経由する必要はない。
 * export const rhythmStrategy: ArrangeStrategy;
 */

export function arrangeArtifacts(compressed: Artifact[], strategy: ArrangeStrategy = clusterStrategy): Artifact[] {
  return strategy.buildPath(compressed, { seed: /* 呼び出し側のrequestId等 */ "" });
}
```

`arrangeArtifacts`自体は`strategy.buildPath`を呼ぶだけの薄い関数になる。`ClusterStrategy`は引き続き内部でNearestNeighbor+2-opt(下記)を`similarityCost`(7章のdHash/Jaccard距離)経由で使うが、これは「数ある実装のうちの1つ」という位置づけになり、将来`RhythmStrategy`を実装する際はローカルコストに縛られず、系列全体(履歴・位置・連続長)を直接見て経路を組み立てられる。指摘1の「インターフェースで閉じない」を、コスト関数レベルではなくアルゴリズムレベルで満たす。

同一種別内の連続抑制(8章末尾の「同一種別の過度な連続」)は、どの`strategy`を使っても**戦略とは独立に**後段で適用する安全弁として維持する(過度な単調さを防ぐ最終ガードであり、リズム戦略が実装された場合はこのガード自体の必要性が下がるが、当面は残す)。

使うのは以下3つの構造情報のみ(固定のカテゴリ順序は一切持たない):

1. **距離(distance)**: 同一メディア種別内でのみ計算する。画像同士は7章のdHashハミング距離、テキスト同士は7章のJaccard距離(=1-Jaccard係数)をそのまま再利用する(Compressと同じ関数、閾値だけが違う——Compressは「畳むか」の二値判定、Arrangeは「どれだけ近いか」の連続値)。これが`clusterStrategy.cost`の実体。
2. **連続性(continuity)**: 距離最小化そのものから自然に生まれる(専用の実装を持たない)。
3. **単調さの抑制(同一種別の過度な連続)**: 下記のメディア種別をまたいだマージ時のみ働く固定の上限本数ルール。

### 異なるメディア種別間の扱い(明示的な限界)

画像とテキストの間の「意味的な近さ」は、Vision/LLMを使わない現在の構成では正しく計算できない。**これを捏造しない。** 画像同士・テキスト同士はそれぞれ独立した経路順序(`arrangeArtifacts`をmedia別に2回呼ぶ)で並べ、種別をまたぐ配置は「意味」ではなく次の機械的なマージ規則だけで決める。

> 画像列とテキスト列をそれぞれ独立に並べた後、画像列を主系列としてマージする。マージ中、同一種別の連続数が固定上限(既定4、Presentation側の連続数抑制とは独立)に達した時点で、まだマージされていない他方の系列の先頭要素があればそこで1件だけ差し込む。他方の系列が尽きていれば差し込まない。

これは「N件ごとに必ずテキストを挟む」という固定リズムのテンプレートではない。上限に達した場合のみ発動する**上限であって周期ではない**(テキストが1件しかなければ1回しか発動しない。画像が3枚しかなければ一度も発動しない)。可読性のための書式規則(行の折り返しに近い)であり、意味判断ではない。

### 並び順アルゴリズム: 比較

| 方式 | 計算量(N≤20想定) | 12件程度での品質 | 決定性 | 実装・テスト容易性 | 採用可否 |
|---|---|---|---|---|---|
| **決定的最近傍法+2-opt改善(上限反復)** | 構築O(N²)、2-optは反復上限200回で打ち切りO(N²)〜 | 十分。N≤20では最近傍法単体でもほぼ妥当、2-optで局所的な逆転を解消 | 開始ノード・tie-breakを`deterministic-hash`で固定すれば完全に決定的 | ◎ 200行未満、各ステップを個別にテスト可能 | **採用** |
| 最小全域木(MST)ベースの順序化 | O(N² log N) | 良好だがEuler tour化の実装がやや複雑 | 決定的にできる | △ 実装量がNN+2-optより多い割に、N≤20では品質差が出にくい | 見送り |
| 階層クラスタリング後の順序化 | O(N³) 素朴実装 | 良好 | 決定的にできる(併合順のtie-breakに注意) | △ 実装・テストが最も重い | 見送り(将来N増加時の再検討候補) |
| 2-optのみ(初期順序=入力順) | O(N²)×反復 | 初期解が悪いと局所最適に落ちやすい | 決定的 | ○ | 見送り(最近傍法による初期解構築を省くと品質が不安定) |
| 元順序をそのまま採用 | O(1) | 既に否定済み(「編集ではなくシリアライズ」) | - | - | 不採用 |

**採用: `clusterStrategy.buildPath`の内部実装として、決定的最近傍法(開始ノードは`sourceOrder`最小、同距離tie-breakは`deterministic-hash`)で初期経路を構築 → 2-opt改善(隣接しない2辺の交換で`similarityCost`の総和が減る場合のみ採用、改善が無くなるか反復200回で終了)。**

安全性: N(Editorial Artifact数)は既存の12枚上限+テキスト実質20件未満により、実運用で30を超えることはまず無い。念のためN>60の場合は2-optを打ち切り最近傍法の結果のみ採用するガードを入れる(理論上の異常系にのみ効く安全弁で、通常経路には影響しない)。

「入力順の偶然性を引き継ぐ問題」への対処: 開始ノードの選定・完全同距離時のtie-breakにのみ`sourceOrder`/`deterministic-hash`を使う。これは「入力順を採用している」のではなく、複数の等価な解の中から決定的に1つを選ぶための最小限のtie-break(この設計を通じて一貫させてきた原則と同じ)。

---

## 9. `Renderable`アダプタ層(指摘4への対応・新設、レビュー第2版で`intent`を追加)

**v1→v2差分**: `Artifact`と`Presentation`の間に新規追加する層。v1にはこの章が存在しなかった。

**v2→v3差分(第2版レビュー反映)**: `Renderable`に`intent`フィールドを追加する。Presentationが`Renderable`からPrimitiveを決める前段に、「なぜこの塊として編集されたか」という編集意図を残しておくことで、将来Presentationの実装を作り直しても編集判断そのものは失われないようにする。

編集する最終単位は`Artifact`そのものではなく、`Artifact`を1件以上束ねた`Renderable`にする。今回の実装では束ね処理(複数Artifactを1つのRenderableへ合成するロジック)自体は実装しないが、型・パイプラインの繋ぎ目としてこの層を先に用意しておく。

```ts
// src/lib/editorial/renderable.ts

/**
 * 編集意図。Presentationが参照してよい唯一の「意味」に相当する情報。
 * 今回は束ね処理を実装しないため、全Renderableで"none"固定になる
 * (=Presentationの判定は10章の通り構造シグナルのみで行われ、実質的な変化は無い)。
 * 将来、複数Artifactを束ねる判断ロジックが入った際に、その判断根拠をここへ記録する。
 */
export type RenderableIntent = "focus" | "support" | "sequence" | "pair" | "none";

export interface Renderable {
  id: string;
  /** 長さ1が今回の実装における唯一のケース。将来、複数Artifactを束ねる処理がここに入る。 */
  artifacts: Artifact[];
  /** artifacts全体の媒体。今回は常にartifacts[0].mediaと一致する。将来の複数媒体混在束ねに備え"mixed"を型として持つ。 */
  media: ArtifactMedia | "mixed";
  /** tie-break用。artifacts中のsourceOrderの最小値。 */
  sourceOrder: number;
  /** 今回は常に"none"。将来の束ね処理が設定する。 */
  intent: RenderableIntent;
}

/** 今回の実装: 恒等変換(1 Artifact = 1 Renderable)。intentは常に"none"を設定する。 */
export function toRenderables(ordered: Artifact[]): Renderable[];
```

`assignPresentation`(次章)は`Artifact[]`ではなく`Renderable[]`を受け取るようにする。これにより、将来「写真2枚+短文1つ」を1つの表示単位として扱いたくなった場合、`toRenderables`の中身(束ねる判定ロジックと、それに伴う`intent`の設定)を差し替えるだけで済み、`Presentation`以降のコード・型は変更不要になる。今回のPhase 5では`toRenderables`は恒等変換+`intent:"none"`固定のみで、束ね判定ロジックは実装しない(20章)。

`intent`は今回のPresentation判定ロジック(10章)には一切使わない(常に`"none"`のため使いようがない)。将来`intent`が実質的な値を持つようになった時点で、10章の判定規則に`intent`を追加の構造シグナルとして組み込むかどうかを別途検討する。

---

## 10. `presentation()`のPrimitive型と割り当て規則(指摘2・所感1への対応)

**v1→v2差分**: (a) 入力を`Artifact[]`から`Renderable[]`に変更(9章)。(b) Primitive名を`inline/stack/full-width/viewport/caption`から`Occupy/Sequence/Isolate/Support/Pair`へ改名(所感1を採用、理由は後述)。(c) 画像の`Occupy`判定から`absorbedCount`を除外し、解像度・縦横比という技術的制約のみを使う(指摘2への対応)。

### Primitive命名の変更について

指摘で「`inline`/`stack`等はReact Component寄りのUI部品名であり、将来Canvas/PDF/動画に展開した際に作り直しになる」との指摘を受けた。これは妥当と判断し採用する。抽象的な配置意図を表す語彙に変更する。

```ts
export type PresentationPrimitive = "Occupy" | "Sequence" | "Isolate" | "Support" | "Pair";
```

| 新名称 | 意味 | 旧名称(参考) |
|---|---|---|
| `Occupy` | 主要な表示領域を占有する(画像・テキストどちらでも「その瞬間の主役」になる) | `viewport`(画像)・`full-width`(テキスト)を統合 |
| `Sequence` | 同種の並びの一部として連続的に現れる | `stack` |
| `Isolate` | 単独で、控えめな規模で現れる | `inline` |
| `Support` | 補助的・注釈的な役割 | `caption` |
| `Pair` | 2つのArtifactを束ねた`Renderable`に対してのみ発生する(今回は`Renderable`の束ね処理が恒等変換のみのため**未使用**。9章のRenderable層と直結する拡張点として型に用意する) | (新規) |

`Pair`のみ、他4つが「配置意図」であるのに対し「構造(2件束ねたRenderableに対してのみ発生する)」を表す名前になっており性質が異なる、との指摘を受けた。将来`Renderable`の束ね処理を実装する際、`Pair`を配置意図側の名前(例: `Compose`/`Composite`)へ改名することを検討する。今回は`Pair`自体が未使用(9章の通り束ね処理が恒等変換のみのため発生しない)であるため、型定義を変更する実害が無く、今すぐの改名は行わない。

`Occupy`が画像の`viewport`とテキストの`full-width`を統合した点は意図的な変更である。両者は媒体が違うだけで「その瞬間、画面上で最も支配的な表示になる」という同一の配置意図を持つため、Presentation層では1つの値として扱い、画像かテキストかによる実際のマークアップの違い(全画面画像 or 横幅いっぱいのテキストブロック)はRender層の責務とする(Presentationは「主役になる」という意図だけを渡す)。この統合により、「`Occupy`(画像)の直後に`Occupy`(テキスト)が来た」場合も同一Primitiveの連続としてカウントされ、支配的な表示が2つ連続する単調さを避ける対象になる(意図的な挙動)。

```ts
export interface PresentedRenderable {
  renderable: Renderable;
  primitive: PresentationPrimitive;
  /** テスト・デバッグ用: なぜこのPrimitiveになったかの根拠トレース。 */
  reasons: string[];
}

export function assignPresentation(ordered: Renderable[]): PresentedRenderable[];
```

**最小実装として`Pair`は今回未使用**(9章の通り束ね処理を実装しないため発生しない)。実質4種で運用する。

### 割り当て規則(絶対条件の決め打ちを避ける)

**画像(`Renderable.media === "image"`)**:
1. `Occupy`の技術的な適格条件のみで判定する: `width >= 1200`(既知の場合。7章の通りCompressのデコード時に副産物として得られる) かつ 縦横比が極端(3:1超等)でない。**`absorbedCount`はここで一切参照しない**(指摘2で述べた「撮影枚数≠情報量」の混同を避けるための削除)。低解像度の画像を無理にOccupyへ引き上げない、という純粋な表示品質上の制約として扱う。
2. `Occupy`適格のうち、直前のPresentedRenderableも`Occupy`かつ**同一Primitiveの連続数が既に2に達している**場合は`Sequence`へ降格する(sourceOrderによる決定的な選定)。
3. `Occupy`適格でなく、Renderable列上の隣接ノードも画像である場合 → `Sequence`。
4. どちらでもない場合 → `Isolate`。

**テキスト(`Renderable.media === "text"`)**:
1. `charCount >= 120` → `Occupy`候補。
2. `Occupy`候補のうち、直前も`Occupy`の場合(長文の連続を避ける) → `Support`へ降格。
3. それ以外 → `Support`。

`reasons`には例えば`["width=1600>=1200", "aspectRatio=1.4(non-extreme)", "prevPrimitive=Occupy,run=2,demoted-to-Sequence"]`のような文字列を積み、テストで`toContain`アサーションできる形にする。`absorbedCount`は`reasons`にも判定根拠としては含めない(4章の通りデバッグ専用フィールドとして`Artifact`側にのみ残す。Presentationの説明可能性ログには登場させない、という区別を明確にするため)。

---

## 11. `render()`への接続方法とMotionの導出(指摘3への対応)

**v1→v2差分**: Motion決定ロジックを`Presentation`層から`Render`層(コンポーネント内部)へ移す。`PresentedRenderable`型に`motion`フィールドは持たせない。

### 接続方法

```
Render:
  <main>
    {presented.map(p => <PresentedRenderableV2 key={p.renderable.id} {...p} theme={theme} />)}
  </main>
  <UtilityLayerV2 facts={utility} theme={theme} />
```

`PresentedRenderableV2`はPrimitiveごとに固定のTailwindクラス(既存`theme-v2.ts`のトークンを使用。新しい配色システムは作らない)を返す薄い分岐コンポーネント。`UtilityLayerV2`は既存`AccessHoursV2`(地図・営業時間・住所)、`CTAV2`/`MobileStickyCtaV2`(予約導線)の実務情報部分をそのまま呼び出す(コピー・書き換えではなく再利用)。

### Motionの依存方向

`assignPresentation`は`primitive`という値だけを返し、Motionについて一切関知しない。「`primitive`からどのモーションを起こすか」というマッピングテーブルは、Presentation層(`presentation.ts`)ではなく**Render層のコンポーネント自身**(`PresentedRenderableV2.tsx`内)に置く。

```tsx
// PresentedRenderableV2.tsx 内(擬似コード。Render層のみが知っている対応表)
const MOTION_BY_PRIMITIVE: Record<PresentationPrimitive, { variant: RevealVariant; delayMs: number }> = {
  Occupy: { variant: "scale", delayMs: 0 },
  Sequence: { variant: "fade-up", delayMs: 80 },
  Isolate: { variant: "fade", delayMs: 0 },
  Support: { variant: "fade", delayMs: 40 },
  Pair: { variant: "fade-up", delayMs: 0 },
};
```

この対応表がRender層の中に閉じていることで、将来Renderの実装(CSS Gridへの変更、Canvas/PDF出力への拡張等)が変わっても、Presentation層の型・ロジック(`presentation.ts`)は一切影響を受けない。依存の向きは常に`Render → Presentationの出力を参照する`であり、逆(`Presentation → Motion`)にはならない。

### Motion方式の比較と推奨(維持)

| 方式 | 内容 | 安定性 | 実装量 | 既存資産の再利用 |
|---|---|---|---|---|
| ① Primitive遷移から新規モーション値を都度計算(レイアウト差分の実測) | 隣接要素間の実測DOM座標差からtranslate/scale等を動的算出 | △ ビューポート幅・フォント読み込みタイミング・hydration順序に依存し、CI・実機で揺れが出やすい。Stage 1〜7で積み上げた「白画面回避」「12秒下限」等の録画品質担保が崩れるリスク | 大(新規モーションエンジンが必要) | 低(既存`RevealV2`/`ParallaxImageV2`を使わない) |
| ② 既存`RevealV2`/`ParallaxImageV2`を維持し、Render層内の対応表でPrimitiveごとにvariant/強度だけ変える | 上記コード例の通り | ◎ 既存コンポーネントはStage 6/7で実測検証済み(12.20秒等)。`prefers-reduced-motion`対応も既存のまま流用できる | 小 | 高 |

**推奨: ②(変更なし)。** 依存方向の修正(指摘3)は②の枠内で行っており、Motion方式自体の再検討ではない。①は引き続き安定性リスクが高いため見送る。

---

## 12. 既存実装との関係(資産ごとの処遇)

| 資産 | 処遇 | 理由 |
|---|---|---|
| `deterministic-hash.ts` | **そのまま残す** | Arrangeのtie-break、Compressの代表選定tie-breakに直接再利用。変更不要 |
| `photo-curation.ts`(`selectDisplayPhotos`/`dedupePhotoUrls`) | **そのまま残す** | Filterの技術上限適用にそのまま呼び出す。URL重複排除(文字列レベル)とCompress(画素レベル)は別の関心事として両方必要 |
| `photo-strategy.ts`の`classifyPhotoTier` | **そのまま残す**(直接の利用箇所は無くなるが、他の統計目的等で残しても無害) | 分類自体は構造情報として無害 |
| `photo-strategy.ts`の`buildPhotoPlan` | **縮小して残す**: 関数は削除せず`@deprecated`コメントを付け、新パイプライン未接続の既存経路からの参照が無くなり次第、後続フェーズで削除を検討 | 一気に削除すると既存テスト・既存呼び出し元(`v2-connector.ts`,`section-plan-v2.ts`)を同時に壊すため。役割(Hero1枚/Story1枚/Gallery残り)の固定割当は新Arrange/Presentationが代替するため、今回のPhase 6接続では使わなくなるが、コードとしては残し安全に廃止時期を分離する |
| `archetype-heuristics.ts`(`deriveArchetypeDecision`) | **今回は触れず、後続フェーズで整理する** | archetype/paletteHintは「配色・書体という装飾テーマ選択」としては新設計と直接矛盾しない(Renderの配色決定に使う分には可)。一方`brandArchetype`が`section-plan-v2.ts`のセクション有無判断に使われている部分は、新Filterの「データ有無のみで判定」に役割が置き換わる。両者が絡み合っているため、archetype自体の廃止判断は本設計のスコープ外とし、Phase 6接続後に改めて整理する |
| `v2-connector.ts`(`derivePhotoPlanFromBrandPlan`) | **今回は触れず、後続フェーズで整理する** | BrandPlan(OpenAI経路)のphotoAssignments(hero/story/reject等の役割)は、Vision/意味分類を使わないという新設計の前提と原理的に矛盾する。ただしOpenAI未接続時(既定のrule-provider経路)には影響しないため、緊急性は無い |
| `section-plan-v2.ts`(`buildCafeV2Plan`) | **段階的に廃止する(ただし今回のPhaseでは実施しない)**: Phase 6では新パイプラインを既存関数と**並行稼働**させ、既存の`blocks`配列ベースの描画はそのまま残す | 一気に置換するとv2の全既存テスト・全既存レンダリングパスに影響するため。並行稼働により、新パイプラインの出力を検証してから既存経路を段階的に縮退できる |
| `v2-design-system.ts` / `theme-v2.ts` | **そのまま残す** | 配色・書体・surface質感というRender層の装飾トークン供給元として今回も利用する。変更しない |
| `WebsiteRendererV2.tsx` | Phase 6でのみ、新パイプライン出力を試験的に描画する分岐を**追加**(既存`blockRenderer`方式は残す) | 全面置換の回避 |
| 各v2セクションコンポーネント(`HeroV2`等) | Editorial側は新しい`PresentedRenderableV2`に段階的に置き換わっていく想定だが、**今回のPhaseでは変更しない**。Utility側相当(`AccessHoursV2`の地図/時間/住所描画、`CTAV2`/`MobileStickyCtaV2`の予約導線)はそのまま`UtilityLayerV2`から呼び出して**再利用**する | 実務情報描画は既に「意味判断なしに実データをそのまま出す」実装のため、新設計の哲学と矛盾なく再利用できる |
| `record-demo-video.ts` | **変更しない**(Phase 2動画基盤には着手しない、との指示通り) | Motionが既存`RevealV2`/`ParallaxImageV2`を再利用する設計(11章)のため、録画スクリプト側の無改修での動作を最終検証フェーズで1本録画して確認する |

---

## 13. v1への影響

無し。すべての新規ファイルは`neumos-ai/src/lib/editorial/`・`neumos-ai/src/components/website-v2/editorial/`配下に限定し、v1(`src/components/website/`, `src/lib/preview/render.ts`, root MVPの`src/`)からは一切参照されない。各フェーズで`git diff --stat`によりv1配下の差分が0件であることを確認する(既存の完了フェーズと同じ確認方法)。

## 14. DB・API契約への影響

無し。`StoreBrief`/`StoreRealData`/`GeneratedWebsiteContents`/`BrandPlan`のいずれの型定義も変更しない。Supabaseへの保存形式・カラムも変更しない(Compress結果等の永続化は行わず、都度計算する方針のため、そもそも保存先が不要)。

## 15. パフォーマンス上のリスク

- **画像デコードのレンダー時コスト**: Compressの画像近似度判定(dHash)は実際に画像バイト列をフェッチ・デコードする必要があり、これを**ページ表示のたびに**行うと、外部ホストされた写真への都度フェッチが発生し、レイテンシ・帯域コストが無視できなくなるおそれがある。
  - 対処案A(今回採用): DBスキーマ変更が禁止されているため結果の永続化はできない。上限が既存Filterで12枚に絞られた後の集合のみを対象にし、実測レンダー時間をPhase 8の最終検証で計測する。許容範囲を超える場合は次点へ。
  - 対処案B(将来検討・今回未着手): メモリ内(プロセス内)の短期TTLキャッシュをrequestId単位で持つ。永続化ではなくプロセス内キャッシュのためDBスキーマには触れない。
- **Arrangeの2-opt反復**: N≤20想定では無視できるレベルだが、8章の安全弁(N>60でスキップ)により理論上の異常系でも上限を超えない。
- **Renderable変換**: 今回は恒等変換のみのためコストは無視できる。

## 16. 依存パッケージ追加の有無

**有り。`jimp`(画像デコード専用)を新規追加する。** それ以外(テキスト類似度・グラフ最適化・ハッシュ)は追加依存なしで実装する。Phase 3着手時に現行バージョン・保守状況・install size(実測)を確認し、CI(GitHub Actions)上で`npm ci`が問題なく通ることを確認してから正式に`package.json`へ追加する。

## 17. セキュリティ上のリスク

- 画像フェッチ(dHash計算のため)は既存の写真URL(Google Places由来またはユーザーアップロード由来、既にアプリが信頼している送信元)のみを対象にし、新たな外部入力を追加しない。フェッチ先URLは既存`brief.realData.photoUrls`に実在するもの(=既に生成時に確認済みのURL)に限定し、任意のURLを新たにフェッチしない。
- `jimp`によるデコードは信頼できない画像データ(不正なバイト列)に対して例外を投げる可能性があるため、Compress全体をtry/catchで保護し、デコード失敗時は当該画像を「畳めない=そのまま残す(absorbedCount=0)」扱いにフォールバックする(パイプライン全体をクラッシュさせない、既存の`v2-connector.ts`の防御的try/catch方針を踏襲)。
- 依存追加(`jimp`)によるサプライチェーンリスクは、`npm audit`をCIに含める(既存CI構成の確認・必要なら追加)。

## 18. ロールバック方法

新規ファイルはすべて独立ディレクトリ(`src/lib/editorial/`等)に閉じているため、Phase 6の「限定接続」コミットのみを`git revert`すれば、既存の`WebsiteRendererV2.tsx`の描画は完全に元の状態へ戻る。Phase 1〜5(型・Filter・Compress・Arrange・Renderable・Presentation)はv2 Rendererから未接続の状態であれば、存在していてもv2ページの実際の表示には一切影響しないため、ロールバックの緊急性があるのはPhase 6以降のみ。

## 19. 最小実装と理想実装の差、および所感2点への回答

| 項目 | 最小実装(今回) | 理想実装(将来) |
|---|---|---|
| 画像近似度 | dHash(1アルゴリズムのみ) | 複数アルゴリズムのアンサンブル、回転・トリミング耐性の向上 |
| Arrange戦略 | `clusterStrategy`のみ | `rhythmStrategy`等の追加(8章で型は用意済み) |
| Renderableの束ね | 恒等変換のみ | 複数Artifactを1つの表示単位へ合成するロジック |
| Presentation Primitive | 4種使用(`Pair`は型のみ) | `Pair`の実利用、テキスト-画像近接判定の高度化 |
| Motion | 既存コンポーネントのvariant/強度切り替え(Render層内) | Primitive遷移からの直接算出(11章の方式①) |
| Compress結果の再利用 | 都度計算(永続化なし) | プロセス内/エッジキャッシュ |
| メディア間マージ | 固定上限本数によるマージ | Vision/LLM接続時の真の意味距離(将来、外部API利用の可否を別途要検討) |
| section-plan-v2.ts | 並行稼働(未廃止) | 新パイプラインへの完全移行、旧コードの削除 |

### 所感「Phase 0: Artifactだけを眺める期間」について

正式なPhaseとしては追加しないという判断をした。理由: Phase 1〜5(Artifact/Filter/Compress/Arrange/Renderable/Presentation)は、いずれもReact/UIに一切依存しない純関数として設計されており(各フェーズのテストはJSON相当の構造体を直接アサーションする)、実質的に「UIに繋ぐ前にArtifact・Renderable・Presentationの出力だけを確認できる期間」を各フェーズの中に既に内包している。Phase 6(v2 Renderer接続)まで一切UIに触れない、という設計自体が指摘の意図を満たしていると判断した。ただし、明示的な観察期間(例えば実データに近い合成ブリーフ数十件に対してPresentation出力のJSONスナップショットを目視レビューする回)を挟みたい場合は、Phase 5とPhase 6の間に追加の確認ステップとして設けることは可能なので、必要であれば指示いただきたい。

## 20. 過剰設計を避けるため今回実装しないもの

- `Pair`Primitiveの実利用、および`Pair`の`Compose`/`Composite`への改名(`Renderable`の複数Artifact束ね処理そのものが今回未実装のため)
- `Renderable.intent`の実質的な設定ロジック(今回は常に`"none"`固定)
- `rhythmStrategy`の実装(8章で`ArrangeStrategy.buildPath`として型のみ用意)
- Motion方式①(レイアウト差分からの直接算出)
- Compress/Arrangeの結果を永続化するキャッシュ層
- MST・階層クラスタリングによるArrange(N≤20では最近傍法+2-optで十分)
- archetype-heuristics.ts / v2-connector.ts / section-plan-v2.ts の削除・書き換え(後続フェーズ)
- 動画録画基盤(`record-demo-video.ts`)への変更

---

## 21. 必須テスト設計

### Filter (`tests/editorial-filter.test.ts`)
空Artifact/不正URL/Utility分類/Editorial分類/写真0枚/1枚/12枚/13枚以上/元配列非破壊/同一入力→同一出力。

### Compress (`tests/editorial-compress.test.ts`)
完全同一画像/軽微なリサイズ/軽微な圧縮差/色味だけ異なる画像/構図が異なる画像(畳まれないこと)/完全同一テキスト/空白句読点だけ異なるテキスト/類似だが意味の異なるテキスト(誤って畳まれないこと)/代表Artifactとabsorbed件数の整合/元データ非破壊/決定性(同一入力を2回実行し同一出力)/500件入力時の実行時間。

### Arrange (`tests/editorial-arrange.test.ts`)
0件/1件/2件/複数クラスタ/全Artifactが互いに類似/全Artifactが互いに非類似/画像のみ/テキストのみ/画像とテキスト混在/同一種別の過度な連続(マージ上限の発動確認)/同一入力→同一順序/入力順を変えても妥当な順序に収束するか/12件程度での実行速度/`strategy`未指定時に`clusterStrategy`と同一結果になること(既定動作の後方互換確認)。

### Renderable (`tests/editorial-renderable.test.ts`)
恒等変換の正しさ(件数・順序が保たれる)/`media`が`artifacts[0].media`と一致すること/`sourceOrder`が正しく引き継がれること/`intent`が常に`"none"`であること(今回の実装範囲の回帰テスト)。

### Arrange戦略の差し替え可能性(`tests/editorial-arrange.test.ts`に追加)
自作のダミー`ArrangeStrategy`(`buildPath`が固定順序を返すだけの単純な実装)を`arrangeArtifacts`に渡した場合、`clusterStrategy`を経由せずその通りの順序が返ること(=`arrangeArtifacts`が`clusterStrategy`にハードコードされていないことの確認)。

### Presentation (`tests/editorial-presentation.test.ts`)
各Primitiveへの到達可能性(`Pair`除く)/不可能な組み合わせが発生しないこと/同一Primitiveの不自然な連続回避/短文長文/横長縦長正方形画像/absorbedCountの値に関わらずOccupy判定が解像度・縦横比のみで決まること(指摘2の回帰テスト)/`reasons`の追跡可能性/`reasons`に`absorbedCount`が判定根拠として含まれないこと/同一入力→同一結果。

### Render (`tests/editorial-render.test.tsx`)
Utility Layer常時表示/Editorial Artifact空でも成立/写真0枚1枚12枚で成立/スマホ表示/黒画面白画面が無い/レイアウト崩れなし/v1への影響なし/実データ表示規則(捏造禁止)の遵守/Motion対応表がPresentedRenderableV2内に閉じており`presentation.ts`が`motion`を一切import/exportしないこと(指摘3の回帰テスト)。

---

## 22. 実装フェーズ

各フェーズを個別コミットとし、都度: 該当テスト → `npm run typecheck`(neumos-ai) → `npm test`(neumos-ai全テスト) → 必要に応じ`npm run build` → `git diff --stat`でv1配下差分0件確認、を実行する。

1. **Artifact型と変換処理**: `artifact.ts`(`toArtifacts`) + テスト
2. **Filter**: `filter.ts`(`filterArtifacts`, `buildUtilityFacts`) + テスト
3. **Compress**: `similarity.ts`(dHash実装、`jimp`追加) + `compress.ts` + テスト
4. **Arrange**: `arrange.ts`(`ArrangeStrategy`、`clusterStrategy`、最近傍法+2-opt) + テスト
5. **Renderable + Presentation**: `renderable.ts`(恒等変換) + `presentation.ts` + テスト
6. **v2 Rendererへの限定接続**: `PresentedRenderableV2`/`UtilityLayerV2`作成、`WebsiteRendererV2.tsx`に試験的分岐を追加(既存経路は残す)
7. **Motion調整**: `PresentedRenderableV2`内にPrimitive→variant/delayMs対応表を実装(既存`RevealV2`/`ParallaxImageV2`を呼び出すのみ)
8. **統合検証**: 23章の検証を実施

---

## 23. 最終デザイン検証(実装後に実施)

外部API・本番データ・本番Supabase不使用。合成画像・ローカルデータのみ。

**用意する入力ケース**:
1. ほぼ同一画像が大量にあるケース(Compressの主目的を検証)
2. 全画像が明確に異なるケース(誤って畳まれないことを検証)
3. 画像と短文が混在するケース(Arrangeのメディア間マージを検証)
4. 長文中心のケース
5. 写真0枚のケース
6. Utility情報だけが充実しているケース(Editorial Artifactが空でも成立することを検証)

各ケースでスマートフォン表示のスクリーンショットを取得。少なくとも1本のデモ動画を生成し、冒頭・中盤・終盤のフレームを確認する(`record-demo-video.ts`は無改修のまま使用)。

---

## 24. 完了報告フォーマット(実装完了後に提出予定)

変更ファイル/コミット一覧/追加依存/Filter仕様/Compress仕様/Arrangeアルゴリズム(採用したstrategy)/Renderableの実装範囲/Presentation Primitive仕様/Renderへの接続方法/Motionの扱いと依存方向/Utility Layerの挙動/before-after比較/スクリーンショット/動画実測値/テスト結果/CI結果/v1への影響/DB・API契約への影響/パフォーマンス/残っている問題/Phase 2へ進める状態か。

---

## 対応表(依頼26項目 → 本書の章)

1→2, 2→3, 3→4, 4→5, 5→6, 6→7, 7→7, 8→7, 9→8, 10→8, 11→8, 12→10, 13→10, 14→11, 15→11, 16→12, 17→13, 18→14, 19→15, 20→16, 21→17, 22→22, 23→21, 24→18, 25→19, 26→20
