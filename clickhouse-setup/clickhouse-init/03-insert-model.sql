USE voice_analytics;

INSERT INTO model_pricing VALUES
-- OpenAI STT
('550e8400-e29b-41d4-a716-446655440001', 'openai', 'stt', 'whisper-1', 'v1', 'per_second', 0.0, 0.0, 0.006, 'USD', '1 second', '2024-01-01 00:00:00.000', NULL, true, 'global', 'standard', now(), now()),

-- OpenAI LLM Models
('550e8400-e29b-41d4-a716-446655440002', 'openai', 'llm', 'gpt-4-turbo', 'latest', 'per_token', 0.01, 0.03, 0.0, 'USD', '1K tokens', '2024-01-01 00:00:00.000', NULL, true, 'global', 'standard', now(), now()),
('550e8400-e29b-41d4-a716-446655440003', 'openai', 'llm', 'gpt-3.5-turbo', 'latest', 'per_token', 0.001, 0.002, 0.0, 'USD', '1K tokens', '2024-01-01 00:00:00.000', NULL, true, 'global', 'standard', now(), now()),

-- OpenAI TTS
('550e8400-e29b-41d4-a716-446655440004', 'openai', 'tts', 'tts-1', 'latest', 'per_character', 0.0, 0.0, 0.000015, 'USD', '1 character', '2024-01-01 00:00:00.000', NULL, true, 'global', 'standard', now(), now()),
('550e8400-e29b-41d4-a716-446655440005', 'openai', 'tts', 'tts-1-hd', 'latest', 'per_character', 0.0, 0.0, 0.00003, 'USD', '1 character', '2024-01-01 00:00:00.000', NULL, true, 'global', 'standard', now(), now()),

-- Google STT
('550e8400-e29b-41d4-a716-446655440006', 'google', 'stt', 'chirp', 'latest', 'per_second', 0.0, 0.0, 0.004, 'USD', '1 second', '2024-01-01 00:00:00.000', NULL, true, 'global', 'standard', now(), now()),

-- Anthropic LLM
('550e8400-e29b-41d4-a716-446655440007', 'anthropic', 'llm', 'claude-3-haiku', 'latest', 'per_token', 0.00025, 0.00125, 0.0, 'USD', '1K tokens', '2024-01-01 00:00:00.000', NULL, true, 'global', 'standard', now(), now()),
('550e8400-e29b-41d4-a716-446655440008', 'anthropic', 'llm', 'claude-3-sonnet', 'latest', 'per_token', 0.003, 0.015, 0.0, 'USD', '1K tokens', '2024-01-01 00:00:00.000', NULL, true, 'global', 'standard', now(), now());
USE voice_analytics;

INSERT INTO model_pricing VALUES
-- OpenAI STT
('550e8400-e29b-41d4-a716-446655440001', 'openai', 'stt', 'whisper-1', 'v1', 'per_second', 0.0, 0.0, 0.006, 'USD', '1 second', '2024-01-01 00:00:00.000', NULL, true, 'global', 'standard', now(), now()),

-- OpenAI LLM Models
('550e8400-e29b-41d4-a716-446655440002', 'openai', 'llm', 'gpt-4-turbo', 'latest', 'per_token', 0.01, 0.03, 0.0, 'USD', '1K tokens', '2024-01-01 00:00:00.000', NULL, true, 'global', 'standard', now(), now()),
('550e8400-e29b-41d4-a716-446655440003', 'openai', 'llm', 'gpt-3.5-turbo', 'latest', 'per_token', 0.001, 0.002, 0.0, 'USD', '1K tokens', '2024-01-01 00:00:00.000', NULL, true, 'global', 'standard', now(), now()),

-- OpenAI TTS
('550e8400-e29b-41d4-a716-446655440004', 'openai', 'tts', 'tts-1', 'latest', 'per_character', 0.0, 0.0, 0.000015, 'USD', '1 character', '2024-01-01 00:00:00.000', NULL, true, 'global', 'standard', now(), now()),
('550e8400-e29b-41d4-a716-446655440005', 'openai', 'tts', 'tts-1-hd', 'latest', 'per_character', 0.0, 0.0, 0.00003, 'USD', '1 character', '2024-01-01 00:00:00.000', NULL, true, 'global', 'standard', now(), now()),

-- Google STT
('550e8400-e29b-41d4-a716-446655440006', 'google', 'stt', 'chirp', 'latest', 'per_second', 0.0, 0.0, 0.004, 'USD', '1 second', '2024-01-01 00:00:00.000', NULL, true, 'global', 'standard', now(), now()),

-- Anthropic LLM
('550e8400-e29b-41d4-a716-446655440007', 'anthropic', 'llm', 'claude-3-haiku', 'latest', 'per_token', 0.00025, 0.00125, 0.0, 'USD', '1K tokens', '2024-01-01 00:00:00.000', NULL, true, 'global', 'standard', now(), now()),
('550e8400-e29b-41d4-a716-446655440008', 'anthropic', 'llm', 'claude-3-sonnet', 'latest', 'per_token', 0.003, 0.015, 0.0, 'USD', '1K tokens', '2024-01-01 00:00:00.000', NULL, true, 'global', 'standard', now(), now());
