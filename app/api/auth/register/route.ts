import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongoose";
import { setSession } from "@/lib/session";
import {
  createTeamForUser,
  joinTeamWithInvitation,
  TeamServiceError,
  validateInvitationForEmail
} from "@/lib/team-service";
import { authSchema } from "@/lib/validation";
import { User } from "@/models/User";

function registrationError(error: unknown) {
  if (error instanceof TeamServiceError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  throw error;
}

export async function POST(request: Request) {
  const parsed = authSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid email and a password with at least 8 characters." },
      { status: 400 }
    );
  }

  const { email, password, name } = parsed.data;
  const teamName = parsed.data.teamName?.trim() ?? "";
  const inviteToken = parsed.data.inviteToken?.trim() ?? "";

  if (!teamName && !inviteToken) {
    return NextResponse.json(
      { error: "Create a team or enter an invitation token." },
      { status: 400 }
    );
  }

  if (teamName && inviteToken) {
    return NextResponse.json(
      { error: "Choose either a team name or an invitation token." },
      { status: 400 }
    );
  }

  await connectToDatabase();

  const existing = await User.exists({ email });
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists." },
      { status: 409 }
    );
  }

  if (inviteToken) {
    try {
      await validateInvitationForEmail(inviteToken, email);
    } catch (error) {
      return registrationError(error);
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    email,
    passwordHash,
    name: name || email.split("@")[0]
  });

  try {
    const teamContext = inviteToken
      ? await joinTeamWithInvitation(user, inviteToken)
      : await createTeamForUser(user, teamName);

    await setSession({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      teamId: teamContext.teamId,
      teamName: teamContext.teamName,
      teamRole: teamContext.role
    });
  } catch (error) {
    await User.deleteOne({ _id: user._id });
    return registrationError(error);
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
