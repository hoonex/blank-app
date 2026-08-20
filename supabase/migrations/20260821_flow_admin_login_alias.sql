alter table public.flow_admins
  add column if not exists login_name text;

update public.flow_admins
set login_name = 'flowadmin'
where login_name is null
  and label = 'owner';

create unique index if not exists flow_admins_login_name_lower_idx
  on public.flow_admins (lower(login_name))
  where login_name is not null;

revoke all on table public.flow_admins from anon, authenticated;
