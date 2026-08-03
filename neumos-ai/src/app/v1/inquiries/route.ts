import { NextRequest, NextResponse } from "next/server";
import { checkNeumosApiAuth, neumosApiAuthError } from "@/lib/neumos-api-auth";
import { InquiryStorageUnavailableError, listInquiries } from "@/lib/inquiries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = checkNeumosApiAuth(request);
  if (!auth.authorized) return neumosApiAuthError(auth.status);

  const requestedLimit = Number(request.nextUrl.searchParams.get("limit") ?? 100);
  const limit = Number.isFinite(requestedLimit) ? requestedLimit : 100;
  try {
    const inquiries = await listInquiries(limit);
    return NextResponse.json(
      { inquiries },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof InquiryStorageUnavailableError ? 503 : 500;
    return NextResponse.json(
      { error: status === 503 ? "inquiry storage unavailable" : "failed to list inquiries" },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
