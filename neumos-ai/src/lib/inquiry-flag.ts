/**
 * 問い合わせ機能全体の公開可否フラグ。秘密値ではなく単純なON/OFFスイッチ。
 * `"true"`の完全一致（trim後）のみ有効。未設定・空・大文字小文字違い・
 * その他の値は全て無効として扱う。
 *
 * INQUIRY_HASH_SALT・schema.sqlの適用・自動/承認済み手動削除運用の準備が
 * 整う前にこのコードがmainへ入っても、壊れたフォーム（送信できない・
 * 削除されない問い合わせが溜まり続ける等）を公開しないための保険。
 * Productionでtrueにする前提条件はREADMEを参照。
 */
export function isInquiryFeatureEnabled(): boolean {
  return process.env.INQUIRY_ENABLED?.trim() === "true";
}
