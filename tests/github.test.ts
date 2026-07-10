import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeGitHubRepositoryUrl } from "../lib/github";

describe("GitHub repository normalization", () => {
  it("normalizes HTTPS and SSH GitHub URLs", () => {
    assert.deepEqual(
      normalizeGitHubRepositoryUrl("https://github.com/OpenAI/codex.git"),
      {
        name: "OpenAI/codex",
        url: "https://github.com/OpenAI/codex",
        urlKey: "https://github.com/openai/codex"
      }
    );

    assert.equal(
      normalizeGitHubRepositoryUrl("git@github.com:dmidnight/agent-board.git")
        .url,
      "https://github.com/dmidnight/agent-board"
    );
  });

  it("rejects non-GitHub and repository-subpath URLs", () => {
    assert.throws(() =>
      normalizeGitHubRepositoryUrl("https://example.com/acme/repo")
    );
    assert.throws(() =>
      normalizeGitHubRepositoryUrl("https://github.com/acme/repo/issues")
    );
  });
});
