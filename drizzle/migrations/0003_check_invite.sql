create or replace function public.check_invite(_code text) returns text
language sql stable security definer set search_path = public as $$
  select business_name from profiles where invite_code = upper(trim(_code)) and member_role = 'owner'
$$;
grant execute on function public.check_invite(text) to anon, authenticated;