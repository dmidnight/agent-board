import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    return {
      session: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    };
  }

  return { session, response: null };
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
