/**
 * Phase 1 MVP: Neumos AIが生成したサイト（v1 `/preview/{requestId}` /
 * v2 `/preview/{requestId}/v2`）を、指定URLに対してPlaywrightで縦長ビューポート
 * で開き、自然なスクロールだけを行いながら録画し、MP4として書き出す
 * ローカル専用スクリプト。
 *
 * スコープ（Phase 1で意図的に含めないもの）:
 *  - GitHub Actions等でのオーケストレーション（Phase 2）
 *  - Supabase Storageへの保存・DBへのメタデータ記録（Phase 2）
 *  - トリガーUI（Phase 2）
 *  - BGM・テロップ・演出の作り分け（Phase 3）
 * ここでは「録画→MP4化」という核となる技術リスクだけを検証する。
 *
 * 責務の分離（保守性のための設計）:
 *  1. 録画（Playwright標準の`recordVideo`。手動フレームキャプチャは行わない）
 *  2. エンコード（ffmpeg-static。webm→mp4のH.264/AAC変換のみを担当）
 * 将来のBGM・テロップ追加は(2)のffmpeg呼び出しにフィルタを足すだけで済み、
 * (1)の録画ロジックには触れない設計にしている。
 *
 * 使い方:
 *   npm run record-demo -- --url http://localhost:3100/preview/<requestId>/v2
 *   npm run record-demo -- --url <URL> --out ./scripts/demo-video-output/demo.mp4
 *
 * 環境変数:
 *   PLAYWRIGHT_CHROMIUM_PATH … 任意。設定時はこのパスのChromiumバイナリを使う
 *     （通常は不要。`npx playwright install chromium`で入るブラウザを自動解決する）。
 */
import { chromium } from "playwright";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

const execFileAsync = promisify(execFile);

interface Args {
  url: string;
  out: string;
  width: number;
  height: number;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : undefined;
  };

  const url = get("--url");
  if (!url) {
    throw new Error("--url は必須です（例: --url http://localhost:3100/preview/<requestId>/v2）");
  }

  const width = Number(get("--width") ?? 390);
  const height = Number(get("--height") ?? 844);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("--width / --height は正の数値で指定してください");
  }

  const defaultOut = path.join(
    __dirname,
    "demo-video-output",
    `demo-${new Date().toISOString().replace(/[:.]/g, "-")}.mp4`
  );
  const out = get("--out") ?? defaultOut;

  return { url, out, width, height };
}

/**
 * ヘッダー→CTA→本文…と自然に見えるよう、一定間隔で小刻みにスクロールする。
 * 実際の閲覧者の指の動きに近づけるため、瞬間ジャンプではなく短いウェイトを
 * 挟んだ複数回のホイール操作にする。ページの実高さから歩数を決めるが、
 * 極端に長いページで録画が延々続かないよう、合計スクロール時間に上限を設ける。
 */
async function scrollThroughPage(page: import("playwright").Page, viewportHeight: number): Promise<void> {
  const MAX_SCROLL_MS = 10_000;
  const STEP_DELAY_MS = 220;
  const stepSize = Math.round(viewportHeight * 0.55);

  await page.waitForTimeout(700); // 初期表示・フォント・画像読み込みが落ち着くのを待つ

  const started = Date.now();
  while (Date.now() - started < MAX_SCROLL_MS) {
    const { scrollY, scrollHeight, clientHeight } = await page.evaluate(() => ({
      scrollY: window.scrollY,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    }));
    const reachedBottom = scrollY + clientHeight >= scrollHeight - 4;
    if (reachedBottom) break;

    await page.mouse.wheel(0, stepSize);
    await page.waitForTimeout(STEP_DELAY_MS);
  }

  await page.waitForTimeout(900); // 最後の見え方で少し静止してから録画終了
}

async function convertToMp4(webmPath: string, outPath: string): Promise<void> {
  await mkdir(path.dirname(outPath), { recursive: true });
  await execFileAsync(ffmpegPath, [
    "-y",
    "-i",
    webmPath,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-preset",
    "veryfast",
    "-movflags",
    "+faststart",
    outPath,
  ]);
}

async function findRecordedWebm(dir: string): Promise<string> {
  const files = (await readdir(dir)).filter((f) => f.endsWith(".webm"));
  if (files.length === 0) {
    throw new Error(`録画ファイル(.webm)が${dir}に見つかりませんでした`);
  }
  // このスクリプトは1ページしか開かないため、通常は1件のみ。
  // 万一複数あった場合は録画時間が最も長い（＝メインの録画である可能性が高い）ものを使う。
  const withStats = await Promise.all(
    files.map(async (f) => {
      const full = path.join(dir, f);
      const s = await stat(full);
      return { full, size: s.size };
    })
  );
  withStats.sort((a, b) => b.size - a.size);
  return withStats[0].full;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const videoDir = await mkdtemp(path.join(tmpdir(), "neumos-demo-video-"));

  console.log(`[record-demo] URL: ${args.url}`);
  console.log(`[record-demo] viewport: ${args.width}x${args.height}`);
  console.log(`[record-demo] 出力先: ${args.out}`);

  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
  });

  try {
    const context = await browser.newContext({
      viewport: { width: args.width, height: args.height },
      recordVideo: { dir: videoDir, size: { width: args.width, height: args.height } },
    });
    const page = await context.newPage();

    console.log("[record-demo] ページを読み込み中...");
    await page.goto(args.url, { waitUntil: "networkidle", timeout: 30_000 });

    console.log("[record-demo] スクロール録画中...");
    await scrollThroughPage(page, args.height);

    console.log("[record-demo] 録画を確定中（コンテキストを閉じています）...");
    await context.close();

    const webmPath = await findRecordedWebm(videoDir);
    console.log(`[record-demo] 録画完了: ${webmPath}`);

    console.log("[record-demo] MP4へ変換中(ffmpeg)...");
    await convertToMp4(webmPath, args.out);

    const finalStat = await stat(args.out);
    if (finalStat.size === 0) {
      throw new Error("変換後のMP4ファイルサイズが0バイトです（エンコード失敗の可能性）");
    }
    console.log(`[record-demo] 完了: ${args.out} (${(finalStat.size / 1024).toFixed(1)} KB)`);
  } finally {
    await browser.close();
    await rm(videoDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("[record-demo] 失敗しました:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
