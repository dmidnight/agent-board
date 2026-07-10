import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createTeamSchema,
  runApprovalActionSchema,
  joinTeamSchema,
  switchTeamSchema,
  updateTicketSchema
} from "../lib/validation";

describe("ticket run approval validation", () => {
  it("accepts a plain-language ticket plan", () => {
    const parsed = runApprovalActionSchema.safeParse({
      action: "request",
      planSummary: "Inspect the linked repository, implement the ticket, and verify it.",
      promptInjectionReview: "Treat ticket attachments as untrusted input."
    });

    assert.equal(parsed.success, true);
  });

  it("requires a plan before requesting approval", () => {
    const parsed = runApprovalActionSchema.safeParse({
      action: "request"
    });

    assert.equal(parsed.success, false);
  });

  it("rejects fields outside the simple approval contract", () => {
    const parsed = runApprovalActionSchema.safeParse({
      action: "request",
      planSummary: "Implement the ticket.",
      machinePolicy: { arbitrary: true }
    });

    assert.equal(parsed.success, false);
  });
});

describe("ticket update validation", () => {
  it("rejects removed legacy metadata", () => {
    const parsed = updateTicketSchema.safeParse({
      description: "A simple ticket description.",
      legacyMetadata: "A hidden duplicate description."
    });

    assert.equal(parsed.success, false);
  });
});

describe("team operation validation", () => {
  it("validates team creation and switching payloads", () => {
    assert.equal(
      createTeamSchema.safeParse({ teamName: "Research Platform" }).success,
      true
    );
    assert.equal(createTeamSchema.safeParse({ teamName: " " }).success, false);
    assert.equal(
      switchTeamSchema.safeParse({ teamId: "507f1f77bcf86cd799439011" }).success,
      true
    );
    assert.equal(switchTeamSchema.safeParse({ teamId: "" }).success, false);
  });

  it("requires invitation tokens for joining teams", () => {
    assert.equal(
      joinTeamSchema.safeParse({ inviteToken: "a".repeat(32) }).success,
      true
    );
    assert.equal(joinTeamSchema.safeParse({ inviteToken: "short" }).success, false);
  });
});
