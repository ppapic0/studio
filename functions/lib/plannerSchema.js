"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.studyPlanResponseSchema = exports.studyPlanOutputSchema = exports.studyTodoSchema = exports.weeklyBalanceSchema = exports.generateStudyPlanInputSchema = exports.plannerProfileInputSchema = exports.plannerFlagSchema = void 0;
exports.validateStudyPlanOutput = validateStudyPlanOutput;
const zod_1 = require("zod");
exports.plannerFlagSchema = zod_1.z.object({
    lowPlanningFlag: zod_1.z.boolean(),
    lowReflectionFlag: zod_1.z.boolean(),
    lowMotivationFlag: zod_1.z.boolean(),
    efficiencyMismatchFlag: zod_1.z.boolean(),
    burnoutRiskFlag: zod_1.z.boolean(),
    avoidanceMotivationFlag: zod_1.z.boolean(),
});
exports.plannerProfileInputSchema = zod_1.z.object({
    grade: zod_1.z.string().min(1),
    goal: zod_1.z.string().min(1),
    examWindow: zod_1.z.string().min(1),
    avgStudyHours: zod_1.z.string().min(1),
    planningScore: zod_1.z.number().min(0).max(100),
    reflectionScore: zod_1.z.number().min(0).max(100),
    balanceScore: zod_1.z.number().min(0).max(100),
    diversityScore: zod_1.z.number().min(0).max(100),
    motivationScore: zod_1.z.number().min(0).max(100),
    weakSubjects: zod_1.z.array(zod_1.z.string().min(1)).max(6),
    timeHeavySubjects: zod_1.z.array(zod_1.z.string().min(1)).max(6),
    leastEfficientSubject: zod_1.z.string().min(1),
    activityTypes: zod_1.z.array(zod_1.z.string().min(1)).max(10),
    burnoutSignals: zod_1.z.array(zod_1.z.string().min(1)).max(6),
    theorySummary: zod_1.z.array(zod_1.z.string().min(1)).max(10),
    flags: exports.plannerFlagSchema,
});
exports.generateStudyPlanInputSchema = zod_1.z.object({
    profile: exports.plannerProfileInputSchema,
});
exports.weeklyBalanceSchema = zod_1.z.object({
    국어: zod_1.z.number().int().min(0).max(100),
    수학: zod_1.z.number().int().min(0).max(100),
    영어: zod_1.z.number().int().min(0).max(100),
    탐구: zod_1.z.number().int().min(0).max(100),
});
exports.studyTodoSchema = zod_1.z.object({
    과목: zod_1.z.string().min(1),
    활동: zod_1.z.string().min(1),
    시간: zod_1.z.number().int().min(20).max(120),
});
exports.studyPlanOutputSchema = zod_1.z.object({
    weekly_balance: exports.weeklyBalanceSchema,
    daily_todos: zod_1.z.array(exports.studyTodoSchema).min(4).max(7),
    coaching_message: zod_1.z.string().min(10),
});
exports.studyPlanResponseSchema = {
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
};
function validateStudyPlanOutput(raw) {
    const parsed = exports.studyPlanOutputSchema.parse(raw);
    const total = Object.values(parsed.weekly_balance).reduce((sum, value) => sum + value, 0);
    if (total !== 100) {
        throw new Error(`weekly_balance sum must equal 100, got ${total}`);
    }
    return parsed;
}
//# sourceMappingURL=plannerSchema.js.map