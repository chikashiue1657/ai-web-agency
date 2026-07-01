/**
 * 業務エラー。API層でHTTPステータスに対応づけて扱う。
 * services / places など複数モジュールから参照するため独立ファイルに置き循環参照を避ける。
 */
export class ServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 400
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
