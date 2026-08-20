create table if not exists public.flow_admin_bootstrap_tokens (
  token_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.flow_admin_bootstrap_tokens enable row level security;
revoke all on table public.flow_admin_bootstrap_tokens from anon, authenticated;
create index if not exists flow_admin_bootstrap_tokens_user_idx on public.flow_admin_bootstrap_tokens (user_id, expires_at desc);
