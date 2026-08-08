import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * schema.sqlの内容を静的に検証する（実DBへの適用はしない・できない環境のため）。
 * fresh Staging等の新規環境へschema.sqlを適用した際に、
 * neumos_content_generation_requestsがRLS無効・anon/authenticatedへの
 * 暗黙のCRUD権限を持つ、という権限退行が再発しないことを保証する。
 * 既存Productionには影響しない（Productionは既にRLS有効・service_role限定の
 * 安全な状態であることを別途確認済み。本テストはあくまで「新規環境構築時に
 * 同じ安全な状態へ収束するか」を検証する）。
 */
const SCHEMA_SQL = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const TABLE = "neumos_content_generation_requests";

describe("schema.sql: neumos_content_generation_requestsの権限退行防止", () => {
  it("RLSを有効化する文が存在する（コメントアウトされていない）", () => {
    const enableRlsPattern = new RegExp(`^\\s*alter table ${TABLE}\\s+enable row level security;`, "m");
    expect(SCHEMA_SQL).toMatch(enableRlsPattern);
  });

  it("public/anon/authenticatedからの全権限をrevokeする文が存在する", () => {
    const revokePattern = new RegExp(
      `revoke all privileges\\s+on table ${TABLE}\\s+from public,\\s*anon,\\s*authenticated;`
    );
    expect(SCHEMA_SQL).toMatch(revokePattern);
  });

  it("service_roleへ必要なCRUD（select/insert/update/delete）をgrantする文が存在する", () => {
    const grantPattern = new RegExp(
      `grant select, insert, update, delete\\s+on table ${TABLE}\\s+to service_role;`
    );
    expect(SCHEMA_SQL).toMatch(grantPattern);
  });

  it("anon/authenticated向けのpolicyを追加していない", () => {
    // このテーブルに対する create policy 文自体が存在しないこと
    // （サーバーはservice_role経由のみでアクセスし、RLSポリシーには依存しない設計）。
    const policyPattern = new RegExp(`create policy[\\s\\S]*?on\\s+${TABLE}`, "i");
    expect(SCHEMA_SQL).not.toMatch(policyPattern);
    // anon/authenticatedへのgrantが（このrevoke/grantブロック以降に）
    // 再度追加されていないことも確認する。
    expect(SCHEMA_SQL).not.toMatch(new RegExp(`grant[\\s\\S]*?on table ${TABLE}[\\s\\S]*?to\\s+anon`, "i"));
    expect(SCHEMA_SQL).not.toMatch(
      new RegExp(`grant[\\s\\S]*?on table ${TABLE}[\\s\\S]*?to\\s+authenticated`, "i")
    );
  });

  it("新規環境への適用時に安全な権限へ収束する（RLS有効化→revoke→grantの3点が全て揃っている）", () => {
    const hasEnableRls = new RegExp(`alter table ${TABLE}\\s+enable row level security;`).test(SCHEMA_SQL);
    const hasRevoke = new RegExp(
      `revoke all privileges\\s+on table ${TABLE}\\s+from public,\\s*anon,\\s*authenticated;`
    ).test(SCHEMA_SQL);
    const hasServiceRoleGrant = new RegExp(
      `grant select, insert, update, delete\\s+on table ${TABLE}\\s+to service_role;`
    ).test(SCHEMA_SQL);
    const hasAnonOrAuthenticatedGrant =
      new RegExp(`grant[\\s\\S]*?on table ${TABLE}[\\s\\S]*?to\\s+(anon|authenticated)`, "i").test(SCHEMA_SQL);

    expect(hasEnableRls).toBe(true);
    expect(hasRevoke).toBe(true);
    expect(hasServiceRoleGrant).toBe(true);
    expect(hasAnonOrAuthenticatedGrant).toBe(false);
  });

  it("RLS有効化・revoke・grantの各文は、繰り返し適用しても安全な構文である（べき等性）", () => {
    // enable row level securityは既に有効な場合でもエラーにならない、
    // revoke/grantはPostgresの仕様上何度実行しても同じ状態に収束する。
    // ここでは「create table」や「drop」等の非べき等な操作と混在していないことを、
    // このセクションのテキスト範囲に限定して確認する。
    const sectionMatch = SCHEMA_SQL.match(
      new RegExp(`alter table ${TABLE}\\s+enable row level security;[\\s\\S]*?to service_role;`)
    );
    expect(sectionMatch).not.toBeNull();
    const section = sectionMatch?.[0] ?? "";
    expect(section).not.toMatch(/\bdrop\s+table\b/i);
    expect(section).not.toMatch(/\bcreate\s+table\b(?!\s+if\s+not\s+exists)/i);
  });
});
