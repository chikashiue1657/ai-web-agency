// 営業提案書生成モジュール

import type { ProposalInput, Proposal } from '@/types'

// ============================================================
// プロンプト構築
// ============================================================

export function buildProposalPrompt(input: ProposalInput): string {
  const { store, lead, review_summary, target_customers } = input
  const hasSns = !!(store.instagram_url || store.facebook_url)

  return `あなたは沖縄エリアの中小店舗向けIT集客支援の営業担当アシスタントです。
以下の店舗情報をもとに、オーナーへの営業提案書をMarkdown形式で作成してください。

## 重要な制約
- 実在しない情報は絶対に作らないこと
- 不明な点や推定の場合は「〜の可能性があります（要確認）」と明記すること
- 誇張せず、実務的な内容にすること
- オーナー目線で、難しい専門用語は避けること

---

## 店舗情報
- 店名: ${store.name}
- 業種: ${store.category ?? '不明'}
- エリア: ${store.area ?? '不明'}
- 住所: ${store.address ?? '不明'}
- 電話: ${store.phone ?? '不明'}
- Googleマップ評価: ${store.rating ?? '不明'}
- 口コミ数: ${store.review_count}件
- 写真数: ${store.photo_count}枚
- ホームページ: ${store.has_website ? store.website_url ?? 'あり' : 'なし'}
- Instagram: ${store.instagram_url ? 'あり' : 'なし'}
- Facebook: ${store.facebook_url ? 'あり' : 'なし'}
${review_summary ? `- 口コミ要約: ${review_summary}` : ''}
${target_customers ? `- 想定顧客層: ${target_customers}` : ''}
${lead?.priority_rank ? `- 営業優先度: ${lead.priority_rank}（スコア: ${lead.score}）` : ''}
${lead?.sales_angle ? `- 営業アングル: ${lead.sales_angle}` : ''}

---

## 提案書の構成（以下の見出しを必ず使用）

# ${store.name} 様 集客改善提案書

## 1. 御店舗の強み
（口コミ・評価・立地などから読み取れる強みを箇条書き。不明な点は「〜と推察されます（要確認）」と記載）

## 2. 現状の機会損失
（ホームページ・SNSがないことで逃している集客機会を具体的に）

## 3. ホームページを持つメリット
（この店舗・業種に特化したメリット3〜5点）

## 4. 予約・問い合わせ導線の改善ポイント
（現状の課題と、改善後のイメージ）

## 5. 外国人・観光客対応の可能性
（エリアや業種に応じて現実的な範囲で提案。過剰にならないよう注意）

## 6. 推奨ページ構成
（この店舗に合ったページ構成を提案。必須ページと追加候補を分けて記載）

## 7. 営業メッセージ（30秒トーク用）
（オーナーに最初の30秒で伝えるメッセージ。自然な話し言葉で）

## 8. オーナー向け5分説明サマリー
（非IT系のオーナーに5分で理解してもらうための要点まとめ）

---

上記の構成で、実務的かつ誠実な提案書を作成してください。
`
}

// ============================================================
// 提案書生成（Claude API）
// ============================================================

export async function generateProposal(
  input: ProposalInput
): Promise<{ markdown: string; summary: string }> {
  const prompt = buildProposalPrompt(input)

  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  })

  const markdown = message.content[0].type === 'text' ? message.content[0].text : ''
  const summary = extractSummary(markdown)

  return { markdown, summary }
}

// ============================================================
// Markdown から構造データを抽出
// ============================================================

export function extractProposalData(markdown: string): Partial<Proposal> {
  const problems = extractSection(markdown, '現状の機会損失')
  const opportunities = extractSection(markdown, 'ホームページを持つメリット')
  const suggestedSections = extractSection(markdown, '推奨ページ構成')
  const salesMessage = extractFirstParagraph(markdown, '営業メッセージ')
  const summary = extractFirstParagraph(markdown, 'オーナー向け5分説明サマリー')

  return {
    summary,
    problems: problems.split('\n').filter((l) => l.startsWith('-') || l.startsWith('・')).map((l) => l.replace(/^[-・]\s*/, '')),
    opportunities: opportunities.split('\n').filter((l) => l.startsWith('-') || l.startsWith('・')).map((l) => l.replace(/^[-・]\s*/, '')),
    suggested_sections: suggestedSections
      ? [{ title: '推奨構成', description: suggestedSections }]
      : [],
    sales_message: salesMessage || null,
    generated_markdown: markdown,
  }
}

function extractSection(markdown: string, heading: string): string {
  const regex = new RegExp(`##[^#]*${heading}[\\s\\S]*?(?=##|$)`, 'i')
  const match = markdown.match(regex)
  if (!match) return ''
  return match[0].replace(/^##[^\n]*\n/, '').trim()
}

function extractFirstParagraph(markdown: string, heading: string): string {
  const section = extractSection(markdown, heading)
  return section.split('\n\n')[0].trim()
}

function extractSummary(markdown: string): string {
  const summary = extractSection(markdown, 'オーナー向け5分説明サマリー')
  if (summary) return summary.slice(0, 300)
  // フォールバック: 最初の200文字
  return markdown.replace(/#+[^\n]*/g, '').trim().slice(0, 200)
}

// ============================================================
// LLMなしフォールバック（テンプレートベース）
// ============================================================

export function generateProposalFallback(input: ProposalInput): { markdown: string; summary: string } {
  const { store, lead } = input
  const hasSns = !!(store.instagram_url || store.facebook_url)

  const markdown = `# ${store.name} 様 集客改善提案書

## 1. 御店舗の強み
${store.rating ? `- Googleマップ評価 ${store.rating}（口コミ ${store.review_count}件）の実績` : '- 口コミ実績あり（詳細は要確認）'}
${store.area ? `- ${store.area}エリアの立地` : ''}
- ${store.category ?? ''}としての地域認知（要確認）

## 2. 現状の機会損失
${!store.has_website ? '- ホームページがないため、Google検索からの集客が困難' : ''}
${!store.instagram_url ? '- Instagramがないため、ビジュアル訴求による新規顧客獲得機会を逃している' : ''}
${!store.facebook_url ? '- Facebookがないため、地域コミュニティへのリーチが限定的' : ''}
- 24時間対応の問い合わせ・予約受付ができていない（推測）

## 3. ホームページを持つメリット
- Googleマップとの連携強化により、検索上位表示を狙える
- 営業時間・メニュー・価格を正確に伝えられ、来店前の不安を解消
- 予約フォーム設置により、電話対応の負担を軽減
- お客様の声（口コミ）をWebで活用し、信頼性向上
- 観光客・外国人向けに多言語対応が可能

## 4. 予約・問い合わせ導線の改善ポイント
- 現状: 電話のみの問い合わせ（推測・要確認）
- 改善後: WEBフォーム + LINE公式アカウント連携で24時間受付可能に

## 5. 外国人・観光客対応の可能性
${['那覇市', '石垣市', '宮古島市', '恩納村', '北谷町'].some((a) => (store.area ?? '').includes(a))
  ? '- 観光エリア立地のため、英語・中国語・韓国語のページ対応が集客に直結'
  : '- エリアによっては観光客需要も考慮した多言語対応を検討（要ヒアリング）'
}

## 6. 推奨ページ構成
**必須ページ**
- TOP（第一印象・予約ボタン）
- 店舗紹介（想いとこだわり）
- ${store.category?.includes('飲食') ? 'メニュー・料金' : 'サービス・料金'}
- アクセス（地図・駐車場）
- お問い合わせ・予約

**追加候補**
- よくある質問（FAQ）
- スタッフ紹介
- ギャラリー（写真）

## 7. 営業メッセージ（30秒トーク用）
「${store.name}さんのGoogleマップ評価はとても良いのに、ホームページがないせいでせっかくのお客様が他店に流れているかもしれません。月々わずかなコストで、24時間集客できる環境を作りませんか？」

## 8. オーナー向け5分説明サマリー
現状、${store.name}様はGoogleマップで良い評価を受けているものの、ホームページがないために検索エンジンからの集客機会を逃しています。シンプルなホームページを作るだけで、Google検索の上位に表示されやすくなり、24時間問い合わせ・予約を受け付けることが可能になります。初期費用を抑えた月額制プランをご提案します。

*本提案書は公開情報をもとに作成した仮説ベースの提案です。詳細はヒアリングにてご確認ください。*
`

  return {
    markdown,
    summary: `${store.name}様のデジタル集客基盤構築提案。ホームページ制作により検索流入・予約導線を整備し、既存の${store.rating ?? ''}評価を最大活用する。`,
  }
}
