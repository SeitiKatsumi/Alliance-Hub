-- Ampliar os códigos permitidos sem regravar as preferências existentes.
ALTER TABLE user_platform_preferences
  DROP CONSTRAINT IF EXISTS user_platform_preferences_language_check,
  ADD CONSTRAINT user_platform_preferences_language_check
    CHECK (language IN ('pt-BR', 'pt-PT', 'en', 'es'));
