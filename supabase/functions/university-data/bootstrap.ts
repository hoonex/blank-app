import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/*
 * Public Data Portal issues one account credential that can authorize multiple
 * approved APIs. Keep the historical university-specific names as optional
 * compatibility overrides, but make DATA_GO_KR_SERVICE_KEY the canonical
 * production secret for the shared credential.
 */
const commonPublicDataKey = Deno.env.get("DATA_GO_KR_SERVICE_KEY") || Deno.env.get("UNIVERSITY_DATA_KEY") || "";

if (commonPublicDataKey && !Deno.env.get("UNIVERSITY_DATA_KEY")) {
  Deno.env.set("UNIVERSITY_DATA_KEY", commonPublicDataKey);
}

await import("./index.ts");
