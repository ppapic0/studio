import { z } from "zod";

export const plannerFlagSchema = z.object({
  lowPlanningFlag: z.boolean(),
  lowReflectionFlag: z.boolean(),
  lowMotivationFlag: z.boolean(),
  efficiencyMismatchFlag: z.boolean(),
  burnoutRiskFlag: z.boolean(),
  avoidanceMotivationFlag: z.boolean(),
});

export const plannerProfileInputSchema = z.object({
  grade: z.string().min(1),
  goal: z.string().min(1),
  examWindow: z.string().min(1),
  avgStudyHours: z.string().min(1),
  planningScore: z.number().min(0).max(100),
  reflectionScore: z.number().min(0).max(100),
  balanceScore: z.number().min(0).max(100),
  diversityScore: z.number().min(0).max(100),
  motivationScore: z.number().min(0).max(100),
  weakSubjects: z.array(z.string().min(1)).max(6),
  timeHeavySubjects: z.array(z.string().min(1)).max(6),
  leastEfficientSubject: z.string().min(1),
  activityTypes: z.array(z.string().min(1)).max(10),
  burnoutSignals: z.array(z.string().min(1)).max(6),
  theorySummary: z.array(z.string().min(1)).max(10),
  flags: plannerFlagSchema,
});

export const generateStudyPlanInputSchema = z.object({
  profile: plannerProfileInputSchema,
});

export const weeklyBalanceSchema = z.object({
  국어: z.number().int().min(0).max(100),
  수학: z.number().int().min(0).max(100),
  영어: z.number().int().min(0).max(100),
  탐구: z.number().int().min(0).max(100),
});

export const studyTodoSchema = z.object({
  과목: z.string().min(1),
  활동: z.string().min(1),
  시간: z.number().int().min(20).max(120),
});

export const studyPlanOutputSchema = z.object({
  weekly_balance: weeklyBalanceSchema,
  daily_todos: z.array(studyTodoSchema).min(4).max(7),
  coaching_message: z.string().min(10),
});

export type StudyPlanOutput = z.infer<typeof studyPlanOutputSchema>;

export const studyPlanResponseSchema = {
  type: "OBJECT",
  properties: {
    weekly_balance: {
      type: "OBJECT",
      properties: {
        국어: { type: "INTEGER" },
        수학: { type: "INTEGER" },
        영어: { type: "INTEGER" },
        탐구: { type: "INTEGER" },
      },
      required: ["국어", "수학", "영어", "탐구"],
    },
    daily_todos: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          과목: { type: "STRING" },
          활동: { type: "STRING" },
          시간: { type: "INTEGER" },
        },
        required: ["과목", "활동", "시간"],
      },
    },
    coaching_message: {
      type: "STRING",
    },
  },
  required: ["weekly_balance", "daily_todos", "coaching_message"],
} as const;

export function validateStudyPlanOutput(raw: unknown): StudyPlanOutput {
  const parsed = studyPlanOutputSchema.parse(raw);
  const total = Object.values(parsed.weekly_balance).reduce((sum, value) => sum + value, 0);
  if (total !== 100) {
    throw new Error(`weekly_balance sum must equal 100, got ${total}`);
  }
  return parsed;
}
