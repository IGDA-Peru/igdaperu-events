-- Supabase installs pgcrypto in the extensions schema. The event mutation
-- trigger runs with a restricted search_path, so include that schema when it
-- hashes the authenticated subject for the rate limiter.
alter function public.enforce_event_mutation_rate_limit()
  set search_path = public, extensions, pg_temp;
