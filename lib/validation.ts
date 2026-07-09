import { z } from "zod";

export const emailSchema = z.string().trim().email().max(254).toLowerCase();
export const passwordSchema = z.string().min(8).max(128);
export const teamNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/[A-Za-z0-9]/);
export const inviteTokenSchema = z.string().trim().min(16).max(160);

export const authSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().max(80).optional(),
  teamName: z.string().trim().max(80).optional(),
  inviteToken: z.string().trim().max(160).optional()
});

export const createInvitationSchema = z.object({
  invitedEmail: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    emailSchema.optional()
  )
});

export const createTeamSchema = z.object({
  teamName: teamNameSchema
});

export const addTeamRepositorySchema = z.object({
  url: z.string().trim().min(1).max(500)
});

export const switchTeamSchema = z.object({
  teamId: z.string().trim().min(1)
});

export const joinTeamSchema = z.object({
  inviteToken: inviteTokenSchema
});

export const createColumnSchema = z.object({
  title: z.string().trim().min(1).max(60)
});

export const updateColumnSchema = createColumnSchema;

export const createTicketSchema = z.object({
  title: z.string().trim().min(1).max(120),
  columnId: z.string().trim().min(1),
  priority: z.enum(["P0", "P1", "P2", "P3"]).optional(),
  repositoryId: z.string().trim().min(1).nullable().optional()
});

export const updateTicketSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(1200).optional(),
  repositoryId: z.string().trim().min(1).nullable().optional(),
  priority: z.enum(["P0", "P1", "P2", "P3"]).optional(),
  agent: z.string().trim().max(80).optional(),
  objective: z.string().max(1200).optional(),
  agentNotes: z.string().max(1800).optional(),
  acceptanceCriteria: z
    .array(
      z.object({
        text: z.string().trim().min(1).max(220),
        done: z.boolean().default(false)
      })
    )
    .max(12)
    .optional(),
  automationHooks: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        enabled: z.boolean()
      })
    )
    .max(8)
    .optional()
});

export const moveTicketSchema = z.object({
  columnId: z.string().trim().min(1),
  beforeTicketId: z.string().trim().min(1).nullable().optional(),
  afterTicketId: z.string().trim().min(1).nullable().optional()
});

const stringListSchema = z
  .array(z.string().trim().min(1).max(180))
  .max(12)
  .default([]);

const executionScopeSchema = z
  .string()
  .trim()
  .min(1)
  .max(240)
  .refine((value) => !/^(\/|~\/|[A-Za-z]:[\\/])/.test(value), {
    message: "Use a portable execution scope, not a local absolute path."
  });

export const executionApprovalActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("request"),
    executionMode: z
      .enum(["plan_only", "local_agent", "ci_runner"])
      .default("plan_only"),
    allowedWorkspace: executionScopeSchema,
    allowedFileGlobs: stringListSchema,
    allowedCommands: stringListSchema,
    networkAccess: z.enum(["none", "allowlisted", "full"]).default("none"),
    secretAccess: z.enum(["none", "allowlisted"]).default("none"),
    planSummary: z.string().trim().max(1200).optional(),
    promptInjectionReview: z.string().trim().max(1200).optional()
  }),
  z.object({
    action: z.literal("approve")
  }),
  z.object({
    action: z.literal("reject"),
    rejectionReason: z.string().trim().min(1).max(600)
  }),
  z.object({
    action: z.literal("expire")
  }),
  z.object({
    action: z.literal("record_result"),
    resultSummary: z.string().trim().min(1).max(1600)
  })
]);
