import { NextResponse } from "next/server";
import { requireOwnedBoard, serializeBoard } from "@/lib/board-service";
import { jsonError, requireSession } from "@/lib/http";

type RouteContext = {
  params: Promise<{ boardId: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const auth = await requireSession();
  if (auth.response) {
    return auth.response;
  }

  const { boardId } = await params;
  const board = await requireOwnedBoard(auth.session.userId, boardId);

  if (!board) {
    return jsonError("Board not found.", 404);
  }

  return NextResponse.json({ board: serializeBoard(board) });
}
