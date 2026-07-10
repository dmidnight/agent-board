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
  fetchImplementation: typeof fetch = fetch
) {
  const apiKey = environment.SENDGRID_API_KEY?.trim();
  const fromEmail = environment.INVITATION_FROM_EMAIL?.trim();
  if (!apiKey || !fromEmail) {
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

  const response = await fetchImplementation(
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

  if (!response.ok) {
    throw new Error(`SendGrid rejected the invitation (${response.status}).`);
  }
}
