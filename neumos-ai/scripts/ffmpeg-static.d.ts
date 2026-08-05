/**
 * ffmpeg-staticはビルド済みffmpegバイナリへの絶対パス文字列を1つだけ
 * default exportするパッケージで、型定義(.d.ts)を同梱していない。
 * このスクリプト配下でだけ使うため、最小限のアンビエント宣言をここに置く。
 */
declare module "ffmpeg-static" {
  const ffmpegPath: string;
  export default ffmpegPath;
}
