// =====================
// IDENTITY & AUTH
// =====================

export type UserRole = 'student' | 'teacher' | 'academy_admin' | 'system_admin';

export interface User {
  id: string;
  auth_id: string;
  email: string;
  name: string;
  role: UserRole;
  timezone: string;
  locale: string;
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Academy {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface AcademyMember {
  id: string;
  academy_id: string;
  user_id: string;
  role: UserRole;
  joined_at: string;
}

// =====================
// CURRICULUM
// =====================

export interface Course {
  id: string;
  academy_id: string;
  name: string;
  description: string | null;
  jlpt_level: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Batch {
  id: string;
  course_id: string;
  academy_id: string;
  teacher_id: string;
  name: string;
  term: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface BatchStudent {
  id: string;
  batch_id: string;
  student_id: string;
  joined_at: string;
}

// =====================
// CONTENT
// =====================

export interface Kanji {
  id: string;
  character: string;
  unicode: number;
  jlpt_level: string | null;
  grade_level: number | null;
  stroke_count: number;
  meanings: string[];
  onyomi: string[] | null;
  kunyomi: string[] | null;
  nanori: string[] | null;
  radicals: string[] | null;
  components: string[] | null;
  frequency_rank: number | null;
  commonness: number | null;
  mnemonic: string | null;
  visual_similarity_group: string | null;
  semantic_category: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Vocabulary {
  id: string;
  term: string;
  kana: string;
  kanji_form: string | null;
  meanings: string[];
  jlpt_level: string | null;
  part_of_speech: string | null;
  pitch_accent: string | null;
  frequency_rank: number | null;
  example_sentences: string[] | null;
  translations: string[] | null;
  tags: string[] | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type RelationshipType =
  | 'contains_kanji'
  | 'derived_from'
  | 'related_meaning'
  | 'commonly_confused_with'
  | 'same_radical'
  | 'same_component'
  | 'same_reading';

export interface KanjiVocabulary {
  id: string;
  kanji_id: string;
  vocabulary_id: string;
  relationship: RelationshipType;
  created_at: string;
}

// =====================
// LEARNING PROGRESS
// =====================

export interface StudentKanjiProgress {
  id: string;
  student_id: string;
  kanji_id: string;
  academy_id: string;
  
  meaning_score: number;
  reading_score: number;
  recognition_score: number;
  writing_score: number;
  vocabulary_score: number;
  
  overall_mastery: number;
  memory_strength: number;
  difficulty_estimate: number;
  
  current_interval_days: number;
  next_review_at: string;
  last_review_at: string | null;
  
  total_attempts: number;
  correct_attempts: number;
  incorrect_attempts: number;
  forget_count: number;
  consecutive_correct: number;
  consecutive_incorrect: number;
  
  average_response_ms: number;
  fastest_response_ms: number;
  slowest_response_ms: number;
  
  hint_count: number;
  confidence_score: number;
  mature_reviews: number;
  lapses: number;
  
  created_at: string;
  updated_at: string;
}

export interface StudentVocabProgress {
  id: string;
  student_id: string;
  vocabulary_id: string;
  academy_id: string;
  
  meaning_score: number;
  reading_score: number;
  recognition_score: number;
  
  overall_mastery: number;
  memory_strength: number;
  difficulty_estimate: number;
  
  current_interval_days: number;
  next_review_at: string;
  last_review_at: string | null;
  
  total_attempts: number;
  correct_attempts: number;
  incorrect_attempts: number;
  forget_count: number;
  
  average_response_ms: number;
  confidence_score: number;
  
  created_at: string;
  updated_at: string;
}

export type LearningProgress = StudentKanjiProgress | StudentVocabProgress;

// =====================
// QUIZ / REVIEW
// =====================

export type QuestionType =
  | 'meaning_mcq'
  | 'reading_mcq'
  | 'reverse_recall'
  | 'vocab_recognition'
  | 'context_question'
  | 'kanji_selection'
  | 'vocab_selection'
  | 'similar_kanji'
  | 'writing'
  | 'timed_recall';

export type ConfidenceLevel = 'guess' | 'unsure' | 'confident' | 'very_confident';

export interface QuizSession {
  id: string;
  student_id: string;
  academy_id: string;
  started_at: string;
  ended_at: string | null;
  target_duration_ms: number | null;
  metadata: Record<string, unknown>;
  version: string;
  created_at: string;
}

export interface QuizAnswer {
  id: string;
  session_id: string;
  student_id: string;
  item_id: string;
  item_type: 'kanji' | 'vocabulary';
  question_type: QuestionType;
  
  shown_at: string;
  answered_at: string | null;
  response_time_ms: number | null;
  
  prompt: string;
  selected_answer: string | null;
  correct_answer: string;
  is_correct: boolean;
  
  confidence: ConfidenceLevel | null;
  hint_used: boolean;
  attempt_number: number;
  
  difficulty_at_time: number | null;
  memory_state_before: Record<string, unknown> | null;
  memory_state_after: Record<string, unknown> | null;
  
  selection_reason: string | null;
  algorithm_version: string | null;
  
  created_at: string;
}

// =====================
// CONFUSION & PATTERNS
// =====================

export interface ConfusionPair {
  id: string;
  student_id: string;
  academy_id: string;
  item_a_id: string;
  item_a_type: 'kanji' | 'vocabulary';
  item_b_id: string;
  item_b_type: 'kanji' | 'vocabulary';
  
  confusion_count: number;
  last_seen_at: string;
  
  student_strength: number;
  class_strength: number;
  global_strength: number;
  
  created_at: string;
  updated_at: string;
}

// =====================
// ASSIGNMENTS
// =====================

export type AssignmentStatus = 'assigned' | 'started' | 'completed' | 'mastered';

export interface Assignment {
  id: string;
  batch_id: string;
  academy_id: string;
  created_by: string;
  
  title: string;
  description: string | null;
  
  content: {
    kanji_ids?: string[];
    vocabulary_ids?: string[];
  };
  question_types: QuestionType[];
  difficulty_level: string;
  
  deadline: string | null;
  target_mastery: number;
  
  created_at: string;
  updated_at: string;
}

export interface StudentAssignment {
  id: string;
  assignment_id: string;
  student_id: string;
  
  assigned_at: string;
  started_at: string | null;
  completed_at: string | null;
  
  status: AssignmentStatus;
  completion_percent: number;
  mastery: number;
  
  created_at: string;
  updated_at: string;
}

// =====================
// ML PREDICTIONS
// =====================

export interface MemoryPrediction {
  id: string;
  student_id: string;
  item_id: string;
  item_type: 'kanji' | 'vocabulary';
  
  predicted_recall: number;
  forget_risk: number;
  recommended_delay_days: number;
  
  model_version: string;
  features: Record<string, unknown>;
  
  predicted_at: string;
  created_at: string;
}

// =====================
// DOMAIN-SPECIFIC
// =====================

export interface MasteryScore {
  meaning: number;
  reading: number;
  recognition: number;
  writing: number;
  vocabulary: number;
  overall: number;
}

export interface LearningState {
  mastery: MasteryScore;
  memory_strength: number;
  next_review_at: string;
  forget_risk: number;
  difficulty: number;
}

export interface StudyQueueItem {
  id: string;
  item_id: string;
  item_type: 'kanji' | 'vocabulary';
  priority: number;
  reason: string;
  recommended_question_types: QuestionType[];
}

export interface StudyQueue {
  session_id: string;
  items: StudyQueueItem[];
  total_items: number;
  estimated_duration_ms: number;
}

export interface StudentSettings {
  id: string;
  student_id: string;
  academy_id: string;
  
  japanese_level: string;
  jlpt_target: string | null;
  daily_study_minutes: number;
  study_goals: string[];
  exam_date: string | null;
  
  preferred_session_difficulty: 'easy' | 'medium' | 'hard';
  show_furigana: boolean;
  enable_audio: boolean;
  notifications_enabled: boolean;
  
  settings: Record<string, unknown>;
  
  created_at: string;
  updated_at: string;
}

// =====================
// API REQUESTS/RESPONSES
// =====================

export interface StartSessionRequest {
  student_id: string;
  academy_id: string;
  target_duration_ms?: number;
}

export interface SubmitAnswerRequest {
  session_id: string;
  item_id: string;
  item_type: 'kanji' | 'vocabulary';
  question_type: QuestionType;
  selected_answer: string;
  response_time_ms: number;
  confidence?: ConfidenceLevel;
  hint_used?: boolean;
}

export interface SubmitAnswerResponse {
  is_correct: boolean;
  correct_answer: string;
  explanation: string;
  updated_mastery: MasteryScore;
  next_review_at: string;
  new_confusion_pair?: {
    item_a_id: string;
    item_b_id: string;
    strength: number;
  };
}

export interface DashboardResponse {
  today_due: number;
  weak_kanji: Array<{
    kanji: Kanji;
    mastery: number;
    forget_risk: number;
  }>;
  likely_to_forget: Array<{
    kanji: Kanji;
    forget_risk: number;
    reason: string;
  }>;
  memory_health: number;
  streak: number;
  mastery_trend: Array<{
    date: string;
    mastery: number;
  }>;
}

// =====================
// FLASHCARDS
// =====================

export type FlashcardMode =
  | 'recognition'
  | 'reading'
  | 'recall'
  | 'writing'
  | 'vocabulary'
  | 'context'
  | 'discrimination'
  | 'reverse_recall';

export interface FlashcardContent {
  type: 'kanji' | 'vocabulary' | 'text' | 'sentence';
  content: string;
  furigana?: string;
  romaji?: string;
  subtext?: string;
  prompt?: string;
  front?: string;
  back?: string;
  reading?: string;
  jlptLevel?: string;
  meanings?: string[];
  onyomi?: string[];
  kunyomi?: string[];
  components?: string[];
  strokeCount?: number;
  mnemonic?: string;
  confusionWarning?: string;
  exampleSentence?: string;
  exampleTranslation?: string;
}

export interface Flashcard {
  id: string;
  item_id: string;
  item_type: 'kanji' | 'vocabulary';
  mode: FlashcardMode;
  front: FlashcardContent;
  back: FlashcardContent;
  options?: string[];
  correct_answer: string;
  hint?: string;
  difficulty: number;
}

export interface FlashcardSessionConfig {
  modes: FlashcardMode[];
  show_furigana: boolean;
  show_romaji?: boolean;
  enable_audio?: boolean;
  enable_hints?: boolean;
  hint_delay_ms?: number;
  difficulty_level?: 'easy' | 'medium' | 'hard';
  adaptive_difficulty?: boolean;
  shuffle?: boolean;
  target_duration_ms?: number;
  target_card_count?: number;
}

// =====================
// TYPE GUARDS & HELPERS
// =====================

export function isKanjiProgress(progress: LearningProgress): progress is StudentKanjiProgress {
  return 'kanji_id' in progress;
}

export function isVocabProgress(progress: LearningProgress): progress is StudentVocabProgress {
  return 'vocabulary_id' in progress;
}
