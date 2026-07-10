import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildInvitationUrl,
  isInvitationEmailConfigured,
  sendTeamInvitationEmail
} from "../lib/invitation-email";

describe("team invitation email", () => {
  it("uses the configured public URL or forwarded ingress host", () => {
    const request = new Request("http://0.0.0.0:3000/api/teams/invitations", {
      headers: {
        host: "internal:3000",
        "x-forwarded-host": "board.example.com",
        "x-forwarded-proto": "https"
      }
    });

    assert.equal(
      buildInvitationUrl(request, "token"),
      "https://board.example.com/login?invite=token"
    );
    assert.equal(
      buildInvitationUrl(request, "token").includes("0.0.0.0"),
      false
    );
  });

  it("only reports email as configured when key and sender are present", () => {
    assert.equal(isInvitationEmailConfigured({ SENDGRID_API_KEY: "key" }), false);
    assert.equal(
      isInvitationEmailConfigured({
        SENDGRID_API_KEY: "key",
        INVITATION_FROM_EMAIL: "invites@example.com"
      }),
      true
    );
  });

  it("posts invitation mail to SendGrid", async () => {
    let requestBody = "";
    const fetchMock: typeof fetch = async (_input, init) => {
      requestBody = String(init?.body ?? "");
      return new Response(null, { status: 202 });
    };

    await sendTeamInvitationEmail(
      {
        to: "person@example.com",
        teamName: "Platform",
        inviter: "Ian",
        inviteUrl: "https://board.example.com/login?invite=token",
        expiresAt: new Date("2026-07-16T12:00:00Z")
      },
      {
        SENDGRID_API_KEY: "secret",
        INVITATION_FROM_EMAIL: "invites@example.com"
      },
      fetchMock
    );

    const payload = JSON.parse(requestBody);
    assert.equal(payload.personalizations[0].to[0].email, "person@example.com");
    assert.equal(payload.from.email, "invites@example.com");
  });
});
