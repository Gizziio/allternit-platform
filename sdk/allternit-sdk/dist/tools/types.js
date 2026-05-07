import { z } from 'zod';
/**
 * Question Schema - For HITL tools like AskUserQuestion
 */
export const QuestionSchema = z.object({
    id: z.string(),
    question: z.string(),
    type: z.enum(['choice', 'text', 'yesno']),
    header: z.string(),
    options: z.array(z.object({
        label: z.string(),
        description: z.string(),
        preview: z.string().optional()
    })).optional(),
    multiSelect: z.boolean().optional(),
    placeholder: z.string().optional()
});
