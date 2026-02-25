'use server';
/**
 * @fileOverview A Genkit flow for generating personalized weekly performance summaries for parents.
 *
 * - generateParentSummary - A function that generates a weekly summary for a parent.
 * - ParentSummaryInput - The input type for the generateParentSummary function.
 * - ParentSummaryOutput - The return type for the generateParentSummary function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ParentSummaryInputSchema = z.object({
  studentName: z.string().describe('The name of the student.'),
  completionRate: z.number().min(0).max(100).describe('Weighted average of completed plan items for the week (0-100%).'),
  completionRateTrend: z.number().min(-100).max(100).describe('Change in completion rate from the previous week (-100 to 100%).'),
  attendanceRate: z.number().min(0).max(100).describe('Overall attendance rate for the week (0-100%).'),
  attendanceTrend: z.number().min(-100).max(100).describe('Change in attendance rate from the previous week (-100 to 100%).'),
  studyTimeGrowth: z.number().min(-0.8).max(3.0).describe('Growth in study time from the previous 7 days compared to the prior 7 days (-0.8 to 3.0).'),
  recentAchievements: z.array(z.string()).describe('A list of recent positive achievements or observations for the student.'),
  potentialRisks: z.array(z.string()).describe('A list of potential risks or areas needing attention for the student.'),
  parentFeedbackContext: z.string().optional().describe('Any specific feedback or context provided by the parent or teacher for inclusion in the summary.'),
});
export type ParentSummaryInput = z.infer<typeof ParentSummaryInputSchema>;

const ParentSummaryOutputSchema = z.object({
  message: z.string().describe('The AI-generated weekly summary message for the parent, concise and encouraging.'),
  keyMetrics: z.array(
    z.object({
      name: z.string().describe('Name of the metric (e.g., "Plan Completion").'),
      value: z.string().describe('Formatted value of the metric (e.g., "85%").'),
      trend: z.string().optional().describe('Brief description of the trend (e.g., "Up 5% from last week").'),
    })
  ).describe('3-5 key performance indicators with their values and trends, suitable for quick review.'),
  recommendations: z.array(z.string()).describe('Actionable recommendations or insights for the parent to support their child, focusing on positive reinforcement and engagement.'),
  safetyScore: z.number().min(0).max(100).describe('An internal score indicating the safety and appropriateness of the generated content (0-100, 100 being perfectly safe).'),
});
export type ParentSummaryOutput = z.infer<typeof ParentSummaryOutputSchema>;

export async function generateParentSummary(input: ParentSummaryInput): Promise<ParentSummaryOutput> {
  return parentSummaryFlow(input);
}

const parentSummaryPrompt = ai.definePrompt({
  name: 'parentSummaryPrompt',
  input: { schema: ParentSummaryInputSchema },
  output: { schema: ParentSummaryOutputSchema },
  prompt: `You are an empathetic and supportive AI assistant designed to provide weekly academic progress summaries to parents.
Your goal is to inform parents about their child's performance trends in a clear, constructive, and encouraging manner.
Focus on observations and factual trends, avoiding blame, definitive statements about student abilities, or medical/diagnosis/treatment advice.

Generate a weekly summary based on the following student data:

Student Name: {{{studentName}}}

Performance Indicators for the Week:
- Plan Completion Rate: {{{completionRate}}}%
- Plan Completion Rate Trend (vs. last week): {{#if completionRateTrend}}{{{completionRateTrend}}}% {{#if (gt completionRateTrend 0)}}Up{{else if (lt completionRateTrend 0)}}Down{{else}}No Change{{/if}}{{else}}N/A{{/if}}
- Attendance Rate: {{{attendanceRate}}}%
- Attendance Rate Trend (vs. last week): {{#if attendanceTrend}}{{{attendanceTrend}}}% {{#if (gt attendanceTrend 0)}}Up{{else if (lt attendanceTrend 0)}}Down{{else}}No Change{{/if}}{{else}}N/A{{/if}}
- Study Time Growth (vs. previous period): {{#if studyTimeGrowth}}x{{{studyTimeGrowth}}}{{#if (gt studyTimeGrowth 0)}} (Growth){{else if (lt studyTimeGrowth 0)}} (Decrease){{else}} (Stable){{/if}}{{else}}N/A{{/if}}

Recent Achievements/Positive Observations:
{{#if recentAchievements}}
{{#each recentAchievements}}- {{{this}}}
{{/each}}
{{else}}- No specific achievements noted this week.
{{/if}}

Potential Risks/Areas for Attention:
{{#if potentialRisks}}
{{#each potentialRisks}}- {{{this}}}
{{/each}}
{{else}}- No significant risks identified this week.
{{/if}}

{{#if parentFeedbackContext}}
Additional Context/Feedback: {{{parentFeedbackContext}}}
{{/if}}

Based on the above data, please generate a summary for the parent. The summary should include:
1.  A main 'message' (a concise, encouraging paragraph).
2.  An array of 3-5 'keyMetrics' objects, each with 'name', 'value', and 'trend' fields, highlighting the most important statistics.
3.  An array of 'recommendations' (1-3 actionable, positive suggestions for the parent).
4.  A 'safetyScore' (an integer from 0-100, where 100 indicates the content is perfectly safe and appropriate for parents).

Ensure the tone is warm, supportive, and data-driven. Focus on progress and potential for improvement.
`,
  config: {
    safetySettings: [
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }, // Allow more flexibility if content is related to student performance, but still monitored.
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_UNSPECIFIED', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_TOXICITY', threshold: 'BLOCK_ONLY_HIGH' }
    ],
  }
});

const parentSummaryFlow = ai.defineFlow(
  {
    name: 'parentSummaryFlow',
    inputSchema: ParentSummaryInputSchema,
    outputSchema: ParentSummaryOutputSchema,
  },
  async (input) => {
    const { output } = await parentSummaryPrompt(input);
    return output!;
  }
);
