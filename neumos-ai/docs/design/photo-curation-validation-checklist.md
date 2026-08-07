# Photo Curation 実データ検証チェックリスト

Phase 1（`editorial/` 計算プリミティブ + `photo-curation.ts` への責務統合）は
`agent/demo-video-phase0-1` ブランチでクローズした。本ドキュメントはPhase 2を
始める前に必要な**検証計画**であり、実装ではない。ここに書かれた項目は
「アルゴリズムが正しいか」ではなく「プロダクトとして成立するか」を確認する
ためのものであり、Phase 2はこの検証で見つかった事実から始めるべきである。

## 対象範囲

検証対象は `compressPhotoUrls` / `orderGalleryPhotos`
(`src/lib/engine/photo-curation.ts`) と、その基盤となる
`src/lib/editorial/{similarity,compress,arrange,gallery-layout}.ts`。
v1テンプレート・DBスキーマ・APIコントラクトは対象外（変更しない）。

## 検証規模

- 10店舗
- 50店舗
- 200店舗

段階的に規模を広げ、各段階で下記の観点を確認する。小規模で問題が出た場合は
規模を広げる前に修正する。

## 各店舗ごとに確認する観点

- **Hero duplication**: HeroとGalleryに知覚的に同一/酷似した写真が重複して
  出ていないか
- **Gallery diversity**: Galleryが「似た構図の羅列」になっていないか
  （バースト撮影の後の残存パターンを含む）
- **Burst-photo reduction**: 連写・エクスポート違いの写真群が適切に1枚へ
  畳まれているか（畳みすぎ・畳まなすぎ両方を確認）
- **Dark-image behavior**: 暗所写真でdHash判定が破綻していないか
  （誤って別写真と誤判定/同一判定していないか）
- **Portrait/Landscape mix**: 縦横比が混在する店舗でOccupy/Sequence判定が
  不自然に偏らないか
- **Single-photo stores**: 写真が1枚しかない店舗でIsolate判定・Hero/Gallery
  分担がクラッシュなく成立するか
- **Zero-photo stores**: 写真が0枚の店舗でパイプライン全体が安全に空配列を
  返し、既存v2のフォールバック表示が機能するか
- **Performance**: 写真枚数が多い店舗（50枚・200枚規模の入力）で
  `compressPhotoUrls`/`orderGalleryPhotos` の実行時間が許容範囲か
  （`selectDisplayPhotos`の12枚上限より前段の重複排除コストを含む）
- **Visual regression**: 既存v2（Phase 1適用前の表示）と比較して、
  見た目が改善しているか、少なくとも悪化していないか

## 検証データの制約

このプロジェクトの標準制約（外部API不使用・本番Supabase不使用・
本番環境不使用・ローカルのみ・追加費用ゼロ・データ捏造禁止）は本検証でも
維持する。「実店舗データ」を使う場合も、本番DBへの接続や外部APIの実呼び出し
を伴わない形（synthetic画像 + 実際にありそうな枚数・構図パターンの再現）で
実施方法を別途具体化する。

## Phase 2の起点

Phase 2は、上記検証で見つかった事実（例: 特定条件でHero重複が再発する、
暗所写真でdHashが機能しない、200枚規模で性能が劣化する等）から着手する。
検証前にアルゴリズムの拡張・新機能追加を先行させない。
