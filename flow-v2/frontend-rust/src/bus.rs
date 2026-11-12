//! In-page Daegu bus-stop search and arrival information.
 //! Server bridge owns upstream URLs, cache, validation and status messages.
use chrono::{DateTime, FixedOffset};
use gloo_net::http::Request;
use leptos::prelude::*;
use serde::{Deserialize, Serialize};
use wasm_bindgen_futures::spawn_local;

const BUS_STOP_KEY: &str = "flow-daegu-favorite-stop-v1";

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
struct BusStop {
    id: String,
    name: String,
    number: String,
}
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ArrivalItem {
    route: String,
    state: String,
    #[serde(default)]
    previous_stop: String,
    remaining_stops: Option<i32>,
    #[serde(default)]
    note: String,
}
#[derive(Debug, Deserialize)]
struct SearchPayload {
    ok: bool,
    #[serde(default)]
    stops: Vec<BusStop>,
    error: Option<String>,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ArrivalPayload {
    ok: bool,
    #[serde(default)]
    buses: Vec<ArrivalItem>,
    #[serde(default)]
    blocked: bool,
    reason: Option<String>,
    fetched_at: Option<String>,
    error: Option<String>,
}
fn local_stop() -> Option<BusStop> {
    let storage=web_sys::window()?.local_storage().ok()??;
    serde_json::from_str(&storage.get_item(BUS_STOP_KEY).ok()??).ok()
}
fn save_stop(stop: &BusStop) {
    if let (Some(s),Ok(json))=(web_sys::window()
        .and_then(|window|window.local_storage().ok().flatten()),
        serde_json::to_string(stop)) {
        let _=s.set_item(BUS_STOP_KEY,&json);
    }
}
fn fetched_time(raw: &str)->String {
    DateTime::parse_from_rfc3339(raw).ok().and_then(|dt|
        FixedOffset::east_opt(9*60*60).map(|tz|dt.with_timezone(&tz)
            .format("%H:%M:%S").to_string())
    ).unwrap_or_default()
}
fn find_stops(
    query:String, results:RwSignal<Vec<BusStop>>, loading:RwSignal<bool>,
    message:RwSignal<String>, request_seq:RwSignal<u64>
) {
    let term=query.trim().to_string();
    if term.chars().count()<2 || term.chars().count()>40 {
        message.set("정류소 이름을 두 글자 이상 입력해 주세요.".to_string());
        return;
    }
    let id=request_seq.get_untracked()+1;
    request_seq.set(id);
    loading.set(true);
    message.set(String::new());
    let url=format!("/api/bus/search?q={}",urlencoding::encode(&term));
    spawn_local(async move {
        let result=async {
            let response=Request::get(&url).send().await.map_err(|e|e.to_string())?;
            let ok=response.ok();
            let payload=response.json::<SearchPayload>().await.map_err(|e|e.to_string())?;
            if !ok || !payload.ok {return Err(payload.error.unwrap_or_else(||"검색을 완료하지 못했어요.".into()))}
            Ok(payload.stops)
        }.await;
        if request_seq.get_untracked()!=id {return;}
        loading.set(false);
        match result {
            Ok(items)=>{
                if items.is_empty(){message.set("검색 결과가 없어요. 정류장 이름을 다시 확인해 주세요.".into())}
                results.set(items);
            }
            Err(_)=>{results.set(Vec::new());message.set("정류장을 검색할 수 없어요. 잠시 후 다시 시도해 주세요.".into());}
        }
    });
}
fn refresh_arrivals(
    stop_id:String, rows:RwSignal<Vec<ArrivalItem>>, loading:RwSignal<bool>,
    message:RwSignal<String>, blocked:RwSignal<bool>, stamp:RwSignal<String>,
    request_seq:RwSignal<u64>
) {
    let id=request_seq.get_untracked()+1;
    request_seq.set(id);
    loading.set(true);
    message.set(String::new());
    let url=format!("/api/bus/arrivals?stopId={}",stop_id);
    spawn_local(async move {
        let result=async {
            let response=Request::get(&url).send().await.map_err(|e|e.to_string())?;
            let ok=response.ok();
            let payload=response.json::<ArrivalPayload>().await.map_err(|e|e.to_string())?;
            if !ok||!payload.ok {
                return Err(payload.error.unwrap_or_else(||"도착정보를 불러오지 못했어요.".into()));
            }
            Ok(payload)
        }.await;
        if request_seq.get_untracked()!=id{return;}
        loading.set(false);
        match result {
            Ok(payload)=>{
                blocked.set(payload.blocked);
                message.set(payload.reason.unwrap_or_default());
                stamp.set(payload.fetched_at.as_deref().map(fetched_time).unwrap_or_default());
                rows.set(payload.buses);
            }
            Err(_)=>{
                rows.set(Vec::new());stamp.set(String::new());
                message.set("도착정보 연결에 실패했어요. 새로고침으로 다시 조회해 주세요.".into());
            }
        }
    });
}
#[component]
pub fn BusInfo()->impl IntoView {
    let query=RwSignal::new(String::new());
    let results=RwSignal::<Vec<BusStop>>::new(Vec::new());
    let selected=RwSignal::new(local_stop());
    let busy_search=RwSignal::new(false);
    let search_message=RwSignal::new(String::new());
    let seq_search=RwSignal::new(0u64);
    let arrivals=RwSignal::<Vec<ArrivalItem>>::new(Vec::new());
    let busy_arrivals=RwSignal::new(false);
    let arrival_message=RwSignal::new(String::new());
    let blocked=RwSignal::new(false);
    let fetched_at=RwSignal::new(String::new());
    let seq_arrival=RwSignal::new(0u64);
    let loaded_stop=RwSignal::new(String::new());
    Effect::new(move |_|{
        if let Some(stop)=selected.get() {
            if loaded_stop.get_untracked()!=stop.id {
                loaded_stop.set(stop.id.clone());
                refresh_arrivals(stop.id,arrivals,busy_arrivals,arrival_message,blocked,
                    fetched_at,seq_arrival);
            }
        }
    });
    view! {
        <section class="bus-panel" id="bus-info">
            <div class="bus-title">
                <div>
                    <span class="module-kicker">"대구 버스정보시스템 연동"</span>
                    <h2>"버스 도착"</h2>
                </div>
                <span class="bus-source">"실제 정류장 데이터"</span>
            </div>
            <form class="bus-search" on:submit=move |ev|{
                ev.prevent_default();
                find_stops(query.get_untracked(),results,busy_search,search_message,seq_search);
            }>
                <label class="sr-only" for="bus-stop-query">"정류장 검색"</label>
                <input id="bus-stop-query" type="search" autocomplete="off"
                    placeholder="정류장 이름 검색 · 예: 동대구역"
                    prop:value=move ||query.get()
                    on:input=move |ev|query.set(event_target_value(&ev)) />
                <button type="submit" disabled=move ||busy_search.get()>
                    {move ||if busy_search.get(){"검색 중"}else{"검색"}}
                </button>
            </form>
            <Show when=move ||!search_message.get().is_empty()>
                <p class="bus-message" role="status">{move ||search_message.get()}</p>
            </Show>
            <Show when=move ||!results.get().is_empty()>
                <div class="bus-results" aria-label="정류장 검색 결과">
                    <For each=move ||results.get() key=|s|s.id.clone() children=move |stop|{
                        let clicked=stop.clone();
                        view! {
                            <button type="button" class="bus-stop-option" on:click=move |_|{
                                save_stop(&clicked);
                                selected.set(Some(clicked.clone()));
                                results.set(Vec::new());
                                query.set(clicked.name.clone());
                            }>
                                <strong>{stop.name}</strong>
                                <span>{format!("정류장 {}",stop.number)}</span>
                            </button>
                        }
                    }/>
                </div>
            </Show>
            <Show when=move ||selected.get().is_some()
                fallback=move ||view!{<p class="bus-empty">"정류장을 검색해 선택하면 이곳에서 도착정보를 볼 수 있어요."</p>}>
                <div class="bus-selected">
                    <div class="bus-selected-heading">
                        <div class="bus-stop-name">
                            <strong>{move ||selected.get().map(|s|s.name).unwrap_or_default()}</strong>
                            <span>{move ||selected.get().map(|s|format!("정류장 번호 {}",s.number)).unwrap_or_default()}</span>
                        </div>
                        <button type="button" class="bus-refresh" disabled=move ||busy_arrivals.get()
                            on:click=move |_|{
                                if let Some(stop)=selected.get_untracked(){
                                    refresh_arrivals(stop.id,arrivals,busy_arrivals,arrival_message,
                                        blocked,fetched_at,seq_arrival)
                                }
                            }>{move ||if busy_arrivals.get(){"조회 중"}else{"새로고침"}}</button>
                    </div>
                    <div class="bus-meta">
                        <span>{move ||if fetched_at.get().is_empty(){
                            "대구시 운행정보".to_string()
                        }else{format!("조회 {}",fetched_at.get())}}</span>
                        <span>"도착예정은 실시간으로 변할 수 있어요"</span>
                    </div>
                    <Show when=move ||!arrival_message.get().is_empty()>
                        <p class="bus-message" role="status">{move ||arrival_message.get()}</p>
                    </Show>
                    <Show when=move ||!busy_arrivals.get()>
                        <Show when=move ||!arrivals.get().is_empty()
                            fallback=move ||view!{<p class="bus-empty">"현재 제공되는 버스 도착정보가 없어요."</p>}>
                            <div class="bus-arrivals">
                                <For each=move ||arrivals.get()
                                    key=|b|format!("{}-{}",b.route,b.state)
                                    children=move |bus|{
                                        view! {
                                            <div class="bus-arrival">
                                                <strong class="bus-route">{bus.route}</strong>
                                                <div class="bus-arrival-info">
                                                    <strong>{bus.state}</strong>
                                                    <span>{match bus.remaining_stops{
                                                        Some(n) if n>0=>format!("{}개 정류장 전",n),
                                                        Some(0)=>"정류장 근처".to_string(),
                                                        _=>String::new()
                                                    }}</span>
                                                    <Show when=move ||!bus.note.is_empty()>
                                                        <small>{bus.note.clone()}</small>
                                                    </Show>
                                                </div>
                                            </div>
                                        }
                                    }/>
                            </div>
                        </Show>
                    </Show>
                </div>
            </Show>
            <p class="bus-footnote">"출처: 대구광역시 버스정보시스템. 정류장 선택 정보만 이 기기에 저장돼요."</p>
        </section>
    }
}
