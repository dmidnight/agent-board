import { NextResponse } from "next/server";
import { requireOwnedBoard, serializeBoard } from "@/lib/board-service";
import { jsonError, requireSession } from "@/lib/http";
import { createColumnSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{ boardId: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const auth = await requireSession();
  if (auth.response) {
    return auth.response;
  }

  const parsed = createColumnSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return jsonError("Column title is required.");
  }

  const { boardId } = await params;
  const board = await requireOwnedBoard(
    auth.session.userId,
    boardId,
    auth.session.teamId
  );
  if (!board) {
    return jsonError("Board not found.", 404);
  }

  board.columns.push({
    title: parsed.data.title,
    order: board.columns.length,
    agentStage: "custom",
    wipLimit: null
  });

  await board.save();

  return NextResponse.json({ board: serializeBoard(board) }, { status: 201 });
}
