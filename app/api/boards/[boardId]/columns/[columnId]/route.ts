import { NextResponse } from "next/server";
import { requireOwnedBoard, serializeBoard } from "@/lib/board-service";
import { jsonError, requireSession } from "@/lib/http";
import { updateColumnSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{ boardId: string; columnId: string }>;
};

function toId(value: unknown) {
  return String(value);
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await requireSession();
  if (auth.response) {
    return auth.response;
  }

  const parsed = updateColumnSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return jsonError("Column title is required.");
  }

  const { boardId, columnId } = await params;
  const board = await requireOwnedBoard(auth.session.userId, boardId);
  if (!board) {
    return jsonError("Board not found.", 404);
  }

  const column = board.columns.find(
    (candidate: any) => toId(candidate._id) === columnId
  );
  if (!column) {
    return jsonError("Column not found.", 404);
  }

  column.title = parsed.data.title;
  await board.save();

  return NextResponse.json({ board: serializeBoard(board) });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const auth = await requireSession();
  if (auth.response) {
    return auth.response;
  }

  const { boardId, columnId } = await params;
  const board = await requireOwnedBoard(auth.session.userId, boardId);
  if (!board) {
    return jsonError("Board not found.", 404);
  }

  if (board.columns.length <= 1) {
    return jsonError("A board needs at least one column.", 409);
  }

  const columnIndex = board.columns.findIndex(
    (candidate: any) => toId(candidate._id) === columnId
  );
  if (columnIndex < 0) {
    return jsonError("Column not found.", 404);
  }

  const hasTickets = board.tickets.some(
    (ticket: any) => toId(ticket.columnId) === columnId
  );
  if (hasTickets) {
    return jsonError("Move or delete tickets before deleting this column.", 409);
  }

  board.columns.splice(columnIndex, 1);
  board.columns
    .sort((a: any, b: any) => a.order - b.order)
    .forEach((column: any, index: number) => {
      column.order = index;
    });

  await board.save();

  return NextResponse.json({ board: serializeBoard(board) });
}
