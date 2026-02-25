'use server';
/**
 * @fileOverview This file implements a Genkit flow that provides personalized study recommendations
 * and intervention strategies for students based on their performance metrics.
 *
 * - studentReceivesPersonalizedRecommendations - A function that generates personalized recommendations.
 * - InterventionInput - The input type for the studentReceivesPersonalizedRecommendations function.
 * - InterventionOutput - The return type for the studentReceivesPersonalizedRecommendations function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const InterventionInputSchema = z.object({
  centerId: z.string().describe('ID of the study center.'),
  studentId: z.string().describe('ID of the student.'),
  studentDisplayName: z.string().describe("The student's display name for personalization."),
  planCompletionRateLastTwoWeeks: z.number().min(0).max(1).describe('Plan completion rate over the last two weeks (0-1).'),
  consecutiveDaysAbsent: z.number().min(0).describe('Number of consecutive days the student has been absent.'),
  studyTimeGrowthRate: z.number().describe('Growth rate of study time compared to the previous period (e.g., -0.30 for 30% decrease).'),
  consecutiveDaysNoPlan: z.number().min(0).describe('Number of consecutive days the student has not submitted a plan.'),
  weeklyCompletionRate: z.number().min(0).max(1).describe('Overall weekly plan completion rate (0-1).'),
});
export type InterventionInput = z.infer<typeof InterventionInputSchema>;

const InterventionOutputSchema = z.object({
  type: z.literal('intervention').describe('The type of AI output, always "intervention".'),
  message: z.string().describe('The personalized intervention message and study recommendations.'),
  basedOn: InterventionInputSchema.omit({ centerId: true, studentId: true, studentDisplayName: true }).describe('A snapshot of the performance metrics used for this intervention.'),
  model: z.string().describe('The AI model used for generating the intervention.'),
});
export type InterventionOutput = z.infer<typeof InterventionOutputSchema>;

export async function studentReceivesPersonalizedRecommendations(input: InterventionInput): Promise<InterventionOutput> {
  return interventionFlow(input);
}

const interventionPrompt = ai.definePrompt({
  name: 'interventionPrompt',
  input: { schema: InterventionInputSchema },
  output: { schema: InterventionOutputSchema },
  prompt: `You are an AI-powered academic coach providing personalized study recommendations and intervention strategies to students.
Your goal is to help students improve their learning habits and overcome challenges in a supportive and action-oriented manner.
You must adhere to the following guardrails:
- Do NOT provide medical, diagnosis, or treatment advice.
- Focus on actionable suggestions and observations based on the provided data.
- Avoid sensitive topics like sleep or mental health.
- Avoid blame or definitive statements, focus on positive reinforcement and constructive advice.

Based on the following performance indicators for student {{{studentDisplayName}}}:
- Plan Completion Rate (last 2 weeks): {{planCompletionRateLastTwoWeeks}} (where 1.0 is 100%)
- Consecutive Days Absent: {{consecutiveDaysAbsent}}
- Study Time Growth Rate: {{studyTimeGrowthRate}} (e.g., -0.30 means a 30% decrease)
- Consecutive Days No Plan: {{consecutiveDaysNoPlan}}
- Overall Weekly Completion Rate: {{weeklyCompletionRate}} (where 1.0 is 100%)

Generate a concise, personalized intervention message and study recommendation.
Identify areas for improvement and offer clear, actionable strategies.

Here are some guidelines based on common scenarios:
- If 'planCompletionRateLastTwoWeeks' is less than 0.5 (50%), suggest reviewing their plan for realism and simplifying it if needed.
- If 'studyTimeGrowthRate' is negative (e.g., -0.30), suggest reallocating study time or identifying distractions.
- If 'consecutiveDaysAbsent' is 3 or more, gently inquire about challenges and emphasize the importance of consistency.
- If 'consecutiveDaysNoPlan' is 3 or more, remind them of the benefits of planning and offer tips for getting started.
- If 'weeklyCompletionRate' is high (e.g., above 0.8), offer positive reinforcement for their consistency and effort.

Your output message should be encouraging and focus on next steps.
Format your response as a JSON object matching the InterventionOutputSchema.
For the 'basedOn' field, include a snapshot of only the performance metrics provided (planCompletionRateLastTwoWeeks, consecutiveDaysAbsent, studyTimeGrowthRate, consecutiveDaysNoPlan, weeklyCompletionRate).
Set 'type' to 'intervention' and 'model' to 'googleai/gemini-2.5-flash'.

Example output structure:
{
  "type": "intervention",
  "message": "Hi [Student Name], it looks like you've been doing great with X, but Y could use some attention. Try Z.",
  "basedOn": {
    "planCompletionRateLastTwoWeeks": 0.45,
    "consecutiveDaysAbsent": 0,
    "studyTimeGrowthRate": -0.10,
    "consecutiveDaysNoPlan": 2,
    "weeklyCompletionRate": 0.55
  },
  "model": "googleai/gemini-2.5-flash"
}
`,
});

const interventionFlow = ai.defineFlow(
  {
    name: 'studentReceivesPersonalizedRecommendationsFlow',
    inputSchema: InterventionInputSchema,
    outputSchema: InterventionOutputSchema,
  },
  async (input) => {
    const { output } = await interventionPrompt(input);

    if (!output) {
      throw new Error('AI did not return an output for intervention.');
    }

    return output;
  },
);
