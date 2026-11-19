import { z } from 'zod';

// =====================
// AUTH & USER
// =====================

export const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(255),
});

export const SigninSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  timezone: z.string().optional(),
  locale: z.string().optional(),
});

// =====================
// STUDENT ONBOARDING
// =====================

export const OnboardingSchema = z.object({
  japanese_level: z.enum(['Beginner', 'N5', 'N4', 'N3', 'N2', 'N1']),
  jlpt_target: z.string().optional(),
  daily_study_minutes: z.number().int().min(10).max(120),
  study_goals: z.array(z.string()).optional(),
  exam_date: z.string().date().optional(),
  preferred_session_difficulty: z.enum(['easy', 'medium', 'hard']),
});

// =====================
// CONTENT MANAGEMENT
// =====================

export const KanjiCreateSchema = z.object({
  character: z.string().length(1),
  unicode: z.number().int(),
  jlpt_level: z.string().optional(),
  grade_level: z.number().int().optional(),
  stroke_count: z.number().int().positive(),
  meanings: z.array(z.string()).nonempty(),
  onyomi: z.array(z.string()).optional(),
  kunyomi: z.array(z.string()).optional(),
  nanori: z.array(z.string()).optional(),
  radicals: z.array(z.string()).optional(),
  components: z.array(z.string()).optional(),
  frequency_rank: z.number().int().optional(),
  commonness: z.number().min(0).max(1).optional(),
  mnemonic: z.string().optional(),
  semantic_category: z.string().optional(),
});

export const VocabularyCreateSchema = z.object({
  term: z.string().min(1).max(255),
  kana: z.string().min(1).max(255),
  kanji_form: z.string().optional(),
  meanings: z.array(z.string()).nonempty(),
  jlpt_level: z.string().optional(),
  part_of_speech: z.string().optional(),
  pitch_accent: z.string().optional(),
  frequency_rank: z.number().int().optional(),
  example_sentences: z.array(z.string()).optional(),
  translations: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

// =====================
// QUIZ & REVIEW
// =====================

export const StartSessionSchema = z.object({
  target_duration_ms: z.number().int().positive().optional(),
});

export const SubmitAnswerSchema = z.object({
  session_id: z.string().uuid(),
  item_id: z.string().uuid(),
  item_type: z.enum(['kanji', 'vocabulary']),
  question_type: z.enum([
    'meaning_mcq',
    'reading_mcq',
    'reverse_recall',
    'vocab_recognition',
    'context_question',
    'kanji_selection',
    'vocab_selection',
    'similar_kanji',
    'writing',
    'timed_recall',
  ]),
  selected_answer: z.string(),
  response_time_ms: z.number().int().nonnegative(),
  confidence: z.enum(['guess', 'unsure', 'confident', 'very_confident']).optional(),
  hint_used: z.boolean().optional(),
});

export const EndSessionSchema = z.object({
  session_id: z.string().uuid(),
});

// =====================
// BATCH MANAGEMENT
// =====================

export const CreateBatchSchema = z.object({
  course_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  term: z.string().optional(),
});

export const AddStudentsToBatchSchema = z.object({
  batch_id: z.string().uuid(),
  student_ids: z.array(z.string().uuid()).nonempty(),
});

// =====================
// ASSIGNMENTS
// =====================

export const CreateAssignmentSchema = z.object({
  batch_id: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  content: z.object({
    kanji_ids: z.array(z.string().uuid()).optional(),
    vocabulary_ids: z.array(z.string().uuid()).optional(),
  }),
  question_types: z.array(z.string()).optional(),
  difficulty_level: z.string().optional(),
  deadline: z.string().datetime().optional(),
  target_mastery: z.number().min(0).max(100).optional(),
});

// =====================
// SEARCH & FILTER
// =====================

export const SearchSchema = z.object({
  q: z.string().min(1),
  type: z.enum(['kanji', 'vocabulary', 'all']).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
});

export const FilterProgressSchema = z.object({
  jlpt_level: z.string().optional(),
  mastery_min: z.number().min(0).max(100).optional(),
  mastery_max: z.number().min(0).max(100).optional(),
  status: z.enum(['not_started', 'learning', 'weak', 'strong']).optional(),
  last_review_before: z.string().datetime().optional(),
});

// Type exports for use in endpoints
export type SignupInput = z.infer<typeof SignupSchema>;
export type SigninInput = z.infer<typeof SigninSchema>;
export type OnboardingInput = z.infer<typeof OnboardingSchema>;
export type SubmitAnswerInput = z.infer<typeof SubmitAnswerSchema>;
export type CreateAssignmentInput = z.infer<typeof CreateAssignmentSchema>;
