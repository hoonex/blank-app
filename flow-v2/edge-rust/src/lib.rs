use worker::*;

const UPSTREAM: &str = "https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/school-data";

#[event(fetch)]
async fn fetch(req: Request, _env: Env, _ctx: Context) -> Result<Response> {
    if req.method() != Method::Get {
        return Response::error("Method not allowed", 405);
    }
    match req.path().as_str() {
        "/healthz" => Response::from_json(&serde_json::json!({
            "service": "flow-school-edge-v2",
            "status": "ok"
        })),
        "/api/v2/school" => {
            let incoming = req.url()?;
            let mut upstream = url::Url::parse(UPSTREAM)?;
            upstream.set_query(incoming.query());
            Fetch::Url(upstream).send().await
        }
        _ => Response::error("Not found", 404),
    }
}
