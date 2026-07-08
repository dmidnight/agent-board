import crypto from "crypto";
import { NextResponse } from "next/server";
import { requireOwnedBoard, serializeBoard } from "@/lib/board-service";
import { jsonError, requireSession } from "@/lib/http";
import { executionApprovalActionSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{ boardId: string; ticketId: string }>;
};

function toId(value: unknown) {
  return String(value);
}

function actorFromSession(session: { email: string; name?: string }) {
  return session.name ? `${session.name} <${session.email}>` : session.email;
}

function approvalToObject(approval: any) {
  if (!approval) {
    return {};
  }

  return approval.toObject ? approval.toObject() : { ...approval };
}

function normalizeApproval(approval: any) {
  return {
    ...approval,
    executionMode:
      approval.executionMode === "local_agent" ||
      approval.executionMode === "ci_runner"
        ? approval.executionMode
        : "plan_only"
  };
}

export async function POST(request: Request, { params }: RouteContext) {
  const auth = await requireSession();
  if (auth.response) {
    return auth.response;
  }

  const parsed = executionApprovalActionSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Execution approval action is invalid."
    );
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

  const now = new Date();
  const actor = actorFromSession(auth.session);
  const currentApproval = normalizeApproval(
    approvalToObject(ticket.executionApproval)
  );

  switch (parsed.data.action) {
    case "request":
      ticket.executionApproval = {
        status: "pending",
        executionMode: parsed.data.executionMode,
        requestedBy: actor,
        requestedAt: now,
        approvedBy: "",
        approvedAt: null,
        rejectedBy: "",
        rejectedAt: null,
        rejectionReason: "",
        allowedWorkspace: parsed.data.allowedWorkspace,
        allowedFileGlobs: parsed.data.allowedFileGlobs,
        allowedCommands: parsed.data.allowedCommands,
        networkAccess: parsed.data.networkAccess,
        secretAccess: parsed.data.secretAccess,
        approvalNonce: "",
        planSummary: parsed.data.planSummary ?? "",
        promptInjectionReview: parsed.data.promptInjectionReview ?? "",
        resultSummary: ""
      };
      break;

    case "approve":
      if (currentApproval.status !== "pending") {
        return jsonError("Only pending execution requests can be approved.");
      }

      ticket.executionApproval = {
        ...currentApproval,
        status: "approved",
        approvedBy: actor,
        approvedAt: now,
        rejectedBy: "",
        rejectedAt: null,
        rejectionReason: "",
        approvalNonce: crypto.randomUUID()
      };
      break;

    case "reject":
      if (
        currentApproval.status !== "pending" &&
        currentApproval.status !== "approved"
      ) {
        return jsonError("Only requested or approved runs can be rejected.");
      }

      ticket.executionApproval = {
        ...currentApproval,
        status: "rejected",
        approvedBy: "",
        approvedAt: null,
        rejectedBy: actor,
        rejectedAt: now,
        rejectionReason: parsed.data.rejectionReason,
        approvalNonce: ""
      };
      break;

    case "expire":
      if (
        currentApproval.status !== "pending" &&
        currentApproval.status !== "approved"
      ) {
        return jsonError("Only requested or approved runs can expire.");
      }

      ticket.executionApproval = {
        ...currentApproval,
        status: "expired",
        approvedBy: "",
        approvedAt: null,
        approvalNonce: ""
      };
      break;

    case "record_result":
      if (currentApproval.status !== "approved") {
        return jsonError("Only approved runs can record results.");
      }

      ticket.executionApproval = {
        ...currentApproval,
        resultSummary: parsed.data.resultSummary
      };
      break;
  }

  board.markModified("tickets");
  await board.save();

  return NextResponse.json({ board: serializeBoard(board) });
}
