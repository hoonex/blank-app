# Flow Admin

`/admin` is a private operations surface. The static HTML is public like the rest of Flow, but operational data is not: `flow-admin` verifies the Supabase user token and then checks `public.flow_admins` with a server-side secret key before returning anything.

## Security model

- Browser contains only the Supabase publishable key.
- The Supabase secret/service-role key never leaves the Edge Function environment.
- `flow_admins` and probe logs have RLS enabled with no `anon` or `authenticated` policies.
- The admin RPC is executable only by `service_role`.
- The allowlist is fail-closed. With zero rows in `flow_admins`, nobody can enter.
- The Service Worker deliberately does not cache `/admin`.
- No raw anonymous IDs, user-agent hashes, query strings, school names, or request payloads are returned by the overview RPC.
- API health checks are manual. There is no admin polling loop.

## One-time bootstrap

After the owner has an existing Supabase Auth account, add its UUID from the Supabase SQL editor or another trusted server-side path:

```sql
insert into public.flow_admins (user_id, label)
select id, 'owner'
from auth.users
where lower(email) = lower('OWNER_EMAIL_HERE')
on conflict (user_id) do update set label = excluded.label;
```

Do not put the owner email into the public repository.

## What v1 shows

- Product activity counts from the existing `flow_quest_events` stream.
- Anonymous-device cardinality as an aggregate only.
- Registered Flow profile count.
- Top activity events and hourly activity.
- Manual health probes for `school-data`, `university-data`, and `university-campus`.

This first version intentionally does not instrument every Edge Function request. Adding per-request server telemetry is a separate performance-sensitive change and should use background aggregation rather than a second blocking request on every user API call.
