import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizeFilename, sha256 } from "../lib/attachment-service";

describe("attachment service helpers", () => {
  it("sanitizes filenames before using them in object keys or headers", () => {
    assert.equal(
      sanitizeFilename(' ../bad\\name<>:"|?*\n.png '),
      "..-bad-name--------.png"
    );
    assert.equal(sanitizeFilename("   "), "attachment");
  });

  it("calculates stable SHA-256 checksums", () => {
    assert.equal(
      sha256(Buffer.from("agent-board")),
      "21d39a9b1d5f5a523550260a6182fe66c6f74fd261cc00ccd7f04c22de600364"
    );
  });
});
