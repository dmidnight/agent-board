import { NextResponse } from "next/server";
import {
  normalizeTicketOrder,
  requireOwnedBoard,
  serializeBoard
} from "@/lib/board-service";
import { jsonError, requireSession } from "@/lib/http";
import { teamHasRepository } from "@/lib/team-service";
import { createTicketSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{ boardId: string }>;
};

function toId(value: unknown) {
  return String(value);
}

export async function POST(request: Request, { params }: RouteContext) {
  const auth = await requireSession();
  if (auth.response) {
    return auth.response;
  }

  const parsed = createTicketSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return jsonError("Ticket title and column are required.");
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

  const column = board.columns.find(
    (candidate: any) => toId(candidate._id) === parsed.data.columnId
  );
  if (!column) {
    return jsonError("Column not found.", 404);
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

  normalizeTicketOrder(board, parsed.data.columnId);
  board.ticketCounter += 1;

  const publicId = `AB-${board.ticketCounter}`;
  const columnTickets = board.tickets.filter(
    (ticket: any) => toId(ticket.columnId) === parsed.data.columnId
  );

  board.tickets.push({
    publicId,
    apiId: `ticket.${publicId.toLowerCase()}`,
    title: parsed.data.title,
    description: "",
    repositoryId: parsed.data.repositoryId ?? null,
    columnId: column._id,
    order: columnTickets.length,
    priority: parsed.data.priority ?? "P2",
    agent: "Unassigned",
    acceptanceCriteria: [],
    runApproval: {
      status: "not_requested"
    },
    attachmentsCount: 0
  });

  await board.save();

  return NextResponse.json({ board: serializeBoard(board) }, { status: 201 });
}
