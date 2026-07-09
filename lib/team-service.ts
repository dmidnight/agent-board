import crypto from "crypto";
import { Types } from "mongoose";
import { normalizeGitHubRepositoryUrl } from "@/lib/github";
import { connectToDatabase } from "@/lib/mongoose";
import { Board } from "@/models/Board";
import { Team, type TeamRole } from "@/models/Team";
import { User } from "@/models/User";
import type { TeamPayload, TeamRepository } from "@/types/board";

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
  repositories: Array<{
    _id: Types.ObjectId | string;
    name: string;
    url: string;
    urlKey: string;
  }>;
  members: Array<{
    userId: Types.ObjectId | string;
    role: TeamRole;
    joinedAt?: Date;
  }>;
  save: () => Promise<unknown>;
};

export type TeamContext = {
  user: UserLike;
  team: TeamLike;
  teamId: string;
  teamName: string;
  role: TeamRole;
};

export type TeamWorkspace = {
  context: TeamContext;
  teams: TeamPayload[];
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

function serializeTeamMembership(userId: string, team: TeamLike): TeamPayload {
  const member = team.members.find(
    (candidate) => toId(candidate.userId) === userId
  );

  if (!member) {
    throw new TeamServiceError("Team membership could not be verified.", 403);
  }

  return {
    id: toId(team._id),
    name: team.name,
    role: member.role,
    repositories: serializeTeamRepositories(team.repositories)
  };
}

function serializeTeamRepositories(
  repositories: TeamLike["repositories"] = []
): TeamRepository[] {
  return repositories.map((repository) => ({
    id: toId(repository._id),
    name: repository.name,
    url: repository.url
  }));
}

async function getUserOrThrow(userId: string) {
  if (!Types.ObjectId.isValid(userId)) {
    throw new TeamServiceError("Unauthorized", 401);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new TeamServiceError("Unauthorized", 401);
  }

  return user;
}

async function findMembershipTeams(user: UserLike) {
  return Team.find({ "members.userId": user._id }).sort({ nameKey: 1 });
}

async function syncActiveTeam(user: UserLike, context: TeamContext) {
  if (toId(user.teamId) !== context.teamId || user.teamRole !== context.role) {
    user.teamId = context.team._id;
    user.teamRole = context.role;
    await user.save();
  }
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
    role: context.role,
    repositories: serializeTeamRepositories(context.team.repositories)
  };
}

export function serializeSessionTeamContext(context: TeamContext) {
  return {
    userId: toId(context.user._id),
    email: context.user.email,
    name: context.user.name,
    teamId: context.teamId,
    teamName: context.teamName,
    teamRole: context.role
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

export async function createTeamForUserId(userId: string, teamName: string) {
  await connectToDatabase();
  const user = await getUserOrThrow(userId);
  return createTeamForUser(user, teamName);
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

export async function getUserTeamContext(userId: string, activeTeamId?: string) {
  const workspace = await getUserTeamWorkspace(userId, activeTeamId);
  return workspace.context;
}

export async function getUserTeamWorkspace(
  userId: string,
  activeTeamId?: string
): Promise<TeamWorkspace> {
  await connectToDatabase();

  const user = await getUserOrThrow(userId);
  const memberships = await findMembershipTeams(user);

  if (memberships.length === 0) {
    const context = await provisionLegacyTeam(user);
    return {
      context,
      teams: [serializeTeamContext(context)]
    };
  }

  const preferredTeamId =
    activeTeamId && Types.ObjectId.isValid(activeTeamId)
      ? activeTeamId
      : user.teamId
        ? toId(user.teamId)
        : "";
  const activeTeam =
    memberships.find((team) => toId(team._id) === preferredTeamId) ??
    memberships[0];
  const context = buildTeamContext(user, activeTeam);

  await syncActiveTeam(user, context);

  return {
    context,
    teams: memberships.map((team) =>
      serializeTeamMembership(toId(user._id), team)
    )
  };
}

export async function switchActiveTeam(userId: string, teamId: string) {
  await connectToDatabase();

  if (!Types.ObjectId.isValid(teamId)) {
    throw new TeamServiceError("Team not found.", 404);
  }

  const user = await getUserOrThrow(userId);
  const team = await Team.findOne({
    _id: teamId,
    "members.userId": user._id
  });

  if (!team) {
    throw new TeamServiceError("Team not found.", 404);
  }

  const context = buildTeamContext(user, team);
  await syncActiveTeam(user, context);

  const memberships = await findMembershipTeams(user);
  return {
    context,
    teams: memberships.map((candidate) =>
      serializeTeamMembership(toId(user._id), candidate)
    )
  };
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

  const { team, invitation, tokenHash } = await findUsableInvitation(
    inviteToken,
    user.email
  );

  if (
    team.members.some((member: any) => toId(member.userId) === toId(user._id))
  ) {
    throw new TeamServiceError("This account is already a member of that team.", 409);
  }

  const now = new Date();
  const updatedTeam = await Team.findOneAndUpdate(
    {
      _id: team._id,
      "members.userId": { $ne: user._id },
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

export async function joinTeamWithInvitationForUser(
  userId: string,
  inviteToken: string
) {
  await connectToDatabase();
  const user = await getUserOrThrow(userId);
  return joinTeamWithInvitation(user, inviteToken);
}

export async function createTeamInvitation(
  userId: string,
  activeTeamId: string | undefined,
  invitedEmail?: string
) {
  const { context } = await getUserTeamWorkspace(userId, activeTeamId);

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

export async function revokeTeamInvitation(
  teamId: string,
  inviteToken: string
) {
  await connectToDatabase();
  await Team.updateOne(
    { _id: teamId },
    { $pull: { invitations: { tokenHash: hashInviteToken(inviteToken) } } }
  );
}

export async function addTeamRepository(
  userId: string,
  activeTeamId: string | undefined,
  repositoryUrl: string
) {
  const { context } = await getUserTeamWorkspace(userId, activeTeamId);
  if (context.role !== "owner") {
    throw new TeamServiceError("Only team owners can manage repositories.", 403);
  }

  let repository: ReturnType<typeof normalizeGitHubRepositoryUrl>;
  try {
    repository = normalizeGitHubRepositoryUrl(repositoryUrl);
  } catch (error) {
    throw new TeamServiceError(
      error instanceof Error
        ? error.message
        : "Enter a valid GitHub repository URL."
    );
  }

  if (
    context.team.repositories.some(
      (candidate) => candidate.urlKey === repository.urlKey
    )
  ) {
    throw new TeamServiceError("That repository is already on this team.", 409);
  }

  context.team.repositories.push({
    _id: new Types.ObjectId(),
    ...repository
  });
  await context.team.save();

  return getUserTeamWorkspace(userId, context.teamId);
}

export async function removeTeamRepository(
  userId: string,
  activeTeamId: string | undefined,
  repositoryId: string
) {
  if (!Types.ObjectId.isValid(repositoryId)) {
    throw new TeamServiceError("Repository not found.", 404);
  }

  const { context } = await getUserTeamWorkspace(userId, activeTeamId);
  if (context.role !== "owner") {
    throw new TeamServiceError("Only team owners can manage repositories.", 403);
  }

  const repositoryIndex = context.team.repositories.findIndex(
    (repository) => toId(repository._id) === repositoryId
  );
  if (repositoryIndex < 0) {
    throw new TeamServiceError("Repository not found.", 404);
  }

  context.team.repositories.splice(repositoryIndex, 1);
  await context.team.save();

  await Board.updateOne(
    { teamId: context.team._id },
    { $set: { "tickets.$[ticket].repositoryId": null } },
    { arrayFilters: [{ "ticket.repositoryId": new Types.ObjectId(repositoryId) }] }
  );

  return getUserTeamWorkspace(userId, context.teamId);
}

export async function teamHasRepository(
  userId: string,
  activeTeamId: string | undefined,
  repositoryId: string
) {
  if (!Types.ObjectId.isValid(repositoryId)) {
    return false;
  }

  const context = await getUserTeamContext(userId, activeTeamId);
  return context.team.repositories.some(
    (repository) => toId(repository._id) === repositoryId
  );
}
