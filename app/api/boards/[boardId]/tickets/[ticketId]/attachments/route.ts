import { NextResponse } from "next/server";
import {
  buildAttachmentObjectKey,
  getAttachmentStorageConfig,
  putAttachmentObject
} from "@/lib/attachment-storage";
import {
  assertAgentUploadAllowed,
  findTicket,
  listTicketAttachments,
  sanitizeFilename,
  serializeAttachment,
  sha256,
  toId,
  type AttachmentSource
} from "@/lib/attachment-service";
import { requireOwnedBoard, serializeBoard } from "@/lib/board-service";
import { jsonError, requireSession } from "@/lib/http";
import { Attachment } from "@/models/Attachment";

type RouteContext = {
  params: Promise<{ boardId: string; ticketId: string }>;
};

function formString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function parseSource(value: FormDataEntryValue | null): AttachmentSource {
  return value === "agent" ? "agent" : "human";
}

function storageConfigError(error: unknown) {
  return error instanceof Error
    ? jsonError(error.message, 400)
    : jsonError("Attachment storage is not configured.", 400);
}

function storageWriteError() {
  return jsonError("Attachment could not be stored.", 502);
}

export async function GET(_request: Request, { params }: RouteContext) {
  const auth = await requireSession();
  if (auth.response) {
    return auth.response;
  }

  const { boardId, ticketId } = await params;
  const board = await requireOwnedBoard(auth.session.userId, boardId);
  if (!board) {
    return jsonError("Board not found.", 404);
  }

  const ticket = findTicket(board, ticketId);
  if (!ticket) {
    return jsonError("Ticket not found.", 404);
  }

  const attachments = await listTicketAttachments({
    teamId: toId(board.teamId),
    boardId: toId(board._id),
    ticketId
  });

  return NextResponse.json({ attachments });
}

export async function POST(request: Request, { params }: RouteContext) {
  const auth = await requireSession();
  if (auth.response) {
    return auth.response;
  }

  const { boardId, ticketId } = await params;
  const board = await requireOwnedBoard(auth.session.userId, boardId);
  if (!board) {
    return jsonError("Board not found.", 404);
  }

  const ticket = findTicket(board, ticketId);
  if (!ticket) {
    return jsonError("Ticket not found.", 404);
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return jsonError("Upload form data is required.");
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return jsonError("A file is required.");
  }

  let config;
  try {
    config = getAttachmentStorageConfig();
  } catch (error) {
    return storageConfigError(error);
  }
  if (file.size <= 0) {
    return jsonError("File is empty.");
  }

  if (file.size > config.maxBytes) {
    return jsonError(`File exceeds the ${config.maxBytes} byte limit.`, 413);
  }

  const source = parseSource(formData.get("source"));
  const approvalNonce = formString(formData.get("approvalNonce"));
  if (source === "agent") {
    try {
      assertAgentUploadAllowed(ticket, approvalNonce);
    } catch (error) {
      return error instanceof Error
        ? jsonError(error.message, 403)
        : jsonError("Agent upload is not approved.", 403);
    }
  }

  const filename = sanitizeFilename(file.name);
  const body = Buffer.from(await file.arrayBuffer());
  const checksumSha256 = sha256(body);
  const objectKey = buildAttachmentObjectKey({
    teamId: toId(board.teamId),
    ticketId,
    source,
    approvalNonce,
    filename
  });

  let stored;
  try {
    stored = await putAttachmentObject({
      key: objectKey,
      body,
      contentType: file.type || "application/octet-stream",
      metadata: {
        teamId: toId(board.teamId),
        boardId: toId(board._id),
        ticketId,
        source,
        checksumSha256
      }
    });
  } catch (error) {
    return storageWriteError();
  }

  const attachment = await Attachment.create({
    teamId: board.teamId,
    boardId: board._id,
    ticketId,
    uploadedBy: auth.session.userId,
    source,
    provider: stored.provider,
    bucket: stored.bucket,
    objectKey: stored.objectKey,
    filename,
    contentType: file.type || "application/octet-stream",
    size: file.size,
    checksumSha256,
    approvalNonce: source === "agent" ? approvalNonce : ""
  });

  ticket.attachmentsCount = (ticket.attachmentsCount ?? 0) + 1;
  board.markModified("tickets");
  await board.save();

  return NextResponse.json(
    {
      attachment: serializeAttachment(attachment),
      board: serializeBoard(board)
    },
    { status: 201 }
  );
}
