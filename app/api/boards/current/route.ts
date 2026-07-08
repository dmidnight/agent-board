import { NextResponse } from "next/server";
import { getBoardWorkspaceForUser, serializeBoard } from "@/lib/board-service";
import { jsonError, requireSession } from "@/lib/http";
import { TeamServiceError } from "@/lib/team-service";

export async function GET() {
  const auth = await requireSession();
  if (auth.response) {
    return auth.response;
  }

  try {
    const { board, team, teams } = await getBoardWorkspaceForUser(
      auth.session.userId,
      auth.session.teamId
    );
    return NextResponse.json({ board: serializeBoard(board), team, teams });
  } catch (error) {
    if (error instanceof TeamServiceError) {
      return jsonError(error.message, error.status);
    }

    throw error;
  }
}
