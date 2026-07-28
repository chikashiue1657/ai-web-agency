/** ブラウザ・Node双方で動く軽量ID生成（プロジェクトはUUID衝突耐性まで不要な個人利用ツール前提）。 */
export function uid(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 9);
  const time = Date.now().toString(36);
  return `${prefix}_${time}${rand}`;
}
