'use server';
/**
 * @fileOverview An AI agent that identifies students who are at risk of disengagement or underperformance.
 *
 * - identifyAtRiskStudents - A function that handles the risk detection process.
 * - IdentifyAtRiskStudentInput - The input type for the identifyAtRiskStudents function.
 * - IdentifyAtRiskStudentOutput - The return type for the identifyAtRiskStudents function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const IdentifyAtRiskStudentInputSchema = z.object({
  centerId: z.string().describe('The ID of the study center.'),
  studentId: z.string().describe('The ID of the student to assess.'),
  planCompletionRateLast2Weeks: z
    .number()
    .describe('Plan completion rate over the last two weeks (0-100).'),
  absenceDaysLastPeriod: z
    .number()
    .describe('Number of days absent in a recent period (e.g., last 30 days).'),
  studyTimeGrowthRate: z
    .number()
    .describe('Percentage change in study time (e.g., -0.30 for -30% decrease).'),
  daysSinceLastPlan: z
    .number()
    .describe('Number of days since the student last submitted a plan.'),
});
export type IdentifyAtRiskStudentInput = z.infer<
  typeof IdentifyAtRiskStudentInputSchema
>;

const IdentifyAtRiskStudentOutputSchema = z.object({
  isAtRisk: z.boolean().describe('True if the student is identified as at risk.'),
  riskReasons: z
    .array(z.string())
    .describe('List of specific, objective reasons why the student is at risk.'),
  interventionSuggestions: z
    .array(z.string())
    .describe('General, proactive intervention suggestions.'),
  basedOnMetrics: IdentifyAtRiskStudentInputSchema.partial().describe(
    'Snapshot of key metrics used for the risk assessment.'
  ),
});
export type IdentifyAtRiskStudentOutput = z.infer<
  typeof IdentifyAtRiskStudentOutputSchema
>;

export async function identifyAtRiskStudents(
  input: IdentifyAtRiskStudentInput
): Promise<IdentifyAtRiskStudentOutput> {
  return identifyAtRiskStudentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'identifyAtRiskStudentPrompt',
  input: {schema: IdentifyAtRiskStudentInputSchema},
  output: {schema: IdentifyAtRiskStudentOutputSchema},
  prompt: `You are an AI-powered risk detection system for a study center. Your goal is to objectively identify students who are at risk of disengagement or underperformance based on their academic metrics. Focus on providing factual observations and constructive suggestions.

Analyze the following data for a student:
- Plan Completion Rate (last 2 weeks): {{{planCompletionRateLast2Weeks}}}%
- Days Absent (last period): {{{absenceDaysLastPeriod}}} days
- Study Time Growth Rate (last period, compared to previous period): {{{studyTimeGrowthRate}}} (a value of -0.30 means a 30% decrease)
- Days Since Last Plan Submission: {{{daysSinceLastPlan}}} days

Consider a student 'at-risk' if:
- Their plan completion rate has been consistently below 50% for the last two weeks.
- They have been absent for 3 or more days in the recent period.
- Their study time growth rate shows a significant decline, for example, -0.30 (30% decrease) or worse.
- They haven't submitted a study plan for 3 or more days.

Based on these indicators, determine if the student is at risk. If so, provide a clear, objective, and observation-based list of reasons why they are at risk and suggest proactive, general intervention strategies. Avoid making medical diagnoses, giving medical advice, or assigning blame. Focus solely on observable behaviors and data trends.

Ensure that the 'basedOnMetrics' field in your output accurately reflects the input metrics you used for your assessment.

Output in JSON format.`,
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_NONE',
      },
    ],
  },
});

const identifyAtRiskStudentFlow = ai.defineFlow(
  {
    name: 'identifyAtRiskStudentFlow',
    inputSchema: IdentifyAtRiskStudentInputSchema,
    outputSchema: IdentifyAtRiskStudentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error('AI prompt did not return output.');
    }
    return {
      ...output,
      basedOnMetrics: {
        planCompletionRateLast2Weeks: input.planCompletionRateLast2Weeks,
        absenceDaysLastPeriod: input.absenceDaysLastPeriod,
        studyTimeGrowthRate: input.studyTimeGrowthRate,
        daysSinceLastPlan: input.daysSinceLastPlan,
      },
    };
  }
);
