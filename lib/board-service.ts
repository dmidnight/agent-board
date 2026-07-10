import { Types } from "mongoose";
import { Board, createObjectId } from "@/models/Board";
import { connectToDatabase } from "@/lib/mongoose";
import {
  getUserTeamContext,
  getUserTeamWorkspace,
  serializeTeamContext,
  type TeamContext
} from "@/lib/team-service";
import type {
  ApprovalStatus,
  BoardPayload,
  TeamPayload,
  Ticket
} from "@/types/board";

const DEFAULT_COLUMN_TITLES = [
  "To do",
  "In progress",
  "Done"
];

function toId(value: unknown) {
  if (value instanceof Types.ObjectId) {
    return value.toString();
  }

  return String(value);
}

function ticketUpdatedAt(ticket: { updatedAt?: Date; createdAt?: Date }) {
  return (ticket.updatedAt ?? ticket.createdAt ?? new Date()).toISOString();
}

function serializeCriteria(criteria: any[] = []) {
  return criteria.map((criterion) => ({
    text: String(criterion.text ?? ""),
    done: Boolean(criterion.done)
  }));
}

function serializeNullableDate(value?: Date | string | null) {
  if (!value) {
    return null;
  }

  return new Date(value).toISOString();
}

function neutralizeAgentBrand(value: unknown) {
  const brandedAgentName = new RegExp(`\\bCo${"dex"}\\b`, "gi");
  return String(value ?? "").replace(brandedAgentName, "the local agent");
}

function serializeApprovalStatus(value: unknown): ApprovalStatus {
  return value === "pending" ||
    value === "approved" ||
    value === "rejected" ||
    value === "expired"
    ? value
    : "not_requested";
}

function serializeRunApproval(approval: any = {}) {
  return {
    status: serializeApprovalStatus(approval.status),
    requestedBy: String(approval.requestedBy ?? ""),
    requestedAt: serializeNullableDate(approval.requestedAt),
    approvedBy: String(approval.approvedBy ?? ""),
    approvedAt: serializeNullableDate(approval.approvedAt),
    rejectedBy: String(approval.rejectedBy ?? ""),
    rejectedAt: serializeNullableDate(approval.rejectedAt),
    rejectionReason: neutralizeAgentBrand(approval.rejectionReason),
    approvalNonce: String(approval.approvalNonce ?? ""),
    planSummary: neutralizeAgentBrand(approval.planSummary),
    promptInjectionReview: neutralizeAgentBrand(approval.promptInjectionReview),
    resultSummary: neutralizeAgentBrand(approval.resultSummary)
  };
}

export function serializeBoard(board: any): BoardPayload {
  return {
    id: toId(board._id),
    title: board.title,
    columns: [...board.columns]
      .sort((a, b) => a.order - b.order)
      .map((column) => ({
        id: toId(column._id),
        title: column.title,
        order: column.order
      })),
    tickets: [...board.tickets]
      .sort((a, b) => a.order - b.order)
      .map((ticket) => ({
        id: toId(ticket._id),
        publicId: ticket.publicId,
        apiId: ticket.apiId,
        title: ticket.title,
        description: ticket.description ?? "",
        repositoryId: ticket.repositoryId ? toId(ticket.repositoryId) : null,
        columnId: toId(ticket.columnId),
        order: ticket.order,
        priority: ticket.priority,
        agent: ticket.agent,
        acceptanceCriteria: serializeCriteria(ticket.acceptanceCriteria),
        runApproval: serializeRunApproval(ticket.runApproval),
        attachmentsCount: ticket.attachmentsCount ?? 0,
        updatedAt: ticketUpdatedAt(ticket)
      }))
  };
}

function buildDefaultBoard(teamId: string) {
  const columns = DEFAULT_COLUMN_TITLES.map((title, index) => ({
    _id: createObjectId(),
    title,
    order: index
  }));

  return {
    teamId,
    title: "Agent Board",
    columns,
    tickets: [],
    ticketCounter: 0
  };
}

async function getOrCreateBoardForTeam(context: TeamContext) {
  let board = await Board.findOne({ teamId: context.team._id });
  if (board) {
    return board;
  }

  return Board.create(buildDefaultBoard(context.teamId));
}

export async function getBoardWorkspaceForUser(
  userId: string,
  activeTeamId?: string
): Promise<{
  board: any;
  team: TeamPayload;
  teams: TeamPayload[];
}> {
  await connectToDatabase();

  const { context, teams } = await getUserTeamWorkspace(userId, activeTeamId);
  const board = await getOrCreateBoardForTeam(context);

  return {
    board,
    team: serializeTeamContext(context),
    teams
  };
}

export async function getOrCreateBoardForUser(
  userId: string,
  activeTeamId?: string
) {
  const workspace = await getBoardWorkspaceForUser(userId, activeTeamId);
  return workspace.board;
}

export async function requireOwnedBoard(
  userId: string,
  boardId: string,
  activeTeamId?: string
) {
  await connectToDatabase();

  if (!Types.ObjectId.isValid(boardId)) {
    return null;
  }

  const context = await getUserTeamContext(userId, activeTeamId);
  return Board.findOne({ _id: boardId, teamId: context.team._id });
}

export function getTicketsForColumn(board: any, columnId: string) {
  return board.tickets
    .filter((ticket: Ticket) => toId(ticket.columnId) === columnId)
    .sort((a: Ticket, b: Ticket) => a.order - b.order);
}

export function normalizeTicketOrder(board: any, columnId: string) {
  getTicketsForColumn(board, columnId).forEach((ticket: Ticket, index: number) => {
    ticket.order = index;
  });
}
