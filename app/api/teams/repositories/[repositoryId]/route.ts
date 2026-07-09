import { NextResponse } from "next/server";
import { jsonError, requireSession } from "@/lib/http";
import {
  removeTeamRepository,
  serializeTeamContext,
  TeamServiceError
} from "@/lib/team-service";

type RouteContext = {
  params: Promise<{ repositoryId: string }>;
};

export async function DELETE(_request: Request, { params }: RouteContext) {
  const auth = await requireSession();
  if (auth.response) {
    return auth.response;
  }

  try {
    const { repositoryId } = await params;
    const { context, teams } = await removeTeamRepository(
      auth.session.userId,
      auth.session.teamId,
      repositoryId
    );

    return NextResponse.json({ team: serializeTeamContext(context), teams });
  } catch (error) {
    if (error instanceof TeamServiceError) {
      return jsonError(error.message, error.status);
    }

    throw error;
  }
}
