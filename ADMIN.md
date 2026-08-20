# Flow Admin

`/admin` is a private operations surface. The static HTML is public like the rest of Flow, but operational data is not: `flow-admin` verifies the Supabase user token and then checks `public.flow_admins` with a server-side secret key before returning anything.

## Security model

- Browser contains only the Supabase publishable key.
- Admin password is sent over HTTPS directly to Supabase Auth and is never stored in the Flow repository, database tables, or `flow-admin` Edge Function.
- The browser persists only the Supabase access/refresh session in local storage so the same device can remain signed in.
- Access tokens are refreshed automatically with the refresh token; a new password login is only required after logout, revocation, or an invalidated refresh session.
- The Supabase secret/service-role key never leaves the Edge Function environment.
- `flow_admins` and probe logs have RLS enabled with no `anon` or `authenticated` policies.
- The admin RPC is executable only by `service_role`.
- The allowlist is fail-closed. With zero rows in `flow_admins`, nobody can enter.
- The Service Worker deliberately does not cache `/admin`.
- No raw anonymous IDs, user-agent hashes, query strings, school names, or request payloads are returned by the overview RPC.
- API health checks are manual. There is no admin polling loop.

## One-time bootstrap

Create or use an existing Supabase Auth user with a password, then add its UUID from the Supabase SQL editor or another trusted server-side path:

```sql
insert into public.flow_admins (user_id, label)
select id, 'owner'
from auth.users
where lower(email) = lower('OWNER_EMAIL_HERE')
on conflict (user_id) do update set label = excluded.label;
```

Do not put the owner email or password into the public repository.

## Login flow

1. Open `/admin`.
2. Enter the allowlisted Supabase Auth email and password.
3. Supabase Auth returns an access/refresh token pair.
4. Flow stores the session on that device and automatically refreshes the access token.
5. `flow-admin` still performs the server-side allowlist check on every protected request.

The password is not sent to `flow-admin`; only the Supabase bearer access token is.

## What v1 shows

- Product activity counts from the existing `flow_quest_events` stream.
- Anonymous-device cardinality as an aggregate only.
- Registered Flow profile count.
- Top activity events and hourly activity.
- Manual health probes for `school-data`, `university-data`, and `university-campus`.

This first version intentionally does not instrument every Edge Function request. Adding per-request server telemetry is a separate performance-sensitive change and should use background aggregation rather than a second blocking request on every user API call.
