"use client";

import { createAuthClient } from "better-auth/react";
import { jwtClient } from "better-auth/client/plugins";

const bearerTokenKey = "bearer_token";

export const authClient = createAuthClient({
  plugins: [jwtClient()],
  fetchOptions: {
    auth: {
      type: "Bearer",
      token: () => {
        if (typeof window === "undefined") {
          return "";
        }

        return localStorage.getItem(bearerTokenKey) ?? "";
      },
    },
    onSuccess: (ctx) => {
      if (typeof window === "undefined") {
        return;
      }

      const authToken = ctx.response.headers.get("set-auth-token");

      if (authToken) {
        localStorage.setItem(bearerTokenKey, authToken);
      }
    },
  },
});

export function getStoredBearerToken() {
  if (typeof window === "undefined") {
    return "";
  }

  return localStorage.getItem(bearerTokenKey) ?? "";
}

export function setStoredBearerToken(token: string) {
  localStorage.setItem(bearerTokenKey, token);
}

export function clearStoredBearerToken() {
  localStorage.removeItem(bearerTokenKey);
}
