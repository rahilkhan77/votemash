/**
 * Zod validation schemas for VoteMash
 */

import { z } from 'zod';

// Battle-related schemas
export const BattleIdSchema = z.string().uuid('Invalid battle ID');

export const ParticipantIdSchema = z.string().uuid('Invalid participant ID');

export const VoteInputSchema = z.object({
  participantId: ParticipantIdSchema.describe('ID of the participant being voted for'),
});

export const GetNextBattleQuerySchema = z.object({
  categoryId: z.string().optional().describe('Optional category filter'),
});

// Participant-related schemas
export const ParticipantTypeSchema = z.enum([
  'website',
  'app',
  'startup',
  'ai_tool',
  'developer_tool',
  'product',
  'game',
  'design',
  'brand',
  'other',
]);

export const ParticipantInputSchema = z.object({
  name: z.string().min(1).max(100, 'Participant name must be under 100 characters'),
  type: ParticipantTypeSchema,
  categoryId: z.string().min(1, 'Invalid category ID'),
  description: z.string().max(500, 'Description must be under 500 characters'),
  websiteUrl: z.string().url('Invalid website URL').refine((value) => value === '' || ['http:', 'https:'].includes(new URL(value).protocol), 'Only HTTP(S) website URLs are supported').optional().or(z.literal('')),
  logoUrl: z.string().max(2_800_000, 'Logo is too large').refine((value) => value === '' || value.startsWith('data:image/') || URL.canParse(value), 'Invalid logo URL').optional(),
});

// Category schema
export const CategorySlugSchema = z.string().toLowerCase().regex(/^[a-z0-9-]+$/, 'Invalid category slug');

// Leaderboard query schema
export const LeaderboardQuerySchema = z.object({
  categoryId: z.string().min(1, 'Invalid category ID').optional(),
  limit: z.number().int().positive().max(100).optional().default(50),
  offset: z.number().int().nonnegative().optional().default(0),
});

// API response schemas (removed strict data validation to allow any response shape)
// export const ApiSuccessSchema = z.object({
//   success: z.literal(true),
// });

export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
