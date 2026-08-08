/**
 * `request.text()`は本文を全て読み切ってからでないとサイズ判定できないため、
 * `Content-Length`ヘッダー（自己申告・詐称/省略可能）が信用できない場合、
 * 実際のサイズに関わらず全文が一旦メモリへバッファされてしまう。
 * ここではReadableStreamを手動で読み進め、累積バイト数が上限を超えた
 * 時点で即座に読み取りを打ち切る。Vercel Functionsのプラットフォーム側の
 * ボディサイズ上限はあくまで補助防御であり、この関数がアプリ側の主防御。
 */
export class BodyTooLargeError extends Error {
  constructor() {
    super("Request body exceeds the allowed size");
    this.name = "BodyTooLargeError";
  }
}

export async function readBodyWithLimit(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number
): Promise<string> {
  if (!body) return "";

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // cancel自体の失敗はサイズ超過の判定を変えない。読み取りはどのみち
          // ここで打ち切るため、BodyTooLargeErrorを投げることを優先する。
        }
        throw new BodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
}
