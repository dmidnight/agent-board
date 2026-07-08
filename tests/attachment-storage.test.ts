import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  buildAttachmentObjectKey,
  getAttachmentStorageConfig
} from "../lib/attachment-storage";

const originalEnv = { ...process.env };

function resetEnv() {
  process.env = { ...originalEnv };
  delete process.env.ATTACHMENT_STORAGE_PROVIDER;
  delete process.env.STORAGE_PROVIDER;
  delete process.env.ATTACHMENT_BUCKET;
  delete process.env.STORAGE_BUCKET;
  delete process.env.S3_ATTACHMENTS_BUCKET;
  delete process.env.GCS_ATTACHMENTS_BUCKET;
  delete process.env.ATTACHMENT_BASE_PREFIX;
  delete process.env.STORAGE_BASE_PREFIX;
  delete process.env.GCS_ATTACHMENTS_BASE_PREFIX;
  delete process.env.ATTACHMENT_MAX_BYTES;
  delete process.env.ATTACHMENT_REGION;
  delete process.env.AWS_REGION;
  delete process.env.AWS_DEFAULT_REGION;
  delete process.env.ATTACHMENT_ENDPOINT;
  delete process.env.STORAGE_ENDPOINT;
  delete process.env.S3_ENDPOINT;
  delete process.env.ATTACHMENT_FORCE_PATH_STYLE;
  delete process.env.S3_FORCE_PATH_STYLE;
}

beforeEach(resetEnv);
afterEach(resetEnv);

describe("attachment storage config", () => {
  it("reads the local S3-compatible MinIO configuration", () => {
    process.env.ATTACHMENT_STORAGE_PROVIDER = "s3";
    process.env.ATTACHMENT_BUCKET = "agent-board-attachments";
    process.env.ATTACHMENT_ENDPOINT = "http://localhost:9000";
    process.env.ATTACHMENT_MAX_BYTES = "2048";

    assert.deepEqual(getAttachmentStorageConfig(), {
      provider: "s3",
      bucket: "agent-board-attachments",
      basePrefix: "attachments",
      maxBytes: 2048,
      region: "us-east-1",
      endpoint: "http://localhost:9000",
      forcePathStyle: true
    });
  });

  it("supports native Google Cloud Storage configuration", () => {
    process.env.ATTACHMENT_STORAGE_PROVIDER = "gcs";
    process.env.ATTACHMENT_BUCKET = "agent-board-prod";
    process.env.ATTACHMENT_BASE_PREFIX = "tenant-files";

    const config = getAttachmentStorageConfig();

    assert.equal(config.provider, "gcs");
    assert.equal(config.bucket, "agent-board-prod");
    assert.equal(config.basePrefix, "tenant-files");
  });

  it("fails closed when the provider or bucket is invalid", () => {
    process.env.ATTACHMENT_STORAGE_PROVIDER = "local-disk";
    process.env.ATTACHMENT_BUCKET = "agent-board-attachments";

    assert.throws(
      () => getAttachmentStorageConfig(),
      /ATTACHMENT_STORAGE_PROVIDER/
    );

    process.env.ATTACHMENT_STORAGE_PROVIDER = "s3";
    delete process.env.ATTACHMENT_BUCKET;

    assert.throws(
      () => getAttachmentStorageConfig(),
      /Attachment storage bucket/
    );
  });
});

describe("attachment object keys", () => {
  it("builds tenant-scoped human upload keys", () => {
    process.env.ATTACHMENT_STORAGE_PROVIDER = "s3";
    process.env.ATTACHMENT_BUCKET = "agent-board-attachments";

    const key = buildAttachmentObjectKey({
      teamId: "team-1",
      ticketId: "ticket-1",
      source: "human",
      filename: "design.png"
    });

    assert.match(
      key,
      /^attachments\/teams\/team-1\/tickets\/ticket-1\/human\/[0-9a-f-]+-design\.png$/
    );
  });

  it("includes the approval nonce in agent upload keys", () => {
    process.env.ATTACHMENT_STORAGE_PROVIDER = "s3";
    process.env.ATTACHMENT_BUCKET = "agent-board-attachments";

    const key = buildAttachmentObjectKey({
      teamId: "team-1",
      ticketId: "ticket-1",
      source: "agent",
      approvalNonce: "approval-123",
      filename: "result.txt"
    });

    assert.match(
      key,
      /^attachments\/teams\/team-1\/tickets\/ticket-1\/agent\/approval-123\/[0-9a-f-]+-result\.txt$/
    );
  });
});
