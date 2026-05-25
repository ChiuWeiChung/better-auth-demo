import { getAuthenticatedSession } from "@/lib/auth-session";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getAuthenticatedSession(await headers());

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    user: session.user,
    session: session.session,
    jwtPayload: session.jwtPayload,
  });
}
