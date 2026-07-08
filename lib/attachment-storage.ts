import crypto from "crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Storage } from "@google-cloud/storage";

export type AttachmentStorageProvider = "s3" | "gcs";

export type AttachmentStorageConfig = {
  provider: AttachmentStorageProvider;
  bucket: string;
  basePrefix: string;
  maxBytes: number;
  region: string;
  endpoint?: string;
  forcePathStyle: boolean;
};

type PutObjectInput = {
  key: string;
  body: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
};

function readBoolean(value: string | undefined, fallback = false) {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return fallback;
}

function readNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function storageProvider(): AttachmentStorageProvider {
  const provider =
    process.env.ATTACHMENT_STORAGE_PROVIDER ??
    process.env.STORAGE_PROVIDER ??
    (process.env.GCS_ATTACHMENTS_BUCKET ? "gcs" : "s3");

  if (provider === "gcs" || provider === "s3") {
    return provider;
  }

  throw new Error("ATTACHMENT_STORAGE_PROVIDER must be either s3 or gcs.");
}

export function getAttachmentStorageConfig(): AttachmentStorageConfig {
  const provider = storageProvider();
  const bucket =
    process.env.ATTACHMENT_BUCKET ??
    process.env.STORAGE_BUCKET ??
    process.env.S3_ATTACHMENTS_BUCKET ??
    process.env.GCS_ATTACHMENTS_BUCKET ??
    "";

  if (!bucket) {
    throw new Error("Attachment storage bucket is not configured.");
  }

  const endpoint =
    process.env.ATTACHMENT_ENDPOINT ??
    process.env.STORAGE_ENDPOINT ??
    process.env.S3_ENDPOINT;

  return {
    provider,
    bucket,
    basePrefix:
      process.env.ATTACHMENT_BASE_PREFIX ??
      process.env.STORAGE_BASE_PREFIX ??
      process.env.GCS_ATTACHMENTS_BASE_PREFIX ??
      "attachments",
    maxBytes: readNumber(
      process.env.ATTACHMENT_MAX_BYTES,
      10 * 1024 * 1024
    ),
    region:
      process.env.ATTACHMENT_REGION ??
      process.env.AWS_REGION ??
      process.env.AWS_DEFAULT_REGION ??
      "us-east-1",
    endpoint,
    forcePathStyle: readBoolean(
      process.env.ATTACHMENT_FORCE_PATH_STYLE ??
        process.env.S3_FORCE_PATH_STYLE,
      Boolean(endpoint)
    )
  };
}

function normalizeKeyPart(value: string) {
  return value.replace(/^\/+|\/+$/g, "");
}

export function buildAttachmentObjectKey({
  teamId,
  ticketId,
  source,
  approvalNonce,
  filename
}: {
  teamId: string;
  ticketId: string;
  source: "human" | "agent";
  approvalNonce?: string;
  filename: string;
}) {
  const { basePrefix } = getAttachmentStorageConfig();
  const parts = [
    normalizeKeyPart(basePrefix),
    "teams",
    normalizeKeyPart(teamId),
    "tickets",
    normalizeKeyPart(ticketId),
    source
  ];

  if (source === "agent") {
    parts.push(normalizeKeyPart(approvalNonce || "agent"));
  }

  parts.push(`${crypto.randomUUID()}-${filename}`);
  return parts.filter(Boolean).join("/");
}

function getS3Client(config: AttachmentStorageConfig) {
  const accessKeyId =
    process.env.ATTACHMENT_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.ATTACHMENT_SECRET_ACCESS_KEY ??
    process.env.AWS_SECRET_ACCESS_KEY;

  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials:
      accessKeyId && secretAccessKey
        ? {
            accessKeyId,
            secretAccessKey
          }
        : undefined
  });
}

async function putS3Object(config: AttachmentStorageConfig, input: PutObjectInput) {
  const client = getS3Client(config);
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      Metadata: input.metadata
    })
  );
}

async function getS3Object(config: AttachmentStorageConfig, key: string) {
  const client = getS3Client(config);
  const response = await client.send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key
    })
  );

  const bytes = await response.Body?.transformToByteArray();
  if (!bytes) {
    throw new Error("Attachment object could not be read.");
  }

  return Buffer.from(bytes);
}

function getGcsStorage() {
  const projectId =
    process.env.ATTACHMENT_GCS_PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT;
  return new Storage(projectId ? { projectId } : undefined);
}

async function putGcsObject(config: AttachmentStorageConfig, input: PutObjectInput) {
  const storage = getGcsStorage();
  await storage.bucket(config.bucket).file(input.key).save(input.body, {
    contentType: input.contentType,
    metadata: {
      metadata: input.metadata
    },
    resumable: false
  });
}

async function getGcsObject(config: AttachmentStorageConfig, key: string) {
  const storage = getGcsStorage();
  const [contents] = await storage.bucket(config.bucket).file(key).download();
  return contents;
}

export async function putAttachmentObject(input: PutObjectInput) {
  const config = getAttachmentStorageConfig();

  if (config.provider === "gcs") {
    await putGcsObject(config, input);
  } else {
    await putS3Object(config, input);
  }

  return {
    provider: config.provider,
    bucket: config.bucket,
    objectKey: input.key
  };
}

export async function getAttachmentObject(input: {
  key: string;
  provider?: AttachmentStorageProvider;
  bucket?: string;
}) {
  const currentConfig = getAttachmentStorageConfig();
  const config = {
    ...currentConfig,
    provider: input.provider ?? currentConfig.provider,
    bucket: input.bucket ?? currentConfig.bucket
  };

  return config.provider === "gcs"
    ? getGcsObject(config, input.key)
    : getS3Object(config, input.key);
}
