import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

const AUTHORIZATION_PATTERN = /^Bearer ([^\s]+)$/;

export type NeumosApiAuthResult =
  | { authorized: true }
  | { authorized: false; status: 401 | 404 };

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/**
 * Authenticate Neumos generation APIs exclusively through the Authorization header.
 * The server key is checked first so an unconfigured deployment always fails closed.
 */
export function checkNeumosApiAuth(request: Request): NeumosApiAuthResult {
  const expected = process.env.NEUMOS_API_KEY;
  if (!expected) {
    return { authorized: false, status: 404 };
  }

  const authorization = request.headers.get("authorization");
  const match = authorization?.match(AUTHORIZATION_PATTERN);
  if (!match) {
    return { authorized: false, status: 401 };
  }

  const expectedDigest = digest(expected);
  const providedDigest = digest(match[1]);
  if (!timingSafeEqual(expectedDigest, providedDigest)) {
    return { authorized: false, status: 401 };
  }

  return { authorized: true };
}

export function neumosApiAuthError(status: 401 | 404): NextResponse {
  return NextResponse.json(
    { error: status === 404 ? "not found" : "unauthorized" },
    { status, headers: { "cache-control": "no-store" } }
  );
}
