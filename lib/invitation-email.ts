type InvitationEmailEnvironment = {
  [key: string]: string | undefined;
  SENDGRID_API_KEY?: string;
  INVITATION_FROM_EMAIL?: string;
  INVITATION_FROM_NAME?: string;
};

type InvitationEmail = {
  to: string;
  teamName: string;
  inviter: string;
  inviteUrl: string;
  expiresAt: Date;
};

type InvitationEmailLogWriter = (entry: string) => void;

const MAX_PROVIDER_RESPONSE_LENGTH = 4_000;

function recipientDomain(email: string) {
  return email.split("@").at(-1)?.toLowerCase() || "unknown";
}

function redactSensitiveValues(value: string, sensitiveValues: string[]) {
  return sensitiveValues.reduce(
    (redacted, sensitiveValue) =>
      sensitiveValue ? redacted.replaceAll(sensitiveValue, "[REDACTED]") : redacted,
    value
  );
}

function serializeError(error: unknown, sensitiveValues: string[]) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: redactSensitiveValues(error.message, sensitiveValues)
    };
  }

  return {
    name: "UnknownError",
    message: redactSensitiveValues(String(error), sensitiveValues)
  };
}

function writeInvitationEmailError(
  logError: InvitationEmailLogWriter,
  details: Record<string, unknown>
) {
  logError(
    JSON.stringify({
      severity: "ERROR",
      timestamp: new Date().toISOString(),
      service: "agent-board",
      component: "invitation-email",
      event: "invitation_email_delivery_failed",
      ...details
    })
  );
}

async function readProviderResponse(
  response: Response,
  sensitiveValues: string[]
) {
  let responseBody = "";
  try {
    responseBody = await response.text();
  } catch {
    return "Provider response body could not be read.";
  }

  const redacted = redactSensitiveValues(
    responseBody.slice(0, MAX_PROVIDER_RESPONSE_LENGTH),
    sensitiveValues
  );
  if (!redacted) {
    return null;
  }

  try {
    return JSON.parse(redacted) as unknown;
  } catch {
    return redacted;
  }
}

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() ?? "";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function isInvitationEmailConfigured(
  environment: InvitationEmailEnvironment = process.env
) {
  return Boolean(
    environment.SENDGRID_API_KEY?.trim() &&
      environment.INVITATION_FROM_EMAIL?.trim()
  );
}

export function resolvePublicBaseUrl(
  request: Request,
  configuredBaseUrl = process.env.APP_BASE_URL
) {
  if (configuredBaseUrl?.trim()) {
    return new URL(configuredBaseUrl.trim()).origin;
  }

  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
  const host = forwardedHost || firstHeaderValue(request.headers.get("host"));
  const forwardedProtocol = firstHeaderValue(
    request.headers.get("x-forwarded-proto")
  );

  if (host) {
    const protocol = forwardedProtocol || new URL(request.url).protocol.slice(0, -1);
    return `${protocol}://${host}`;
  }

  return new URL(request.url).origin;
}

export function buildInvitationUrl(request: Request, token: string) {
  const url = new URL("/login", resolvePublicBaseUrl(request));
  url.searchParams.set("invite", token);
  return url.toString();
}

export async function sendTeamInvitationEmail(
  invitation: InvitationEmail,
  environment: InvitationEmailEnvironment = process.env,
  fetchImplementation: typeof fetch = fetch,
  logError: InvitationEmailLogWriter = (entry) => console.error(entry)
) {
  const apiKey = environment.SENDGRID_API_KEY?.trim();
  const fromEmail = environment.INVITATION_FROM_EMAIL?.trim();
  if (!apiKey || !fromEmail) {
    writeInvitationEmailError(logError, {
      message: "Invitation email delivery is not configured.",
      failureType: "configuration",
      provider: "sendgrid",
      missingEnvironmentVariables: [
        ...(!apiKey ? ["SENDGRID_API_KEY"] : []),
        ...(!fromEmail ? ["INVITATION_FROM_EMAIL"] : [])
      ]
    });
    throw new Error("Invitation email delivery is not configured.");
  }

  const fromName = environment.INVITATION_FROM_NAME?.trim() || "Agent Board";
  const expiration = invitation.expiresAt.toUTCString();
  const plainText = [
    `${invitation.inviter} invited you to join ${invitation.teamName} on Agent Board.`,
    "",
    `Accept invitation: ${invitation.inviteUrl}`,
    "",
    `This invitation expires ${expiration}.`
  ].join("\n");
  const html = `
    <p>${escapeHtml(invitation.inviter)} invited you to join <strong>${escapeHtml(invitation.teamName)}</strong> on Agent Board.</p>
    <p><a href="${escapeHtml(invitation.inviteUrl)}">Accept invitation</a></p>
    <p>This invitation expires ${escapeHtml(expiration)}.</p>
  `.trim();

  const sensitiveValues = [apiKey, invitation.to, invitation.inviteUrl];
  let response: Response;
  try {
    response = await fetchImplementation(
      "https://api.sendgrid.com/v3/mail/send",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json"
        },
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({
          personalizations: [{ to: [{ email: invitation.to }] }],
          from: { email: fromEmail, name: fromName },
          subject: `Invitation to join ${invitation.teamName}`,
          content: [
            { type: "text/plain", value: plainText },
            { type: "text/html", value: html }
          ]
        })
      }
    );
  } catch (error) {
    writeInvitationEmailError(logError, {
      message: "SendGrid request failed before a response was received.",
      failureType: "request_failed",
      provider: "sendgrid",
      configuredFromEmail: fromEmail,
      recipientDomain: recipientDomain(invitation.to),
      error: serializeError(error, sensitiveValues)
    });
    throw new Error(
      "Invitation email could not be sent. Check the server logs for details."
    );
  }

  if (!response.ok) {
    writeInvitationEmailError(logError, {
      message: "SendGrid rejected the invitation.",
      failureType: "provider_rejected",
      provider: "sendgrid",
      httpStatus: response.status,
      httpStatusText: response.statusText,
      providerRequestId:
        response.headers.get("x-message-id") ||
        response.headers.get("x-request-id") ||
        null,
      configuredFromEmail: fromEmail,
      recipientDomain: recipientDomain(invitation.to),
      providerResponse: await readProviderResponse(response, sensitiveValues)
    });
    throw new Error(
      `SendGrid rejected the invitation (${response.status}). Check the server logs for details.`
    );
  }
}
