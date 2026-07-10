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

  it("logs SendGrid rejection details without invitation secrets", async () => {
    const logEntries: string[] = [];
    const inviteUrl = "https://board.example.com/login?invite=secret-token";
    const fetchMock: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          errors: [
            {
              message: `Sender is not verified for person@example.com. ${inviteUrl}`,
              field: "from"
            }
          ]
        }),
        {
          status: 403,
          statusText: "Forbidden",
          headers: { "x-request-id": "sendgrid-request-123" }
        }
      );

    await assert.rejects(
      sendTeamInvitationEmail(
        {
          to: "person@example.com",
          teamName: "Platform",
          inviter: "Ian",
          inviteUrl,
          expiresAt: new Date("2026-07-16T12:00:00Z")
        },
        {
          SENDGRID_API_KEY: "sendgrid-secret-key",
          INVITATION_FROM_EMAIL: "invites@example.com"
        },
        fetchMock,
        (entry) => logEntries.push(entry)
      ),
      /403.*server logs/
    );

    assert.equal(logEntries.length, 1);
    const logEntry = JSON.parse(logEntries[0]);
    assert.equal(logEntry.severity, "ERROR");
    assert.equal(logEntry.event, "invitation_email_delivery_failed");
    assert.equal(logEntry.failureType, "provider_rejected");
    assert.equal(logEntry.httpStatus, 403);
    assert.equal(logEntry.providerRequestId, "sendgrid-request-123");
    assert.equal(logEntry.configuredFromEmail, "invites@example.com");
    assert.equal(logEntry.recipientDomain, "example.com");

    const serializedLog = JSON.stringify(logEntry);
    assert.equal(serializedLog.includes("person@example.com"), false);
    assert.equal(serializedLog.includes("secret-token"), false);
    assert.equal(serializedLog.includes("sendgrid-secret-key"), false);
    assert.equal(serializedLog.includes("[REDACTED]"), true);
  });

  it("logs missing email configuration", async () => {
    const logEntries: string[] = [];

    await assert.rejects(
      sendTeamInvitationEmail(
        {
          to: "person@example.com",
          teamName: "Platform",
          inviter: "Ian",
          inviteUrl: "https://board.example.com/login?invite=token",
          expiresAt: new Date("2026-07-16T12:00:00Z")
        },
        {},
        fetch,
        (entry) => logEntries.push(entry)
      ),
      /not configured/
    );

    const logEntry = JSON.parse(logEntries[0]);
    assert.equal(logEntry.failureType, "configuration");
    assert.deepEqual(logEntry.missingEnvironmentVariables, [
      "SENDGRID_API_KEY",
      "INVITATION_FROM_EMAIL"
    ]);
  });

  it("logs network failures before returning a safe error", async () => {
    const logEntries: string[] = [];
    const fetchMock: typeof fetch = async () => {
      throw new Error("Connection refused");
    };

    await assert.rejects(
      sendTeamInvitationEmail(
        {
          to: "person@example.com",
          teamName: "Platform",
          inviter: "Ian",
          inviteUrl: "https://board.example.com/login?invite=token",
          expiresAt: new Date("2026-07-16T12:00:00Z")
        },
        {
          SENDGRID_API_KEY: "sendgrid-secret-key",
          INVITATION_FROM_EMAIL: "invites@example.com"
        },
        fetchMock,
        (entry) => logEntries.push(entry)
      ),
      /server logs/
    );

    const logEntry = JSON.parse(logEntries[0]);
    assert.equal(logEntry.failureType, "request_failed");
    assert.equal(logEntry.error.name, "Error");
    assert.equal(logEntry.error.message, "Connection refused");
  });
});
