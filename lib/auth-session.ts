import { eq } from "drizzle-orm";
import type { JWTPayload } from "jose";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { user as userTable } from "@/lib/db/schema";

type AuthenticatedSession = {
  session: Record<string, unknown> | null;
  user: Record<string, unknown>;
  jwtPayload: JWTPayload | null;
};

async function findUserById(id: string) {
  const [user] = await db
    .select()
    .from(userTable)
    .where(eq(userTable.id, id))
    .limit(1);

  return user ?? null;
}

function getBearerToken(headers: Headers) {
  const authorization = headers.get("authorization");

  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return authorization.slice("bearer ".length).trim() || null;
}

export async function getAuthenticatedSession(
  headers: Headers,
): Promise<AuthenticatedSession | null> {
  const session = await auth.api.getSession({ headers });

  if (session) {
    const user = await findUserById(session.user.id);

    if (!user) {
      return null;
    }

    return {
      session: session.session as Record<string, unknown>,
      user,
      jwtPayload: null,
    };
  }

  const token = getBearerToken(headers);
  if (!token) {
    return null;
  }

  const verified = await auth.api.verifyJWT({
    body: {
      token,
    },
  });

  if (!verified.payload?.sub) {
    return null;
  }

  const user = await findUserById(verified.payload.sub);

  if (!user) {
    return null;
  }

  return {
    session: null,
    user,
    jwtPayload: verified.payload,
  };
}

export function getUserRoles(user: Record<string, unknown>) {
  const role = user.role;

  if (Array.isArray(role)) {
    return role.filter((value): value is string => typeof value === "string");
  }

  if (typeof role === "string") {
    return role.split(",").map((value) => value.trim());
  }

  return [];
}
