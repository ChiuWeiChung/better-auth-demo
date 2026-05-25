import {
  getAuthenticatedSession,
  getUserRoles,
} from "@/lib/auth-session";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getAuthenticatedSession(await headers());

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roles = getUserRoles(session.user);

  if (!roles.includes("admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    ok: true,
    message: "Admin access granted.",
    user: session.user,
    jwtPayload: session.jwtPayload,
  });
}
