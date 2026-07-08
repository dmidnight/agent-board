import { NextResponse } from "next/server";
import { getBoardWorkspaceForUser, serializeBoard } from "@/lib/board-service";
import { jsonError, requireSession } from "@/lib/http";
import { setSession } from "@/lib/session";
import {
  joinTeamWithInvitationForUser,
  serializeSessionTeamContext,
  TeamServiceError
} from "@/lib/team-service";
import { joinTeamSchema } from "@/lib/validation";

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

  const parsed = joinTeamSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Invitation token is invalid.");
  }

  try {
    const context = await joinTeamWithInvitationForUser(
      auth.session.userId,
      parsed.data.inviteToken
    );
    await setSession(serializeSessionTeamContext(context));

    const { board, team, teams } = await getBoardWorkspaceForUser(
      auth.session.userId,
      context.teamId
    );

    return NextResponse.json({ board: serializeBoard(board), team, teams });
  } catch (error) {
    return teamError(error);
  }
}
