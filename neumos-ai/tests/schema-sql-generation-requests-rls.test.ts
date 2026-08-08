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
 *
 * 重要: コメントアウトされたSQL（`-- ...`行コメント・`/* ... *\/`ブロックコメント）は
 * 「存在しない」のと同じ扱いにする。文字列としては該当パターンにマッチしうるが
 * 実行はされないため、検証前に必ずコメントを除去してから判定すること
 * （独立監査で、コメント除去前提でないと誤検知しうる点を指摘され修正）。
 */
const TABLE = "neumos_content_generation_requests";

/** ブロックコメント→行コメントの順で除去する（ブロックコメント内の`--`を誤って残さないため）。 */
function stripSqlComments(sql: string): string {
  const withoutBlockComments = sql.replace(/\/\*[\s\S]*?\*\//g, "");
  return withoutBlockComments.replace(/--[^\n]*/g, "");
}

interface PermissionCheck {
  hasEnableRls: boolean;
  hasRevoke: boolean;
  hasServiceRoleGrant: boolean;
  hasAnonOrAuthenticatedGrant: boolean;
  hasPolicy: boolean;
}

/** 引数は必ずstripSqlComments済みのSQLを渡すこと。 */
function checkGenerationRequestsPermissions(cleanedSql: string, table: string = TABLE): PermissionCheck {
  return {
    hasEnableRls: new RegExp(`alter table ${table}\\s+enable row level security;`).test(cleanedSql),
    hasRevoke: new RegExp(
      `revoke all privileges\\s+on table ${table}\\s+from public,\\s*anon,\\s*authenticated;`
    ).test(cleanedSql),
    hasServiceRoleGrant: new RegExp(
      `grant select, insert, update, delete\\s+on table ${table}\\s+to service_role;`
    ).test(cleanedSql),
    hasAnonOrAuthenticatedGrant: new RegExp(
      `grant[\\s\\S]*?on table ${table}[\\s\\S]*?to\\s+(anon|authenticated)`,
      "i"
    ).test(cleanedSql),
    hasPolicy: new RegExp(`create policy[\\s\\S]*?on\\s+${table}`, "i").test(cleanedSql),
  };
}

function isSafe(check: PermissionCheck): boolean {
  return check.hasEnableRls && check.hasRevoke && check.hasServiceRoleGrant && !check.hasAnonOrAuthenticatedGrant && !check.hasPolicy;
}

const RAW_SCHEMA_SQL = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const SCHEMA_SQL = stripSqlComments(RAW_SCHEMA_SQL);

describe("stripSqlComments", () => {
  it("removes -- line comments but keeps the rest of the file", () => {
    const input = "select 1; -- this is a comment\nselect 2;";
    expect(stripSqlComments(input)).toBe("select 1; \nselect 2;");
  });

  it("removes /* ... */ block comments, including multi-line ones", () => {
    const input = "select 1;\n/* revoke all\n   from anon */\nselect 2;";
    expect(stripSqlComments(input)).toBe("select 1;\n\nselect 2;");
  });
});

describe("schema.sql（コメント除去後）: neumos_content_generation_requestsの権限退行防止", () => {
  it("RLSを有効化する文が存在する（コメントアウトされていない）", () => {
    expect(checkGenerationRequestsPermissions(SCHEMA_SQL).hasEnableRls).toBe(true);
  });

  it("public/anon/authenticatedからの全権限をrevokeする文が存在する", () => {
    expect(checkGenerationRequestsPermissions(SCHEMA_SQL).hasRevoke).toBe(true);
  });

  it("service_roleへ必要なCRUD（select/insert/update/delete）をgrantする文が存在する", () => {
    expect(checkGenerationRequestsPermissions(SCHEMA_SQL).hasServiceRoleGrant).toBe(true);
  });

  it("anon/authenticated向けのpolicyを追加していない、追加のgrantも存在しない", () => {
    const check = checkGenerationRequestsPermissions(SCHEMA_SQL);
    expect(check.hasPolicy).toBe(false);
    expect(check.hasAnonOrAuthenticatedGrant).toBe(false);
  });

  it("新規環境への適用時に安全な権限へ収束する（RLS有効化→revoke→grantの3点が全て揃っている）", () => {
    expect(isSafe(checkGenerationRequestsPermissions(SCHEMA_SQL))).toBe(true);
  });

  it("RLS有効化・revoke・grantの各文は、繰り返し適用しても安全な構文である（べき等性）", () => {
    const sectionMatch = SCHEMA_SQL.match(
      new RegExp(`alter table ${TABLE}\\s+enable row level security;[\\s\\S]*?to service_role;`)
    );
    expect(sectionMatch).not.toBeNull();
    const section = sectionMatch?.[0] ?? "";
    expect(section).not.toMatch(/\bdrop\s+table\b/i);
    expect(section).not.toMatch(/\bcreate\s+table\b(?!\s+if\s+not\s+exists)/i);
  });

  it("実ファイル中の説明コメント（RLS/GRANT/policy等の語を含む日本語の説明文）で誤検知しない", () => {
    // schema.sql自体に「既にRLS有効・anon/authenticatedへのGRANTなし・service_role
    // のみCRUD可能」といった説明的なコメントが含まれるが、これは有効なSQL文では
    // ないため、コメント除去後は判定に影響しないことを確認する。
    expect(RAW_SCHEMA_SQL).toMatch(/RLS|GRANT|grant/);
    expect(isSafe(checkGenerationRequestsPermissions(SCHEMA_SQL))).toBe(true);
  });
});

describe("schema.sql: 誤検知の回帰防止（negative fixtures）", () => {
  it("RLSのみ有効、REVOKE/GRANTが `--` 行コメント内（1行に文全体）→ 安全と誤検知しない", () => {
    // 各行を"--"で始める複数行コメント（後述のブロックコメント版と重複しない、
    // より起こりやすい書き方: 1文をまるごと1行にまとめて"--"でコメントアウトする
    // スタイル）で再現する。
    const fixture = stripSqlComments(`
      alter table ${TABLE}
        enable row level security;

      -- revoke all privileges on table ${TABLE} from public, anon, authenticated;
      -- grant select, insert, update, delete on table ${TABLE} to service_role;
    `);
    const check = checkGenerationRequestsPermissions(fixture);
    expect(check.hasEnableRls).toBe(true);
    expect(check.hasRevoke).toBe(false);
    expect(check.hasServiceRoleGrant).toBe(false);
    expect(isSafe(check)).toBe(false);
  });

  it("RLSのみ有効、REVOKE/GRANTが `/* ... */` ブロックコメント内 → 安全と誤検知しない", () => {
    const fixture = stripSqlComments(`
      alter table ${TABLE}
        enable row level security;

      /*
      revoke all privileges
        on table ${TABLE}
        from public, anon, authenticated;
      grant select, insert, update, delete
        on table ${TABLE}
        to service_role;
      */
    `);
    const check = checkGenerationRequestsPermissions(fixture);
    expect(check.hasEnableRls).toBe(true);
    expect(check.hasRevoke).toBe(false);
    expect(check.hasServiceRoleGrant).toBe(false);
    expect(isSafe(check)).toBe(false);
  });

  it("service_roleへのGRANTだけがコメント化されている → 安全と誤検知しない", () => {
    const fixture = stripSqlComments(`
      alter table ${TABLE}
        enable row level security;

      revoke all privileges
        on table ${TABLE}
        from public, anon, authenticated;

      -- grant select, insert, update, delete
      --   on table ${TABLE}
      --   to service_role;
    `);
    const check = checkGenerationRequestsPermissions(fixture);
    expect(check.hasEnableRls).toBe(true);
    expect(check.hasRevoke).toBe(true);
    expect(check.hasServiceRoleGrant).toBe(false);
    expect(isSafe(check)).toBe(false);
  });

  it("修正前のschema.sql相当（RLS有効化文自体がコメントアウト、REVOKE/GRANTも存在しない）→ 安全と誤検知しない", () => {
    // PR作成前のorigin/main時点のschema.sqlに実在した状態を再現した固定フィクスチャ
    // （git履歴に依存せず、CIでも同じ結果になるようインラインで持つ）。
    const fixture = stripSqlComments(`
      -- RLS（雛形）: v1はservice role経由のサーバアクセス前提。今は無効のまま。
      -- alter table ${TABLE} enable row level security;
    `);
    const check = checkGenerationRequestsPermissions(fixture);
    expect(check.hasEnableRls).toBe(false);
    expect(check.hasRevoke).toBe(false);
    expect(check.hasServiceRoleGrant).toBe(false);
    expect(isSafe(check)).toBe(false);
  });

  it("有効な文とコメント化された文が混在していても、有効な文だけを正しく検出する", () => {
    const fixture = stripSqlComments(`
      alter table ${TABLE}
        enable row level security;

      revoke all privileges
        on table ${TABLE}
        from public, anon, authenticated;

      grant select, insert, update, delete
        on table ${TABLE}
        to service_role;

      -- 以前の設計案（不採用）。anon/authenticatedへ直接grantしていたが、
      -- service_role限定方針に変更したため使わない:
      -- grant select on table neumos_content_generation_requests to anon;
      /* grant select on table neumos_content_generation_requests to authenticated; */
    `);
    const check = checkGenerationRequestsPermissions(fixture);
    expect(isSafe(check)).toBe(true);
    expect(check.hasAnonOrAuthenticatedGrant).toBe(false);
  });
});
