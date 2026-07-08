import { NextResponse } from "next/server";
import { getBoardWorkspaceForUser, serializeBoard } from "@/lib/board-service";
import { jsonError, requireSession } from "@/lib/http";
import { setSession } from "@/lib/session";
import {
  createTeamForUserId,
  serializeSessionTeamContext,
  TeamServiceError
} from "@/lib/team-service";
import { createTeamSchema } from "@/lib/validation";

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

  const parsed = createTeamSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return jsonError("Team name must be between 2 and 80 characters.");
  }

  try {
    const context = await createTeamForUserId(
      auth.session.userId,
      parsed.data.teamName
    );
    await setSession(serializeSessionTeamContext(context));

    const { board, team, teams } = await getBoardWorkspaceForUser(
      auth.session.userId,
      context.teamId
    );

    return NextResponse.json(
      { board: serializeBoard(board), team, teams },
      { status: 201 }
    );
  } catch (error) {
    return teamError(error);
  }
}
