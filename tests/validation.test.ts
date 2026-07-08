import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { executionApprovalActionSchema } from "../lib/validation";

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
