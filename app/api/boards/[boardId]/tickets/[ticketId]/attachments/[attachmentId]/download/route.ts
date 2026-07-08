import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { getAttachmentObject } from "@/lib/attachment-storage";
import { findTicket, toId } from "@/lib/attachment-service";
import { requireOwnedBoard } from "@/lib/board-service";
import { jsonError, requireSession } from "@/lib/http";
import { Attachment } from "@/models/Attachment";

type RouteContext = {
  params: Promise<{ boardId: string; ticketId: string; attachmentId: string }>;
};

function contentDisposition(filename: string) {
  const fallback = filename.replace(/["\\\r\n]/g, "");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(
    filename
  )}`;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const auth = await requireSession();
  if (auth.response) {
    return auth.response;
  }

  const { boardId, ticketId, attachmentId } = await params;
  if (!Types.ObjectId.isValid(attachmentId)) {
    return jsonError("Attachment not found.", 404);
  }

  const board = await requireOwnedBoard(auth.session.userId, boardId);
  if (!board) {
    return jsonError("Board not found.", 404);
  }

  const ticket = findTicket(board, ticketId);
  if (!ticket) {
    return jsonError("Ticket not found.", 404);
  }

  const attachment = await Attachment.findOne({
    _id: attachmentId,
    teamId: board.teamId,
    boardId: board._id,
    ticketId
  });

  if (!attachment) {
    return jsonError("Attachment not found.", 404);
  }

  let body;
  try {
    body = await getAttachmentObject({
      key: attachment.objectKey,
      provider: attachment.provider,
      bucket: attachment.bucket
    });
  } catch {
    return jsonError("Attachment could not be read.", 502);
  }

  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": attachment.contentType,
      "Content-Length": String(body.byteLength),
      "Content-Disposition": contentDisposition(attachment.filename),
      "Cache-Control": "private, max-age=60",
      "X-Content-Type-Options": "nosniff",
      "X-Agent-Board-Attachment-Id": toId(attachment._id)
    }
  });
}
