/**
 * 実写真が無い前提のセクション用プレースホルダー（グラデーション + アイコン）。
 * Gallery / About など、画像枠を持つ複数のセクションで共通利用する。
 */
export function ImagePlaceholder({
  label,
  gradient = "from-brand-500 to-purple-700",
  className = "",
}: {
  label: string;
  gradient?: string;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className={`flex items-center justify-center bg-gradient-to-br ${gradient} ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-10 w-10 text-white/70" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h3l1.5-2h9L18 7h3v13H3V7z" />
        <circle cx="12" cy="13" r="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
