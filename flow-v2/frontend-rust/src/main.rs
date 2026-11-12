use chrono::{Datelike, Duration, NaiveDate, Weekday};
use gloo_net::http::Request;
use leptos::prelude::*;
use serde::{Deserialize, Serialize};
use wasm_bindgen_futures::spawn_local;

// Production Rust builds can target the separately deployed Rust API with
// FLOW_RUST_EDGE_URL=/api/v2/school. This isolated preview retains the
// existing API until the new Worker is configured and verified.
const SCHOOL_ENDPOINT: &str = match option_env!("FLOW_RUST_EDGE_URL") {
    Some(value) => value,
    None => "https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/school-data",
};
const PROFILE_KEY: &str = "flow-school-profile-v3";
const THEME_KEY: &str = "flow-v2-rust-theme";

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct School {
    office_code: String,
    school_code: String,
    name: String,
    #[serde(default)]
    kind: String,
    #[serde(default)]
    address: String,
    #[serde(default)]
    homepage: String,
    #[serde(default)]
    phone: String,
    #[serde(default)]
    english_name: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct Profile {
    school: School,
    grade: u8,
    class_name: String,
}

#[derive(Clone, Debug, Deserialize, Default, PartialEq)]
struct Lesson {
    #[serde(default)]
    date: String,
    #[serde(default)]
    period: u8,
    #[serde(default)]
    subject: String,
}

#[derive(Clone, Debug, Deserialize, Default, PartialEq)]
struct Meal {
    #[serde(default)]
    date: String,
    #[serde(default, rename = "type")]
    meal_type: String,
    #[serde(default)]
    dishes: Vec<String>,
    #[serde(default)]
    calories: String,
}

#[derive(Clone, Debug, Deserialize, Default, PartialEq)]
struct SchoolEvent {
    #[serde(default)]
    date: String,
    #[serde(default)]
    name: String,
    #[serde(default)]
    grade1: String,
    #[serde(default)]
    grade2: String,
    #[serde(default)]
    grade3: String,
}

#[derive(Clone, Debug, Deserialize, Default, PartialEq)]
struct Dashboard {
    #[serde(default)]
    timetable: Vec<Lesson>,
    #[serde(default)]
    meals: Vec<Meal>,
    #[serde(default)]
    events: Vec<SchoolEvent>,
}

#[derive(Deserialize)]
struct SearchResponse { schools: Vec<School> }

#[derive(Clone, Copy, Debug, PartialEq)]
enum Tab { Today, Schedule, School, Settings }
impl Tab {
    fn label(self) -> &'static str {
        match self { Self::Today => "오늘", Self::Schedule => "일정", Self::School => "학교", Self::Settings => "설정" }
    }
    fn index(self) -> usize {
        match self { Self::Today => 0, Self::Schedule => 1, Self::School => 2, Self::Settings => 3 }
    }
}

fn storage() -> Option<web_sys::Storage> {
    web_sys::window()?.local_storage().ok().flatten()
}
fn stored<T: for<'de> Deserialize<'de>>(key: &str) -> Option<T> {
    serde_json::from_str(&storage()?.get_item(key).ok()??).ok()
}
fn store<T: Serialize>(key: &str, value: &T) {
    if let (Some(s), Ok(json)) = (storage(), serde_json::to_string(value)) {
        let _ = s.set_item(key, &json);
    }
}
fn today_local() -> NaiveDate {
    let js = js_sys::Date::new_0();
    NaiveDate::from_ymd_opt(js.get_full_year() as i32, js.get_month()+1, js.get_date())
        .unwrap_or_else(|| NaiveDate::from_ymd_opt(2026, 1, 1).unwrap())
}
fn ymd(day: NaiveDate) -> String { day.format("%Y%m%d").to_string() }
fn event_date(raw: &str) -> String {
    NaiveDate::parse_from_str(raw,"%Y%m%d")
        .map(|date|format!("{}월 {}일",date.month(),date.day()))
        .unwrap_or_else(|_|raw.to_owned())
}
fn monday(day: NaiveDate) -> NaiveDate {
    day - Duration::days(day.weekday().num_days_from_monday() as i64)
}
fn day_letter(day: NaiveDate) -> &'static str {
    match day.weekday() {
        Weekday::Mon => "월", Weekday::Tue => "화", Weekday::Wed => "수",
        Weekday::Thu => "목", Weekday::Fri => "금", Weekday::Sat => "토", Weekday::Sun => "일",
    }
}
fn choose_events(data: &Dashboard, grade: u8) -> Vec<SchoolEvent> {
    let mut result: Vec<_> = data.events.iter().filter(|e| match grade {
        1 if e.grade1 == "N" => false,
        2 if e.grade2 == "N" => false,
        3 if e.grade3 == "N" => false,
        _ => true
    }).cloned().collect();
    result.sort_by(|a,b| a.date.cmp(&b.date));
    result
}
fn today_meal(data: &Dashboard, day: NaiveDate) -> Option<Meal> {
    data.meals.iter().filter(|m| m.date == ymd(day))
        .find(|m| m.meal_type.contains("중식"))
        .or_else(|| data.meals.iter().find(|m| m.date == ymd(day))).cloned()
}
fn today_lessons(data: &Dashboard, day: NaiveDate) -> Vec<Lesson> {
    let mut result: Vec<_> = data.timetable.iter().filter(|l| l.date == ymd(day)).cloned().collect();
    result.sort_by_key(|l| l.period);
    result
}
async fn school_api(query: &str) -> Result<serde_json::Value, String> {
    let url = format!("{}?{}", SCHOOL_ENDPOINT, query);
    let reply = Request::get(&url).send().await.map_err(|e| e.to_string())?;
    if !reply.ok() { return Err(format!("학교 데이터 요청 실패 ({})", reply.status())); }
    reply.json().await.map_err(|e| e.to_string())
}
fn load_data(profile: Profile, day: NaiveDate,
             dashboard: RwSignal<Option<Dashboard>>, error: RwSignal<String>,
             busy: RwSignal<bool>, serial: RwSignal<u64>) {
    let seq = serial.get_untracked() + 1;
    serial.set(seq);
    let query = format!(
        "action=dashboard&office={}&school={}&grade={}&class={}&kind={}&date={}",
        urlencoding::encode(&profile.school.office_code),
        urlencoding::encode(&profile.school.school_code),
        profile.grade, urlencoding::encode(&profile.class_name),
        urlencoding::encode(&profile.school.kind), ymd(day));
    busy.set(true);
    error.set(String::new());
    spawn_local(async move {
        let result = school_api(&query).await
            .and_then(|value| serde_json::from_value::<Dashboard>(value).map_err(|e|e.to_string()));
        if serial.get_untracked() != seq { return; }
        match result {
            Ok(value) => dashboard.set(Some(value)),
            Err(message) => { dashboard.set(None); error.set(message); }
        }
        busy.set(false);
    });
}
fn apply_theme(dark: bool) {
    if let Some(doc) = web_sys::window().and_then(|w|w.document()) {
        if let Some(root) = doc.document_element() {
            let _ = root.set_attribute("data-theme", if dark {"dark"} else {"light"});
        }
    }
}

#[component]
fn App() -> impl IntoView {
    let profile = RwSignal::new(stored::<Profile>(PROFILE_KEY));
    let tab = RwSignal::new(Tab::Today);
    let date = RwSignal::new(today_local());
    let dashboard = RwSignal::<Option<Dashboard>>::new(None);
    let error = RwSignal::new(String::new());
    let busy = RwSignal::new(false);
    let serial = RwSignal::new(0u64);
    let dark = RwSignal::new(stored::<bool>(THEME_KEY).unwrap_or(false));
    apply_theme(dark.get_untracked());

    Effect::new(move |_| {
        if let Some(saved) = profile.get() {
            load_data(saved, date.get(), dashboard, error, busy, serial);
        }
    });

    view! {
        <Show when=move || profile.get().is_some() fallback=move || view! {
            <Setup on_done=Callback::new(move |p: Profile| {store(PROFILE_KEY,&p); profile.set(Some(p));})/>
        }>
            <div class="flow-shell" data-mode=move || tab.get().label()>
                <aside class="flow-rail">
                    <div class="brand-lockup"><span class="brand-mark">"F"</span><strong>"flow"</strong><small>"SCHOOL"</small></div>
                    <div class="rail-caption">"공부에 집중할 시간."</div>
                    <nav class="rail-navigation" aria-label="주 메뉴">
                        {[Tab::Today,Tab::Schedule,Tab::School,Tab::Settings].into_iter()
                            .map(|t| view!{
                                <button class:active=move || tab.get()==t
                                        aria-current=move || if tab.get()==t {"page"} else {"false"}
                                        on:click=move |_| tab.set(t)>
                                    <span class="nav-index">{format!("0{}", t.index()+1)}</span>
                                    <span class="nav-label">{t.label()}</span>
                                    <span class="nav-arrow" aria-hidden="true">"↗"</span>
                                </button>
                            }).collect_view()}
                    </nav>
                    <div class="rail-bottom">
                        <a href="/">"이전 Flow"</a><a href="/university">"대학 모드"</a>
                        <span class="mono">"RUST / WASM"</span>
                    </div>
                </aside>

                <header class="mobile-header">
                    <span class="mobile-logo">"flow" <small>"SCHOOL"</small></span>
                    <span class="mobile-class">{move || profile.get().map(|p|format!("{}학년 {}반",p.grade,p.class_name)).unwrap_or_default()}</span>
                </header>
                <main class="flow-main">
                    {move || match tab.get() {
                        Tab::Today => view! { <Today data=dashboard date=date
                            profile=profile busy=busy error=error/> }.into_any(),
                        Tab::Schedule => view!{<Schedule data=dashboard date=date busy=busy error=error/>}.into_any(),
                        Tab::School => view!{<SchoolInfo profile=profile/>}.into_any(),
                        Tab::Settings => view!{<Settings dark=dark profile=profile/>}.into_any(),
                    }}
                </main>
                <nav class="mobile-bottom" aria-label="모바일 메뉴">
                    {[Tab::Today,Tab::Schedule,Tab::School,Tab::Settings].into_iter()
                      .map(|t| view!{
                        <button class:active=move || tab.get()==t
                          on:click=move |_| tab.set(t)>
                          <span class="mobile-nav-index">{format!("0{}", t.index()+1)}</span>{t.label()}
                        </button>}).collect_view()}
                </nav>
            </div>
        </Show>
    }
}

#[component]
fn Setup(on_done: Callback<Profile>) -> impl IntoView {
    let query = RwSignal::new(String::new());
    let results = RwSignal::new(Vec::<School>::new());
    let selected = RwSignal::<Option<School>>::new(None);
    let grade = RwSignal::new("1".to_owned());
    let class_name = RwSignal::new("1".to_owned());
    let searching = RwSignal::new(false);
    let error = RwSignal::new(String::new());
    let find = move || {
        let q=query.get_untracked();
        if q.trim().chars().count()<2 { error.set("학교명을 두 글자 이상 입력하세요.".into()); return; }
        searching.set(true);
        error.set(String::new());
        spawn_local(async move {
            match school_api(&format!("action=search&q={}",urlencoding::encode(q.trim()))).await
                .and_then(|v|serde_json::from_value::<SearchResponse>(v).map_err(|e|e.to_string())) {
                Ok(body) => results.set(body.schools),
                Err(message) => error.set(message),
            }
            searching.set(false);
        });
    };
    view!{
        <div class="onboarding">
            <div class="onboarding-title">
                <div class="brand-lockup"><span class="brand-mark">"F"</span><strong>"flow"</strong><small>"SCHOOL"</small></div>
                <span class="eyebrow">"YOUR DAY, IN FLOW"</span>
                <h1>"학교 생활을" <em>"새로운 흐름으로."</em></h1>
                <p>"시간표와 급식, 학사일정까지. 정보를 찾는 시간을 줄이고 오늘에 집중하세요."</p>
                <div class="onboarding-footer">"Made for school days. Built with Rust."</div>
            </div>
            <section class="setup-sheet">
                <span class="eyebrow">"01 — SETUP"</span>
                <h2>"내 학교 연결하기"</h2>
                <p>"기존 Flow에서 선택한 정보는 그대로 사용할 수 있어요."</p>
                <label for="school-search">"학교 이름"</label>
                <div class="search-combo">
                    <input id="school-search" type="search" placeholder="예: 정동고등학교"
                        prop:value=move || query.get()
                        on:input=move |ev|query.set(event_target_value(&ev))
                        on:keydown=move |ev| if ev.key()=="Enter" {ev.prevent_default();find()}/>
                    <button class="button-strong" on:click=move |_| find()>"검색"</button>
                </div>
                <p class="form-status" role="status">{move || if searching.get() {"검색 중…".to_owned()}else{error.get()}}</p>
                <div class="school-search-results">
                    <For each=move || results.get() key=|s|s.school_code.clone()
                        children=move |s| {
                            let school=s.clone();
                            view!{ <button class="search-option" on:click=move |_| selected.set(Some(school.clone()))>
                                <strong>{s.name}</strong><small>{s.address}</small>
                            </button> }
                        }/>
                </div>
                <Show when=move || selected.get().is_some()>
                    <div class="selection-summary">{move || selected.get().map(|s|s.name).unwrap_or_default()}</div>
                    <div class="two-fields">
                        <label>"학년"<select on:change=move |ev| grade.set(event_target_value(&ev))>
                            <option value="1">"1학년"</option><option value="2">"2학년"</option><option value="3">"3학년"</option>
                        </select></label>
                        <label>"반"<input type="text" inputmode="numeric" maxlength="12"
                             prop:value=move || class_name.get()
                             on:input=move |ev|class_name.set(event_target_value(&ev)) /></label>
                    </div>
                    <button class="setup-complete button-strong" on:click=move |_| {
                        if let Some(school)=selected.get_untracked(){
                            let class=class_name.get_untracked();
                            if !class.trim().is_empty(){
                                on_done.run(Profile{school,grade:grade.get_untracked().parse().unwrap_or(1),
                                  class_name:class.trim().to_owned()});
                            }
                        }
                    }>"Flow 시작하기" <span aria-hidden="true">"↗"</span></button>
                </Show>
            </section>
        </div>
    }
}

#[component]
fn Today(
    data: RwSignal<Option<Dashboard>>, date:RwSignal<NaiveDate>,
    profile:RwSignal<Option<Profile>>, busy:RwSignal<bool>, error:RwSignal<String>
) -> impl IntoView {
    let view_mode = RwSignal::new(false);
    let selected = move || date.get();
    let lessons = move || data.get().as_ref().map(|d|today_lessons(d,selected())).unwrap_or_default();
    let meals = move || data.get().as_ref().and_then(|d|today_meal(d,selected()));
    let next = move || data.get().as_ref().and_then(|d|choose_events(d,
        profile.get().map(|p|p.grade).unwrap_or(1)).into_iter().find(|e|e.date>=ymd(selected())));
    view! {
        <div class="scene" data-scene="today">
            <div class="scene-head">
                <div><span class="eyebrow">"01 / YOUR DAY"</span>
                    <h1>"오늘의 흐름"<span class="heading-period">"."</span></h1>
                    <p>{move || profile.get().map(|p|format!("{} · {}학년 {}반",p.school.name,p.grade,p.class_name)).unwrap_or_default()}</p>
                </div>
                <span class="hero-counter">{move ||date.get().format("%m/%d").to_string()}</span>
            </div>
            <div class="date-toolbar">
                <div class="date-label"><strong>{move ||format!("{}월 {}일",selected().month(),selected().day())}</strong>
                    <small>{move || format!("{}요일",day_letter(selected()))}</small></div>
                <div class="date-actions">
                    <button title="이전 날" aria-label="이전 날" on:click=move |_|date.update(|d|*d-=Duration::days(1))>"←"</button>
                    <button title="오늘로" on:click=move |_|date.set(today_local())>"오늘"</button>
                    <button title="다음 날" aria-label="다음 날" on:click=move |_|date.update(|d|*d+=Duration::days(1))>"→"</button>
                </div>
            </div>
            <Show when=move ||!error.get().is_empty()>
              <p class="api-error" role="alert">{move ||error.get()}</p>
            </Show>
            <div class="data-stats">
                <div class="stat"><span>"TODAY / CLASSES"</span><strong>{move || if busy.get() {"…".into()} else {format!("{:02}",lessons().len())}}</strong><small>"오늘 수업"</small></div>
                <div class="stat"><span>"MEAL / STATUS"</span><strong>{move || if meals().is_some() {"있음"} else {"—"}}</strong><small>"급식"</small></div>
                <div class="stat"><span>"NEXT / EVENT"</span><strong class="stat-text">{move || next().map(|e|e.name).unwrap_or_else(||"예정 없음".into())}</strong>
                     <small>{move ||next().map(|e|event_date(&e.date)).unwrap_or_default()}</small></div>
            </div>
            <div class="content-columns">
                <section class="content-sheet timetable-sheet">
                    <div class="section-line"><span>"01"</span><h2>"시간표"</h2>
                        <div class="switch-track" role="group" aria-label="시간표 보기">
                            <button class:chosen=move || !view_mode.get()
                              on:click=move |_|view_mode.set(false)>"오늘"</button>
                            <button class:chosen=move || view_mode.get()
                              on:click=move |_|view_mode.set(true)>"주간"</button></div>
                    </div>
                    <Show when=move ||!view_mode.get() fallback=move ||view!{
                        <div class="week-sheet">
                          {move ||(0..5).map(|offset| {
                              let day=monday(selected())+Duration::days(offset);
                              let rows=data.get().as_ref().map(|d|today_lessons(d,day)).unwrap_or_default();
                              view!{<button class:today=move ||date.get()==day
                                  on:click=move |_|date.set(day)>
                                  <small>{day_letter(day)}</small><b>{format!("{:02}",rows.len())}</b>
                                  <span>{rows.first().map(|r|r.subject.clone()).unwrap_or("—".into())}</span>
                              </button>}
                          }).collect_view()}
                        </div>
                    }>
                        <div class="class-rows">
                            <For each=lessons key=|l|format!("{}:{}",l.date,l.period)
                                children=|l|view!{
                                    <div class="class-row">
                                        <span class="class-period">{format!("{:02}",l.period)}</span>
                                        <strong>{l.subject}</strong>
                                        <span class="row-line" aria-hidden="true"></span>
                                        <span class="class-type">"수업"</span>
                                    </div>
                                }/>
                        </div>
                    </Show>
                    <Show when=move ||lessons().is_empty() && !busy.get()>
                        <p class="empty-note">"등록된 수업이 없습니다."</p>
                    </Show>
                </section>
                <div class="content-aside">
                    <section class="content-sheet meal-sheet">
                        <div class="section-line"><span>"02"</span><h2>"오늘의 급식"</h2><small>"LUNCH"</small></div>
                        <Show when=move ||meals().is_some() fallback=||view!{<p class="empty-note">"급식 정보가 없습니다."</p>}>
                            <ul class="meal-list">
                                <For each=move ||meals().map(|m|m.dishes).unwrap_or_default()
                                    key=|dish|dish.clone() children=|dish|view!{<li>{dish}</li>}/>
                            </ul>
                            <div class="meal-foot">{move ||meals().map(|m|m.calories).unwrap_or_default()}</div>
                        </Show>
                    </section>
                    <section class="content-sheet upcoming-sheet">
                        <div class="section-line"><span>"03"</span><h2>"다음 일정"</h2></div>
                        <div class="event-lead">{move ||next().map(|e|e.name).unwrap_or_else(||"예정 없음".into())}</div>
                        <p class="event-date">{move ||next().map(|e|event_date(&e.date)).unwrap_or_default()}</p>
                    </section>
                    <a class="transit-link" href="/transit"><span>"대구 교통 정보"</span><strong>"확인하기 ↗"</strong></a>
                </div>
            </div>
        </div>
    }
}

#[component]
fn Schedule(data:RwSignal<Option<Dashboard>>, date:RwSignal<NaiveDate>, busy:RwSignal<bool>,error:RwSignal<String>) -> impl IntoView {
    let month = move ||date.get().format("%Y년 %m월").to_string();
    let events = move ||data.get().map(|d|d.events).unwrap_or_default();
    view! {
        <div class="scene" data-scene="calendar">
            <div class="scene-head"><div><span class="eyebrow">"02 / SCHEDULE"</span>
                <h1>"학사일정"<span class="heading-period">"."</span></h1>
                <p>"한 달의 흐름을 한눈에."</p></div>
                <span class="hero-counter">{move ||date.get().format("%m").to_string()}</span></div>
            <div class="calendar-toolbar">
                <h2>{month}</h2><div class="date-actions">
                  <button on:click=move |_|date.update(|d|{
                      let (y,m)=(d.year(),d.month());*d=if m==1 {NaiveDate::from_ymd_opt(y-1,12,1).unwrap()}else{NaiveDate::from_ymd_opt(y,m-1,1).unwrap()};
                  })> "←" </button>
                  <button on:click=move |_|date.set(today_local())>"이번 달"</button>
                  <button on:click=move |_|date.update(|d|{
                      let (y,m)=(d.year(),d.month());*d=if m==12 {NaiveDate::from_ymd_opt(y+1,1,1).unwrap()}else{NaiveDate::from_ymd_opt(y,m+1,1).unwrap()};
                  })> "→" </button></div>
            </div>
            <Show when=move ||!error.get().is_empty()><p role="alert" class="api-error">{move ||error.get()}</p></Show>
            <section class="content-sheet calendar-sheet">
                <div class="calendar-grid">
                    {["일","월","화","수","목","금","토"].into_iter().map(|d|view!{<span class="weekday">{d}</span>}).collect_view()}
                    {move ||{
                        let first=date.get().with_day(1).unwrap();
                        let begin=first-Duration::days(first.weekday().num_days_from_sunday() as i64);
                        (0..42).map(move |offset|{
                            let day=begin+Duration::days(offset);
                            let count=events().iter().filter(|e|e.date==ymd(day)).count();
                            view!{<button class:out-month=move ||day.month()!=date.get().month()
                                    class:today=move ||day==today_local()
                                    class:selected=move ||day==date.get()
                                    on:click=move |_|date.set(day)>
                                <span>{format!("{:02}",day.day())}</span>
                                {if count>0 {format!("{}개 일정",count)} else {String::new()}}
                            </button>}
                        }).collect_view()
                    }}
                </div>
            </section>
            <section class="content-sheet event-sheet">
                <div class="section-line"><span>"DETAIL"</span><h2>"표시된 일정"</h2>
                    <small>{move ||if busy.get(){"불러오는 중".into()}else{format!("{}개",events().len())}}</small></div>
                <div class="event-lines"><For each=events key=|e|format!("{}-{}",e.date,e.name)
                    children=|e|view!{<div><span>{event_date(&e.date)}</span><strong>{e.name}</strong></div>}/></div>
            </section>
        </div>
    }
}

#[component]
fn SchoolInfo(profile:RwSignal<Option<Profile>>) -> impl IntoView {
    view! {
        <div class="scene" data-scene="school">
            <div class="scene-head"><div><span class="eyebrow">"03 / SCHOOL"</span>
                <h1>"학교 정보"<span class="heading-period">"."</span></h1></div>
                <span class="hero-counter">"03"</span></div>
            <section class="content-sheet school-sheet">
                <span class="eyebrow">"MY SCHOOL"</span>
                <h2>{move ||profile.get().map(|p|p.school.name).unwrap_or_default()}</h2>
                <p>{move ||profile.get().map(|p|p.school.address).unwrap_or_default()}</p>
                <div class="school-details">
                    <div><small>"학교 유형"</small><strong>{move ||profile.get().map(|p|p.school.kind).unwrap_or_default()}</strong></div>
                    <div><small>"학급"</small><strong>{move ||profile.get().map(|p|format!("{}학년 {}반",p.grade,p.class_name)).unwrap_or_default()}</strong></div>
                    <div><small>"전화번호"</small><strong>{move ||profile.get().map(|p|p.school.phone).unwrap_or_default()}</strong></div>
                </div>
                <div class="school-actions"><a href="/" class="button-strong">"기존 Flow ↗"</a>
                    <a href="https://www.schoolinfo.go.kr/Main.do" target="_blank" rel="noopener noreferrer">"학교알리미 ↗"</a></div>
            </section>
        </div>
    }
}

#[component]
fn Settings(dark:RwSignal<bool>,profile:RwSignal<Option<Profile>>) -> impl IntoView {
    view!{
        <div class="scene" data-scene="settings">
            <div class="scene-head"><div><span class="eyebrow">"04 / PREFERENCES"</span>
                <h1>"설정"<span class="heading-period">"."</span></h1></div>
                <span class="hero-counter">"04"</span></div>
            <section class="content-sheet settings-sheet">
                <div class="setting-row"><div><strong>"테마"</strong><small>"밝은 화면 또는 어두운 화면"</small></div>
                    <button class="setting-toggle" aria-pressed=move ||dark.get()
                        on:click=move |_|{
                           let next=!dark.get_untracked();dark.set(next);store(THEME_KEY,&next);apply_theme(next);
                        }>{move ||if dark.get(){"다크 모드 ●"}else{"라이트 모드 ○"}}</button></div>
                <div class="setting-row"><div><strong>"학급 변경"</strong><small>"새 학교를 연결할 때 기존 Flow 설정과 호환됩니다."</small></div>
                    <button class="setting-toggle" on:click=move |_|{
                        profile.set(None);
                    }>"다시 선택 ↗"</button></div>
                <div class="setting-row"><div><strong>"전체 기능"</strong><small>"아직 이식되지 않은 메뉴는 기존 서비스에서 사용할 수 있습니다."</small></div>
                    <a href="/" class="setting-toggle">"기존 Flow ↗"</a></div>
            </section>
            <p class="note">"이 화면은 Rust WebAssembly 미리보기입니다. 기존 배포 환경은 변경하지 않았습니다."</p>
        </div>
    }
}

fn main() {
    leptos::mount::mount_to_body(App);
}
