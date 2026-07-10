import { NextResponse } from "next/server";
import { jsonError, requireSession } from "@/lib/http";
import {
  buildInvitationUrl,
  isInvitationEmailConfigured,
  sendTeamInvitationEmail
} from "@/lib/invitation-email";
import {
  createTeamInvitation,
  revokeTeamInvitation,
  TeamServiceError
} from "@/lib/team-service";
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
    const inviteUrl = buildInvitationUrl(request, invitation.token);
    let delivery: "email" | "link" = "link";

    if (invitation.invitedEmail && isInvitationEmailConfigured()) {
      try {
        await sendTeamInvitationEmail({
          to: invitation.invitedEmail,
          teamName: invitation.team.name,
          inviter: auth.session.name || auth.session.email,
          inviteUrl,
          expiresAt: invitation.expiresAt
        });
        delivery = "email";
      } catch (error) {
        await revokeTeamInvitation(invitation.team.id, invitation.token);
        return jsonError(
          error instanceof Error
            ? error.message
            : "Invitation email could not be sent.",
          502
        );
      }
    }

    return NextResponse.json(
      {
        invitation: {
          token: invitation.token,
          inviteUrl,
          expiresAt: invitation.expiresAt.toISOString(),
          team: invitation.team,
          invitedEmail: invitation.invitedEmail,
          delivery
        }
      },
      { status: 201 }
    );
  } catch (error) {
    return teamError(error);
  }
}
