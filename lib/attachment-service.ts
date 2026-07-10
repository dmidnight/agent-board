import crypto from "crypto";
import { Types } from "mongoose";
import { Attachment } from "@/models/Attachment";
import type { AttachmentPayload } from "@/types/board";

export type AttachmentSource = "human" | "agent";

export function toId(value: unknown) {
  if (value instanceof Types.ObjectId) {
    return value.toString();
  }

  return String(value);
}

export function serializeAttachment(attachment: any): AttachmentPayload {
  return {
    id: toId(attachment._id),
    filename: String(attachment.filename ?? ""),
    contentType: String(attachment.contentType ?? "application/octet-stream"),
    size: Number(attachment.size ?? 0),
    source: attachment.source === "agent" ? "agent" : "human",
    uploadedBy: toId(attachment.uploadedBy),
    approvalNonce: String(attachment.approvalNonce ?? ""),
    createdAt: new Date(attachment.createdAt ?? new Date()).toISOString()
  };
}

export function sanitizeFilename(filename: string) {
  const cleaned = filename
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/[\x00-\x1f\x7f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);

  return cleaned || "attachment";
}

export function sha256(value: Buffer) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function findTicket(board: any, ticketId: string) {
  return board.tickets.find((ticket: any) => toId(ticket._id) === ticketId);
}

export function assertAgentUploadAllowed(ticket: any, approvalNonce: string) {
  const approval = ticket.runApproval;
  if (approval?.status !== "approved" || !approval?.approvalNonce) {
    throw new Error("Agent uploads require an approved ticket run.");
  }

  if (approval.approvalNonce !== approvalNonce) {
    throw new Error("Agent upload approval nonce is invalid.");
  }
}

export async function listTicketAttachments({
  teamId,
  boardId,
  ticketId
}: {
  teamId: string;
  boardId: string;
  ticketId: string;
}) {
  const attachments = await Attachment.find({
    teamId,
    boardId,
    ticketId
  }).sort({ createdAt: -1 });

  return attachments.map(serializeAttachment);
}
