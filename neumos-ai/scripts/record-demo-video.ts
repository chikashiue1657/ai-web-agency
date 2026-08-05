/**
 * Phase 1 MVP: Neumos AIが生成したサイト（v1 `/preview/{requestId}` /
 * v2 `/preview/{requestId}/v2`）を、指定URLに対してPlaywrightで縦長ビューポート
 * で開き、自然なスクロールだけを行いながら録画し、MP4として書き出す
 * ローカル専用スクリプト。
 *
 * 録画品質（Phase 1改善分）:
 *  - 録画前にウォームアップ読み込みを1回行い、フォント適用・画像デコード・
 *    （初回アクセス時のみ発生し得る）サーバー側の初期化コストを先に消化する。
 *  - フォント適用・img要素の読み込み完了・2フレーム分の描画確定を明示的に
 *    待ってから録画上のスクロールを開始する。
 *  - 録画コンテキストでのページ読み込み〜レンダリング完了までに実際に
 *    かかった時間を計測し、MP4変換時にその区間をffmpegの入力側`-ss`で
 *    トリムする。写真枚数が多い等で読み込みに数秒かかるページでは、
 *    ウォームアップ後でも録画コンテキスト側の読み込みは（Playwrightの
 *    コンテキスト分離によりキャッシュを共有しないため）改めて発生するが、
 *    その区間を最終MP4から取り除くことで、白画面・読み込み中の状態が
 *    出力に含まれないようにする（実際に写真500枚のページで録画冒頭が
 *    白画面になる不具合を検証で発見し、この対策で解消したことを確認済み）。
 *  - `reducedMotion: "reduce"`で録画し、scroll-revealのフェード演出を無効化
 *    する（演出自体はv2側のコードを変更せず、既存のprefers-reduced-motion
 *    対応をそのまま利用するだけ）。
 *  - スクロールはease-in-outカーブに沿った自然な加速・減速で行い、ページ最下部
 *    （CTA/店舗情報）まで到達してから終了する。
 *  - 動画の合計時間は、短いページでも12秒を下回らず、長いページでも30秒を
 *    超えないようにする。開始・終了それぞれに1.8秒の静止を必ず入れる。
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
 * ページ本体（フォント・画像・レイアウト）が実際に描画し終わるまで待つ。
 * `waitUntil: "networkidle"`だけでは「通信が落ち着いた」ことしか分からず、
 * Webフォントの適用やimg要素のデコード完了までは保証しないため、録画開始前に
 * ここで明示的に確認する（開幕が白画面・部分描画のまま録画されるのを防ぐ）。
 */
async function waitForRenderReady(page: import("playwright").Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete));
  // フォント適用やimg完了直後は、ブラウザがまだそのフレームを塗り終えていない
  // ことがあるため、2フレーム分描画を進めてから戻ってくるのを待つ。
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      })
  );
}

interface ScrollTiming {
  /** 開幕の静止時間(ms)。CTA等が写る前にスクロールが始まらないための下限。 */
  startHoldMs: number;
  /** スクロール自体に使う時間(ms)。ページ実高さが無い（=スクロール不要）場合は0。 */
  scrollMs: number;
  /** 終端（CTA/店舗情報）の静止時間(ms)。動画の合計最短時間はここで吸収する。 */
  endHoldMs: number;
}

/**
 * 動画の合計時間が「短いページでも最低12秒、長いページでも最大30秒」に
 * 収まるよう、スクロール時間と終端静止時間を決める。
 *
 * `elapsedBeforeHoldMs`は、録画コンテキスト作成〜ページ読み込み〜
 * waitForRenderReady完了までに実際にかかった時間（＝録画ファイルに既に
 * 写り込んでいる時間）。写真枚数が多い等でこの読み込み自体に数秒かかる
 * ページでは、この時間を差し引かずにスクロール予算を決めると、合計時間が
 * 30秒を超えてしまう（実測で確認した）。そのため上限側の予算計算にだけ
 * この経過時間を反映する。
 *
 * スクロール速度自体は常に一定の自然な速さ（≈1画面/秒）を基準にし、ページが
 * 短くて合計時間が最低保証(12秒)に届かない場合は、スクロール速度を不自然に
 * 遅くするのではなく終端の静止時間を延ばして帳尻を合わせる（＝録画は必ず
 * CTA/店舗情報の静止フレームで終わるという要件と方向性が一致するため）。
 * ページが極端に長い場合は、最大時間(30秒)を超えないようスクロール時間の
 * 方を短縮する（この場合のみ、自然な速さの基準より速くスクロールする）。
 */
function planScrollTiming(scrollDistance: number, elapsedBeforeHoldMs: number): ScrollTiming {
  const MIN_TOTAL_MS = 12_000;
  const MAX_TOTAL_MS = 30_000;
  const START_HOLD_MS = 1_800;
  const END_HOLD_MS = 1_800;
  const SCROLL_PX_PER_SEC = 950;

  const remainingForCap = Math.max(0, MAX_TOTAL_MS - elapsedBeforeHoldMs);
  const maxScrollMs = Math.max(0, remainingForCap - START_HOLD_MS - END_HOLD_MS);
  const naturalScrollMs = scrollDistance > 0 ? (scrollDistance / SCROLL_PX_PER_SEC) * 1000 : 0;
  const scrollMs = Math.min(naturalScrollMs, maxScrollMs);

  const totalBeforePadding = elapsedBeforeHoldMs + START_HOLD_MS + scrollMs + END_HOLD_MS;
  const endHoldMs = END_HOLD_MS + Math.max(0, MIN_TOTAL_MS - totalBeforePadding);

  return { startHoldMs: START_HOLD_MS, scrollMs, endHoldMs };
}

/**
 * Hero→Story→Menu→Access→CTA…と自然に見えるよう、加速・減速のあるスクロールで
 * ページ最下部（CTA/店舗情報）まで進み、開始・終了それぞれで静止する。
 * 瞬間ジャンプや等速スクロールではなく、ease-in-outカーブに沿って
 * `window.scrollTo`をrAFで駆動することで、実際の指の動き（弾みながら止まる）
 * に近い自然な速度変化を作る。
 */
async function scrollThroughPage(page: import("playwright").Page, elapsedBeforeHoldMs: number): Promise<void> {
  const scrollDistance = await page.evaluate(() =>
    Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
  );
  const { startHoldMs, scrollMs, endHoldMs } = planScrollTiming(scrollDistance, elapsedBeforeHoldMs);

  await page.waitForTimeout(startHoldMs);

  if (scrollDistance > 0 && scrollMs > 0) {
    // イージング計算はNode側で行い、page.evaluateへは`window.scrollTo`呼び出し
    // だけを渡す。ページ内で完結するrAFループ（関数をブラウザへ丸ごと転送する
    // 形）は、tsxのビルド設定によっては転送先で解決できないヘルパー参照を
    // 生成することがあるため避け、Node側から一定間隔でスクロール位置を
    // 押し進める方式にしている。
    const FRAME_INTERVAL_MS = 50;
    const start = Date.now();
    for (;;) {
      const t = Math.min(1, (Date.now() - start) / scrollMs);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      await page.evaluate((y) => window.scrollTo(0, y), scrollDistance * eased);
      if (t >= 1) break;
      await page.waitForTimeout(FRAME_INTERVAL_MS);
    }
  }

  await page.waitForTimeout(endHoldMs);
}

/**
 * webm→mp4変換。`trimStartSeconds`（録画コンテキストでのページ読み込み〜
 * レンダリング完了までの実測時間）が指定された場合、その区間を入力側`-ss`で
 * 切り落としてからエンコードする。入力側`-ss`はデコード前にシークするため、
 * 出力側`-ss`より高速で、かつ「フォント/画像読み込み中の状態」を最終MP4に
 * 含めないという目的にも合う（不要な区間はエンコード対象にすらしない）。
 */
async function convertToMp4(webmPath: string, outPath: string, trimStartSeconds = 0): Promise<void> {
  await mkdir(path.dirname(outPath), { recursive: true });
  const trimArgs = trimStartSeconds > 0 ? ["-ss", trimStartSeconds.toFixed(3)] : [];
  await execFileAsync(ffmpegPath, [
    "-y",
    ...trimArgs,
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
    // ウォームアップ: 録画無しの別コンテキストで一度読み込み、フォント適用・
    // 画像デコード・（初回アクセス時のみ発生し得る）サーバー側の初期化コストを
    // ここで先に消化しておく。Playwrightのコンテキストはブラウザキャッシュを
    // 共有しないため、これだけでは録画側の読み込みがゼロにはならないが、
    // 録画側の実測読み込み時間を後段でMP4からトリムするため、これは主に
    // サーバー側の初期化コストを減らす目的で行う。
    console.log("[record-demo] ウォームアップ読み込み中...");
    const warmupContext = await browser.newContext({
      viewport: { width: args.width, height: args.height },
      reducedMotion: "reduce",
    });
    const warmupPage = await warmupContext.newPage();
    await warmupPage.goto(args.url, { waitUntil: "networkidle", timeout: 30_000 });
    await waitForRenderReady(warmupPage);
    await warmupContext.close();

    const context = await browser.newContext({
      viewport: { width: args.width, height: args.height },
      recordVideo: { dir: videoDir, size: { width: args.width, height: args.height } },
      // scroll-reveal演出（RevealV2等）はprefers-reduced-motionを尊重して
      // 即時フル表示になる設計のため、録画中は常にこれを有効にする。これにより
      // セクションがフェード/スケールの途中で録画される（＝partial-loadに
      // 見える）ことを避けられる。v2側のコード・演出自体は変更していない。
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const recordingPassStart = Date.now();

    console.log("[record-demo] ページを読み込み中...");
    await page.goto(args.url, { waitUntil: "networkidle", timeout: 30_000 });

    console.log("[record-demo] レンダリング完了を待機中...");
    await waitForRenderReady(page);

    // ここまでに実際にかかった時間（＝録画データの先頭に写り込んでいる
    // 白画面・部分描画の長さ）。30秒上限の計算に反映する（写真枚数が多い
    // ページ等ではこれ自体が数秒になりうるため）とともに、MP4変換時に
    // この区間をffmpegでトリムし、最終出力に読み込み中の状態が残らないようにする。
    const elapsedBeforeHoldMs = Date.now() - recordingPassStart;
    console.log(`[record-demo] 読み込み〜描画確定まで: ${elapsedBeforeHoldMs}ms（MP4化時にトリムする）`);

    console.log("[record-demo] スクロール録画中...");
    await scrollThroughPage(page, elapsedBeforeHoldMs);

    console.log("[record-demo] 録画を確定中（コンテキストを閉じています）...");
    await context.close();

    const webmPath = await findRecordedWebm(videoDir);
    console.log(`[record-demo] 録画完了: ${webmPath}`);

    // 少し多めにトリムして、読み込み完了直前のフレームが最終MP4に残らないようにする。
    const TRIM_SAFETY_MARGIN_MS = 200;
    const trimStartSeconds = (elapsedBeforeHoldMs + TRIM_SAFETY_MARGIN_MS) / 1000;

    console.log("[record-demo] MP4へ変換中(ffmpeg)...");
    await convertToMp4(webmPath, args.out, trimStartSeconds);

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
