import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createTeamSchema,
  executionApprovalActionSchema,
  joinTeamSchema,
  switchTeamSchema
} from "../lib/validation";

describe("execution approval validation", () => {
  it("accepts portable execution scopes", () => {
    const parsed = executionApprovalActionSchema.safeParse({
      action: "request",
      executionMode: "local_agent",
      allowedWorkspace: "Current repository checkout",
      allowedFileGlobs: ["app/**", "lib/**"],
      allowedCommands: ["npm run lint"],
      networkAccess: "none",
      secretAccess: "none"
    });

    assert.equal(parsed.success, true);
  });

  it("rejects developer-specific absolute paths", () => {
    for (const allowedWorkspace of [
      "/Users/alice/project",
      "~/project",
      "C:\\Users\\Alice\\project"
    ]) {
      const parsed = executionApprovalActionSchema.safeParse({
        action: "request",
        executionMode: "local_agent",
        allowedWorkspace,
        allowedFileGlobs: ["app/**"],
        allowedCommands: ["npm run lint"],
        networkAccess: "none",
        secretAccess: "none"
      });

      assert.equal(parsed.success, false);
    }
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
