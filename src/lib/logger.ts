/**
 * 最小限の構造化ロガー。
 * - 実運用では Vercel ログ / 外部ログ基盤に流す前提で JSON 1行出力。
 * - レベルと文脈(context)を付与し、後から検索しやすくする。
 */
type LogLevel = "debug" | "info" | "warn" | "error";

function emit(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(context ? { context } : {}),
  };
  // 開発時は読みやすく、本番(JSON)でも壊れない形で出力。
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (m: string, c?: Record<string, unknown>) => emit("debug", m, c),
  info: (m: string, c?: Record<string, unknown>) => emit("info", m, c),
  warn: (m: string, c?: Record<string, unknown>) => emit("warn", m, c),
  error: (m: string, c?: Record<string, unknown>) => emit("error", m, c),
};
