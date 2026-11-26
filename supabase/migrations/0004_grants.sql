-- Newer Supabase projects don't automatically grant table access to the API roles.
-- Signed-in users get access to the app tables; Row Level Security still limits
-- every user to their own rows.

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on table
  public.profiles,
  public.user_preferences,
  public.categories,
  public.tasks,
  public.reminders,
  public.notes,
  public.ideas,
  public.events
to authenticated;

grant execute on function public.delete_my_account() to authenticated;

-- Tables added later get the same access.
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
