ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS model_used TEXT;

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_model_used_check;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_model_used_check
  CHECK (model_used IS NULL OR model_used IN ('gpt-5.6-sol', 'claude-opus'));

ALTER TABLE public.user_settings
  ALTER COLUMN model SET DEFAULT 'gpt-5.6-sol';

UPDATE public.user_settings
SET model = 'gpt-5.6-sol'
WHERE model = 'google/gemini-3.7-flash';
