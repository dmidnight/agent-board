import { NextResponse } from "next/server";
import { jsonError, requireSession } from "@/lib/http";
import {
  addTeamRepository,
  serializeTeamContext,
  TeamServiceError
} from "@/lib/team-service";
import { addTeamRepositorySchema } from "@/lib/validation";

export async function POST(request: Request) {
  const auth = await requireSession();
  if (auth.response) {
    return auth.response;
  }

  const parsed = addTeamRepositorySchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return jsonError("Enter a valid GitHub repository URL.");
  }

  try {
    const { context, teams } = await addTeamRepository(
      auth.session.userId,
      auth.session.teamId,
      parsed.data.url
    );

    return NextResponse.json(
      { team: serializeTeamContext(context), teams },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof TeamServiceError) {
      return jsonError(error.message, error.status);
    }

    throw error;
  }
}
