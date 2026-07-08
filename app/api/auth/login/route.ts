import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongoose";
import { setSession } from "@/lib/session";
import {
  getUserTeamContext,
  serializeSessionTeamContext,
  TeamServiceError
} from "@/lib/team-service";
import { authSchema } from "@/lib/validation";
import { User } from "@/models/User";

function loginError(error: unknown) {
  if (error instanceof TeamServiceError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  throw error;
}

export async function POST(request: Request) {
  const parsed = authSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid email and password." },
      { status: 400 }
    );
  }

  const { email, password } = parsed.data;

  await connectToDatabase();

  const user = await User.findOne({ email });
  const passwordMatches = user
    ? await bcrypt.compare(password, user.passwordHash)
    : false;

  if (!user || !passwordMatches) {
    return NextResponse.json(
      { error: "Email or password is incorrect." },
      { status: 401 }
    );
  }

  let teamContext;
  try {
    teamContext = await getUserTeamContext(user._id.toString());
  } catch (error) {
    return loginError(error);
  }

  await setSession(serializeSessionTeamContext(teamContext));

  return NextResponse.json({ ok: true });
}
