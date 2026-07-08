import crypto from "crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "agent_board_session";

export type SessionPayload = {
  userId: string;
  email: string;
  name?: string;
  teamId?: string;
  teamName?: string;
  teamRole?: "owner" | "member";
  exp: number;
};

const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7;

function getSessionSecret() {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production.");
  }

  return "development-only-session-secret-change-me";
}

function shouldUseSecureSessionCookie() {
  if (process.env.SESSION_COOKIE_SECURE === "true") {
    return true;
  }

  if (process.env.SESSION_COOKIE_SECURE === "false") {
    return false;
  }

  return process.env.NODE_ENV === "production";
}

function encodeBase64Url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(unsignedPayload: string) {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(unsignedPayload)
    .digest("base64url");
}

function serializeSession(payload: SessionPayload) {
  const unsignedPayload = encodeBase64Url(JSON.stringify(payload));
  return `${unsignedPayload}.${sign(unsignedPayload)}`;
}

function parseSession(value?: string) {
  if (!value) {
    return null;
  }

  const [unsignedPayload, signature] = value.split(".");
  if (!unsignedPayload || !signature) {
    return null;
  }

  const expected = sign(unsignedPayload);
  if (signature.length !== expected.length) {
    return null;
  }

  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );

  if (!isValid) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(unsignedPayload)) as SessionPayload;
    if (!payload.userId || !payload.email || payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function getSession() {
  const cookieStore = await cookies();
  return parseSession(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function setSession(payload: Omit<SessionPayload, "exp">) {
  const cookieStore = await cookies();
  const expires = new Date(Date.now() + ONE_WEEK_SECONDS * 1000);

  cookieStore.set(
    SESSION_COOKIE,
    serializeSession({
      ...payload,
      exp: expires.getTime()
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: shouldUseSecureSessionCookie(),
      path: "/",
      expires
    }
  );
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
