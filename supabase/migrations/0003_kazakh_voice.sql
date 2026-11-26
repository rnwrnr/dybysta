
-- Allow Kazakh voice recognition in the browser fallback.
alter table public.user_preferences drop constraint if exists user_preferences_voice_language_check;
alter table public.user_preferences add constraint user_preferences_voice_language_check check (voice_language in ('en-US', 'ru-RU', 'kk-KZ'));
