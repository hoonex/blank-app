const ALLOWED_ORIGINS = new Set([
  "https://raw.githack.com",
  "https://flow-student-blush.vercel.app",
]);

const QUEST_EVENTS = new Set([
  "page_view","return_visit","quest_start","quest_complete","quest_abort","shop_purchase","share","focus_import",
]);
const SCHOOL_EVENT_MAP: Record<string, string> = {
  school_page_view: "page_view",
  school_return_visit: "return_visit",
  school_search: "school_search",
  school_select: "school_select",
  school_setup_complete: "setup_complete",
  school_dashboard_view: "dashboard_view",
  school_tab_view: "tab_view",
  school_subject_override: "subject_override",
  school_meal_photo_search: "meal_photo_search",
  school_calendar_date_select: "calendar_date_select",
  school_national_schedule_open: "national_schedule_open",
  school_timetable_share: "timetable_share",
  school_mode_switch: "mode_switch",
};
const UNIVERSITY_EVENT_MAP: Record<string, string> = {
  university_page_view: "page_view",
  university_return_visit: "return_visit",
  university_search: "search",
  university_select: "select",
  university_tab_view: "tab_view",
  university_timetable_import: "timetable_import",
  university_personal_schedule: "personal_schedule",
  university_major_select: "major_select",
  university_mode_switch: "mode_switch",
};

const cors = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
});
const json = (origin: string, status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors(origin), "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (!ALLOWED_ORIGINS.has(origin)) return new Response("Forbidden", { status: 403, headers: { "cache-control": "no-store" } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return json(origin, 405, { error: "method_not_allowed" });
  if (Number(req.headers.get("content-length") || 0) > 4096) return json(origin, 413, { error: "payload_too_large" });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(origin, 400, { error: "invalid_json" }); }
  const eventName = typeof body.event_name === "string" ? body.event_name : "";
  const anonId = typeof body.anon_id === "string" ? body.anon_id : "";
  if (!/^[A-Za-z0-9-]{8,80}$/.test(anonId)) return json(origin, 400, { error: "invalid_anon_id" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return json(origin, 500, { error: "server_config" });

  let table = "";
  let payload: Record<string, unknown> = {};
  const schoolEvent = SCHOOL_EVENT_MAP[eventName];
  const universityEvent = UNIVERSITY_EVENT_MAP[eventName];
  if (schoolEvent) {
    table = "flow_school_events";
    payload = { anonymous_id: anonId, event_name: schoolEvent };
  } else if (universityEvent) {
    table = "flow_university_events";
    payload = { anonymous_id: anonId, event_name: universityEvent };
  } else if (QUEST_EVENTS.has(eventName)) {
    table = "flow_quest_events";
    payload = { anon_id: anonId, event_name: eventName, session_minutes: null, source: "flow-quest-web", metadata: {} };
  } else {
    return json(origin, 400, { error: "invalid_event" });
  }

  const insert = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      "apikey": serviceRole,
      "authorization": `Bearer ${serviceRole}`,
      "content-type": "application/json",
      "prefer": "return=minimal",
    },
    body: JSON.stringify(payload),
  });
  if (!insert.ok) {
    console.error("flow_event_insert_failed", table, insert.status, await insert.text());
    return json(origin, 503, { error: "event_unavailable" });
  }
  return new Response(null, { status: 204, headers: { ...cors(origin), "cache-control": "no-store" } });
});
