import crypto from "crypto";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongoose";
import { Team, type TeamRole } from "@/models/Team";
import { User } from "@/models/User";
import type { TeamPayload } from "@/types/board";

const INVITATION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export class TeamServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "TeamServiceError";
    this.status = status;
  }
}

type UserLike = {
  _id: Types.ObjectId;
  email: string;
  name?: string;
  teamId?: Types.ObjectId | string | null;
  teamRole?: TeamRole;
  save: () => Promise<unknown>;
};

type TeamLike = {
  _id: Types.ObjectId;
  name: string;
  members: Array<{
    userId: Types.ObjectId | string;
    role: TeamRole;
    joinedAt?: Date;
  }>;
};

export type TeamContext = {
  user: UserLike;
  team: TeamLike;
  teamId: string;
  teamName: string;
  role: TeamRole;
};

function toId(value: unknown) {
  if (value instanceof Types.ObjectId) {
    return value.toString();
  }

  return String(value);
}

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}

function buildTeamContext(user: UserLike, team: TeamLike): TeamContext {
  const member = team.members.find(
    (candidate) => toId(candidate.userId) === toId(user._id)
  );

  if (!member) {
    throw new TeamServiceError("Team membership could not be verified.", 403);
  }

  return {
    user,
    team,
    teamId: toId(team._id),
    teamName: team.name,
    role: member.role
  };
}

function baseNameForUser(user: UserLike) {
  const name = user.name?.trim() || user.email.split("@")[0] || "My";
  return normalizeTeamName(`${name} Team`);
}

export function normalizeTeamName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function teamNameKey(value: string) {
  return normalizeTeamName(value).toLowerCase();
}

export function createInviteToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string) {
  return crypto.createHash("sha256").update(token.trim()).digest("hex");
}

export function serializeTeamContext(context: TeamContext): TeamPayload {
  return {
    id: context.teamId,
    name: context.teamName,
    role: context.role
  };
}

export async function createTeamForUser(user: UserLike, teamName: string) {
  const name = normalizeTeamName(teamName);

  if (name.length < 2 || name.length > 80 || !/[A-Za-z0-9]/.test(name)) {
    throw new TeamServiceError("Team name must be between 2 and 80 characters.");
  }

  const nameKey = teamNameKey(name);
  const existingTeam = await Team.exists({ nameKey });
  if (existingTeam) {
    throw new TeamServiceError("That team name is already in use.", 409);
  }

  try {
    const team = await Team.create({
      name,
      nameKey,
      members: [
        {
          userId: user._id,
          role: "owner",
          joinedAt: new Date()
        }
      ]
    });

    user.teamId = team._id;
    user.teamRole = "owner";
    await user.save();

    return buildTeamContext(user, team);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new TeamServiceError("That team name is already in use.", 409);
    }

    throw error;
  }
}

async function provisionLegacyTeam(user: UserLike) {
  const baseName = baseNameForUser(user);

  try {
    return await createTeamForUser(user, baseName);
  } catch (error) {
    if (!(error instanceof TeamServiceError) || error.status !== 409) {
      throw error;
    }
  }

  const fallbackName = `${baseName} ${toId(user._id).slice(-6)}`;
  return createTeamForUser(user, fallbackName);
}

export async function getUserTeamContext(userId: string) {
  await connectToDatabase();

  if (!Types.ObjectId.isValid(userId)) {
    throw new TeamServiceError("Unauthorized", 401);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new TeamServiceError("Unauthorized", 401);
  }

  if (!user.teamId) {
    return provisionLegacyTeam(user);
  }

  const team = await Team.findOne({
    _id: user.teamId,
    "members.userId": user._id
  });

  if (!team) {
    throw new TeamServiceError("Team membership could not be verified.", 403);
  }

  const context = buildTeamContext(user, team);
  if (user.teamRole !== context.role) {
    user.teamRole = context.role;
    await user.save();
  }

  return context;
}

async function findUsableInvitation(inviteToken: string, email: string) {
  const token = inviteToken.trim();
  if (!token) {
    throw new TeamServiceError("Invitation is invalid or expired.");
  }

  const tokenHash = hashInviteToken(token);
  const now = new Date();
  const team = await Team.findOne({
    invitations: {
      $elemMatch: {
        tokenHash,
        acceptedAt: null,
        expiresAt: { $gt: now }
      }
    }
  });

  const invitation = team?.invitations.find(
    (candidate: any) =>
      candidate.tokenHash === tokenHash &&
      !candidate.acceptedAt &&
      candidate.expiresAt > now
  );

  if (!team || !invitation) {
    throw new TeamServiceError("Invitation is invalid or expired.");
  }

  if (invitation.invitedEmail && invitation.invitedEmail !== email) {
    throw new TeamServiceError("Invitation is invalid or expired.");
  }

  return { team, invitation, tokenHash };
}

export async function validateInvitationForEmail(
  inviteToken: string,
  email: string
) {
  await connectToDatabase();
  await findUsableInvitation(inviteToken, email);
}

export async function joinTeamWithInvitation(
  user: UserLike,
  inviteToken: string
) {
  await connectToDatabase();

  if (user.teamId) {
    throw new TeamServiceError("This account already belongs to a team.", 409);
  }

  const { team, invitation, tokenHash } = await findUsableInvitation(
    inviteToken,
    user.email
  );
  const now = new Date();
  const updatedTeam = await Team.findOneAndUpdate(
    {
      _id: team._id,
      invitations: {
        $elemMatch: {
          tokenHash,
          acceptedAt: null,
          expiresAt: { $gt: now }
        }
      }
    },
    {
      $set: {
        "invitations.$.acceptedAt": now
      },
      $push: {
        members: {
          userId: user._id,
          role: invitation.role,
          joinedAt: now
        }
      }
    },
    { returnDocument: "after" }
  );

  if (!updatedTeam) {
    throw new TeamServiceError("Invitation is invalid or expired.");
  }

  user.teamId = updatedTeam._id;
  user.teamRole = invitation.role;
  await user.save();

  return buildTeamContext(user, updatedTeam);
}

export async function createTeamInvitation(
  userId: string,
  invitedEmail?: string
) {
  const context = await getUserTeamContext(userId);

  if (context.role !== "owner") {
    throw new TeamServiceError("Only team owners can invite members.", 403);
  }

  const token = createInviteToken();
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

  await Team.updateOne(
    { _id: context.team._id },
    {
      $pull: {
        invitations: { expiresAt: { $lte: new Date() } }
      }
    }
  );

  await Team.updateOne(
    { _id: context.team._id },
    {
      $push: {
        invitations: {
          tokenHash: hashInviteToken(token),
          invitedEmail: invitedEmail ?? "",
          role: "member",
          invitedBy: context.user._id,
          expiresAt,
          createdAt: new Date()
        }
      }
    }
  );

  return {
    token,
    expiresAt,
    team: serializeTeamContext(context),
    invitedEmail: invitedEmail ?? ""
  };
}
