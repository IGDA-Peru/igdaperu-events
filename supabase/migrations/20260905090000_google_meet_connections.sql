create table if not exists public.google_meet_connections (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  connected_by uuid not null references auth.users(id) on delete restrict,
  google_subject text not null,
  google_email text not null,
  refresh_token_ciphertext text not null,
  scopes text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'revoked', 'error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint google_meet_connections_community_unique unique (community_id)
);

create index if not exists google_meet_connections_community_idx
  on public.google_meet_connections (community_id);

drop trigger if exists google_meet_connections_set_updated_at on public.google_meet_connections;
create trigger google_meet_connections_set_updated_at
  before update on public.google_meet_connections
  for each row execute function public.set_updated_at();

alter table public.google_meet_connections enable row level security;
alter table public.google_meet_connections force row level security;
revoke all on public.google_meet_connections from anon, authenticated;

alter table public.events
  add column if not exists meeting_connection_id uuid references public.google_meet_connections(id) on delete set null,
  add column if not exists meeting_external_id text;

create index if not exists events_meeting_connection_idx
  on public.events (meeting_connection_id)
  where meeting_connection_id is not null;

create table if not exists public.google_meet_oauth_states (
  id uuid primary key default gen_random_uuid(),
  state_hash text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  return_path text not null default '/app/eventos/nuevo',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists google_meet_oauth_states_expiry_idx
  on public.google_meet_oauth_states (expires_at);

alter table public.google_meet_oauth_states enable row level security;
alter table public.google_meet_oauth_states force row level security;
revoke all on public.google_meet_oauth_states from anon, authenticated;
