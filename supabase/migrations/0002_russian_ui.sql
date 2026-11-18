-- Interface language preference + language-aware default categories for new users.

alter table public.user_preferences
  add column if not exists ui_language text not null default 'en' check (ui_language in ('en', 'ru'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  lang text := coalesce(new.raw_user_meta_data ->> 'lang', 'en');
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id, ui_language, voice_language, ai_language)
  values (
    new.id,
    case when lang = 'ru' then 'ru' else 'en' end,
    case when lang = 'ru' then 'ru-RU' else 'en-US' end,
    case when lang = 'ru' then 'ru' else 'auto' end
  )
  on conflict (user_id) do nothing;

  if lang = 'ru' then
    insert into public.categories (user_id, name, color) values
      (new.id, 'Работа', 'blue'),
      (new.id, 'Личное', 'violet'),
      (new.id, 'Учёба', 'amber'),
      (new.id, 'Здоровье', 'green'),
      (new.id, 'Финансы', 'rose')
    on conflict (user_id, name) do nothing;
  else
    insert into public.categories (user_id, name, color) values
      (new.id, 'Work', 'blue'),
      (new.id, 'Personal', 'violet'),
      (new.id, 'Study', 'amber'),
      (new.id, 'Health', 'green'),
      (new.id, 'Finance', 'rose')
    on conflict (user_id, name) do nothing;
  end if;
  return new;
end $$;
