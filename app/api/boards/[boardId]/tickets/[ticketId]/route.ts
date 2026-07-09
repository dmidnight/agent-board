import { NextResponse } from "next/server";
import { requireOwnedBoard, serializeBoard } from "@/lib/board-service";
import { jsonError, requireSession } from "@/lib/http";
import { teamHasRepository } from "@/lib/team-service";
import { updateTicketSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{ boardId: string; ticketId: string }>;
};

function toId(value: unknown) {
  return String(value);
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await requireSession();
  if (auth.response) {
    return auth.response;
  }

  const parsed = updateTicketSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return jsonError("Ticket update is invalid.");
  }

  const { boardId, ticketId } = await params;
  const board = await requireOwnedBoard(
    auth.session.userId,
    boardId,
    auth.session.teamId
  );
  if (!board) {
    return jsonError("Board not found.", 404);
  }

  const ticket = board.tickets.find(
    (candidate: any) => toId(candidate._id) === ticketId
  );
  if (!ticket) {
    return jsonError("Ticket not found.", 404);
  }

  if (
    parsed.data.repositoryId &&
    !(await teamHasRepository(
      auth.session.userId,
      auth.session.teamId,
      parsed.data.repositoryId
    ))
  ) {
    return jsonError("Repository not found for this team.", 404);
  }

  Object.entries(parsed.data).forEach(([key, value]) => {
    ticket.set(key, value);
  });

  await board.save();

  return NextResponse.json({ board: serializeBoard(board) });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const auth = await requireSession();
  if (auth.response) {
    return auth.response;
  }

  const { boardId, ticketId } = await params;
  const board = await requireOwnedBoard(
    auth.session.userId,
    boardId,
    auth.session.teamId
  );
  if (!board) {
    return jsonError("Board not found.", 404);
  }

  const ticketIndex = board.tickets.findIndex(
    (candidate: any) => toId(candidate._id) === ticketId
  );
  if (ticketIndex < 0) {
    return jsonError("Ticket not found.", 404);
  }

  const columnId = toId(board.tickets[ticketIndex].columnId);
  board.tickets.splice(ticketIndex, 1);
  board.tickets
    .filter((candidate: any) => toId(candidate.columnId) === columnId)
    .sort((a: any, b: any) => a.order - b.order)
    .forEach((candidate: any, index: number) => {
      candidate.order = index;
    });

  await board.save();

  return NextResponse.json({ board: serializeBoard(board) });
}
