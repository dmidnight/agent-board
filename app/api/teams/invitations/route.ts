import { NextResponse } from "next/server";
import { jsonError, requireSession } from "@/lib/http";
import { createTeamInvitation, TeamServiceError } from "@/lib/team-service";
import { createInvitationSchema } from "@/lib/validation";

function teamError(error: unknown) {
  if (error instanceof TeamServiceError) {
    return jsonError(error.message, error.status);
  }

  throw error;
}

export async function POST(request: Request) {
  const auth = await requireSession();
  if (auth.response) {
    return auth.response;
  }

  const parsed = createInvitationSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return jsonError("Enter a valid email address or leave it blank.");
  }

  try {
    const invitation = await createTeamInvitation(
      auth.session.userId,
      auth.session.teamId,
      parsed.data.invitedEmail
    );
    const inviteUrl = new URL(`/login?invite=${invitation.token}`, request.url);

    return NextResponse.json(
      {
        invitation: {
          token: invitation.token,
          inviteUrl: inviteUrl.toString(),
          expiresAt: invitation.expiresAt.toISOString(),
          team: invitation.team,
          invitedEmail: invitation.invitedEmail
        }
      },
      { status: 201 }
    );
  } catch (error) {
    return teamError(error);
  }
}
