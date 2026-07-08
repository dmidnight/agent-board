import { Types } from "mongoose";
import { NextResponse } from "next/server";
import {
  normalizeTicketOrder,
  requireOwnedBoard,
  serializeBoard
} from "@/lib/board-service";
import { jsonError, requireSession } from "@/lib/http";
import { moveTicketSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{ boardId: string; ticketId: string }>;
};

function toId(value: unknown) {
  return String(value);
}

export async function POST(request: Request, { params }: RouteContext) {
  const auth = await requireSession();
  if (auth.response) {
    return auth.response;
  }

  const parsed = moveTicketSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Move target is invalid.");
  }

  const { boardId, ticketId } = await params;
  const board = await requireOwnedBoard(auth.session.userId, boardId);
  if (!board) {
    return jsonError("Board not found.", 404);
  }

  const targetColumn = board.columns.find(
    (column: any) => toId(column._id) === parsed.data.columnId
  );
  if (!targetColumn) {
    return jsonError("Column not found.", 404);
  }

  const ticket = board.tickets.find(
    (candidate: any) => toId(candidate._id) === ticketId
  );
  if (!ticket) {
    return jsonError("Ticket not found.", 404);
  }

  const previousColumnId = toId(ticket.columnId);
  ticket.columnId = new Types.ObjectId(parsed.data.columnId);

  const targetTickets = board.tickets
    .filter(
      (candidate: any) =>
        toId(candidate._id) !== ticketId &&
        toId(candidate.columnId) === parsed.data.columnId
    )
    .sort((a: any, b: any) => a.order - b.order);

  let insertAt = targetTickets.length;
  if (parsed.data.beforeTicketId) {
    const beforeIndex = targetTickets.findIndex(
      (candidate: any) => toId(candidate._id) === parsed.data.beforeTicketId
    );
    if (beforeIndex >= 0) {
      insertAt = beforeIndex;
    }
  } else if (parsed.data.afterTicketId) {
    const afterIndex = targetTickets.findIndex(
      (candidate: any) => toId(candidate._id) === parsed.data.afterTicketId
    );
    if (afterIndex >= 0) {
      insertAt = afterIndex + 1;
    }
  }

  targetTickets.splice(insertAt, 0, ticket);
  targetTickets.forEach((candidate: any, index: number) => {
    candidate.order = index;
  });

  if (previousColumnId !== parsed.data.columnId) {
    normalizeTicketOrder(board, previousColumnId);
  }

  board.markModified("tickets");
  await board.save();

  return NextResponse.json({ board: serializeBoard(board) });
}
