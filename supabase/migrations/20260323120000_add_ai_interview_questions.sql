-- Gemini 추천 면접 질문 (JSON 배열: { "question", "intent" })
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS ai_interview_questions JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN candidates.ai_interview_questions IS 'AI가 제안한 면접 질문 목록 [{ question, intent }]';
