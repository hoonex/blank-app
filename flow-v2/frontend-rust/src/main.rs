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


fn switch_section(next:Tab, current:RwSignal<Tab>, motion:RwSignal<usize>) {
    if current.get_untracked() != next {
        current.set(next);
        motion.update(|n|*n+=1);
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
    let loaded_period = RwSignal::new(String::new());
    let dark = RwSignal::new(stored::<bool>(THEME_KEY).unwrap_or(false));
    let page_motion = RwSignal::new(0usize);
    apply_theme(dark.get_untracked());

    Effect::new(move |_| {
        if let Some(saved) = profile.get() {
            let day = date.get();
            let key = format!("{}:{}:{}:{}:{}",saved.school.school_code,
                saved.grade,saved.class_name,ymd(monday(day)),day.format("%Y%m"));
            if loaded_period.get_untracked() != key {
                loaded_period.set(key);
                load_data(saved,day,dashboard,error,busy,serial);
            }
        } else {
            loaded_period.set(String::new());
        }
    });

    view! {
        <Show when=move ||profile.get().is_some() fallback=move ||view!{
            <Setup on_done=Callback::new(move |p:Profile|{
                store(PROFILE_KEY,&p);profile.set(Some(p));
            })/>
        }>
            <div class="flow-shell" data-mode=move ||tab.get().label()>
                <header class="global-header">
                    <div class="brand-wrap">
                        <div class="brand-lockup">
                            <strong>"flow"</strong><span class="brand-accent" aria-hidden="true">"•"</span>
                        </div>
                        <span class="brand-edition">"school"</span>
                    </div>
                    <nav class="rail-navigation" aria-label="주 메뉴">
                        {[Tab::Today,Tab::Schedule,Tab::School,Tab::Settings].into_iter()
                            .map(|item|view! {
                                <button type="button" class:active=move ||tab.get()==item
                                    aria-current=move ||if tab.get()==item {"page"} else {"false"}
                                    on:click=move |_|switch_section(item,tab,page_motion)>
                                    <span>{item.label()}</span>
                                </button>
                            }).collect_view()}
                    </nav>
                    <div class="global-meta">
                        <span class="school-meta">{move ||profile.get().map(|p|
                            format!("{} / {}학년 {}반",p.school.name,p.grade,p.class_name)
                        ).unwrap_or_default()}</span>
                        <a href="/legacy" title="기존 Flow 이용하기">"이전 버전 ↗"</a>
                    </div>
                </header>
                <main class="flow-main" id="content">
                    {move ||match tab.get(){
                        Tab::Today => view!{<Today data=dashboard date=date
                            profile=profile busy=busy error=error/>}.into_any(),
                        Tab::Schedule => view!{<Schedule data=dashboard date=date
                            profile=profile busy=busy error=error/>}.into_any(),
                        Tab::School => view!{<SchoolInfo profile=profile/>}.into_any(),
                        Tab::Settings => view!{<Settings dark=dark profile=profile/>}.into_any(),
                    }}
                </main>
                <nav class="mobile-bottom" aria-label="모바일 메뉴">
                    {[Tab::Today,Tab::Schedule,Tab::School,Tab::Settings].into_iter()
                        .map(|item|view!{
                            <button type="button" class:active=move ||tab.get()==item
                                aria-current=move ||if tab.get()==item{"page"}else{"false"}
                                on:click=move |_|switch_section(item,tab,page_motion)>
                                <span>{item.label()}</span>
                            </button>
                        }).collect_view()}
                </nav>
                <div class="transition-layer" aria-hidden="true">
                    <For each=move ||if page_motion.get()==0 {vec![]} else {vec![page_motion.get()]}
                        key=|sequence|*sequence
                        children=move |_|view!{
                            <div class="transition-curtain">
                                <span class="curtain-label">{move ||tab.get().label()}</span>
                            </div>
                        }/>
                </div>
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
                <div class="brand-lockup"><strong>"flow"</strong><span class="brand-accent" aria-hidden="true">"."</span><small>"School"</small></div>
                <span class="eyebrow">"학교 생활을 간단하게"</span>
                <h1>"학교 정보를" <em>"한곳에서."</em></h1>
                <p>"시간표와 급식, 학사일정까지. 정보를 찾는 시간을 줄이고 오늘에 집중하세요."</p>
                
            </div>
            <section class="setup-sheet">
                <span class="eyebrow">"시작하기"</span>
                <h2>"학교 선택"</h2>
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
    data:RwSignal<Option<Dashboard>>, date:RwSignal<NaiveDate>,
    profile:RwSignal<Option<Profile>>, busy:RwSignal<bool>,error:RwSignal<String>
)->impl IntoView{
    let week_mode=RwSignal::new(false);
    let selected=move ||date.get();
    let lessons=move ||data.get().as_ref().map(|d|today_lessons(d,selected())).unwrap_or_default();
    let meals=move ||data.get().as_ref().and_then(|d|today_meal(d,selected()));
    let next=move ||data.get().as_ref().and_then(|d|choose_events(d,
        profile.get().map(|p|p.grade).unwrap_or(1)).into_iter()
        .find(|e|e.date>=ymd(selected())));

    view!{
        <div class="scene" data-scene="today">
            <section class="today-heading">
                <div class="hero-topline">
                    <span class="hero-tag">{move ||if selected()==today_local() {"오늘의 학교생활"} else {"선택한 날짜"}}</span>
                    <span class="hero-school">{move ||profile.get().map(|p|
                        format!("{}　{}학년 {}반",p.school.name,p.grade,p.class_name)
                    ).unwrap_or_default()}</span>
                </div>
                <div class="hero-core">
                    <div class="hero-date">
                        
                        <h1>
                            <span class="date-motion">
                                <For each=move ||vec![ymd(date.get())] key=|v|v.clone()
                                    children=move |value| {
                                        let date=NaiveDate::parse_from_str(&value,"%Y%m%d").unwrap_or(today_local());
                                        view!{<span class="hero-numeral">{format!("{:02}.{:02}",date.month(),date.day())}</span>}
                                    }/>
                            </span>
                            <span class="hero-weekday">{move ||format!("{}요일",day_letter(selected()))}</span>
                        </h1>
                    </div>
                    </div>
                <div class="hero-bottom">
                    <div class="day-strip" role="group" aria-label="날짜 선택">
                        {move ||(0..7).map(|offset|{
                            let day=monday(selected())+Duration::days(offset);
                            view!{
                                <button class:active=move ||date.get()==day
                                    aria-pressed=move ||date.get()==day type="button"
                                    on:click=move |_|date.set(day)>
                                    <small>{day_letter(day)}</small>
                                    <strong>{format!("{:02}",day.day())}</strong>
                                </button>
                            }
                        }).collect_view()}
                    </div>
                    <div class="date-actions">
                        <button type="button" aria-label="이전 날" on:click=move |_|
                            date.update(|d|*d-=Duration::days(1))>"←"</button>
                        <button type="button" class="today-reset"
                            on:click=move |_|date.set(today_local())>"오늘"</button>
                        <button type="button" aria-label="다음 날" on:click=move |_|
                            date.update(|d|*d+=Duration::days(1))>"→"</button>
                    </div>
                </div>
            </section>
            <Show when=move ||!error.get().is_empty()>
                <p class="api-error" role="alert">{move ||error.get()}</p>
            </Show>
            <div class="today-layout">
                <section class="timetable-sheet">
                    <div class="module-heading">
                        <div class="module-heading-copy">
                            <span class="module-kicker">{move ||if selected()==today_local() {"오늘의 수업"} else {"이날의 수업"}}</span>
                            <h2>"시간표"<span class="module-count">{move ||
                                if busy.get(){"··".to_owned()}else{format!("{:02}",lessons().len())}
                            }</span></h2>
                        </div>
                        <div class="switch-track" role="group" aria-label="시간표 보기">
                            <button type="button" class:chosen=move ||!week_mode.get()
                                aria-pressed=move ||!week_mode.get()
                                on:click=move |_|week_mode.set(false)>"하루"</button>
                            <button type="button" class:chosen=move ||week_mode.get()
                                aria-pressed=move ||week_mode.get()
                                on:click=move |_|week_mode.set(true)>"주간"</button>
                        </div>
                    </div>
                    <Show when=move ||!week_mode.get() fallback=move ||view!{
                        <div class="week-sheet">
                            {move ||(0..5).map(|offset|{
                                let day=monday(selected())+Duration::days(offset);
                                let rows=data.get().as_ref().map(|d|today_lessons(d,day)).unwrap_or_default();
                                view!{
                                    <button type="button" class:today=move ||date.get()==day
                                        on:click=move |_|{date.set(day);week_mode.set(false);}>
                                        <span class="week-day">{format!("{} {:02}",day_letter(day),day.day())}</span>
                                        <strong>{if rows.is_empty() {"—".to_owned()}else{format!("{}교시",rows.len())}}</strong>
                                        <div class="week-lessons">
                                            {rows.into_iter().map(|row|view!{<span>{row.subject}</span>}).collect_view()}
                                        </div>
                                    </button>
                                }
                            }).collect_view()}
                        </div>
                    }>
                        <div class="class-rows">
                            <For each=lessons key=|l|format!("{}:{}",l.date,l.period)
                                children=|lesson|view!{
                                    <div class="class-row">
                                        <span class="class-period">{format!("{:02}",lesson.period)}</span>
                                        <strong>{lesson.subject}</strong>
                                    </div>
                                }/>
                        </div>
                    </Show>
                    <Show when=move ||lessons().is_empty() && !busy.get()>
                        <p class="empty-note">"선택한 날의 수업 정보가 없어요."</p>
                    </Show>
                </section>
                <aside class="today-aside">
                    <section class="meal-sheet">
                        <div class="aside-top">
                            <span>{move ||if selected()==today_local() {"오늘의 급식"} else {"이날의 급식"}}</span>
                        </div>
                        <h2>"점심 메뉴"</h2>
                        <Show when=move ||meals().is_some()
                            fallback=||view!{<p class="empty-note">"오늘은 급식 정보가 없어요."</p>}>
                            <ul class="meal-list">
                                <For each=move ||meals().map(|m|m.dishes).unwrap_or_default()
                                    key=|dish|dish.clone() children=|dish|view!{<li>{dish}</li>}/>
                            </ul>
                            <p class="meal-foot">{move ||meals().map(|m|m.calories).unwrap_or_default()}</p>
                        </Show>
                    </section>
                    <section class="upcoming-sheet">
                        <div class="aside-top"><span>"다가오는 일정"</span></div>
                        <strong class="event-lead">{move ||next().map(|e|e.name).unwrap_or_else(||"예정 없음".to_owned())}</strong>
                        <p class="event-date">{move ||next().map(|e|event_date(&e.date)).unwrap_or_default()}</p>
                        <a class="transit-link" href="/transit">"교통 정보 보러가기" <span aria-hidden="true">"↗"</span></a>
                    </section>
                </aside>
            </div>
        </div>
    }
}

#[component]
fn Schedule(
    data:RwSignal<Option<Dashboard>>,date:RwSignal<NaiveDate>,
    profile:RwSignal<Option<Profile>>,busy:RwSignal<bool>,error:RwSignal<String>
)->impl IntoView{
    let month=move ||date.get().format("%Y년 %m월").to_string();
    let events=move ||data.get().map(|d|choose_events(&d,
        profile.get().map(|p|p.grade).unwrap_or(1))).unwrap_or_default();
    view!{
        <div class="scene" data-scene="calendar">
            <header class="scene-head">
                <span class="hero-tag">"학교 일정"</span>
                <h1>"일정"</h1>
                
            </header>
            <div class="calendar-toolbar">
                <h2>{month}</h2>
                <div class="date-actions">
                    <button type="button" aria-label="이전 달" on:click=move |_|
                        date.update(|d|{
                            let (y,m)=(d.year(),d.month());
                            *d=if m==1{NaiveDate::from_ymd_opt(y-1,12,1).unwrap()}
                            else{NaiveDate::from_ymd_opt(y,m-1,1).unwrap()};
                        })>"←"</button>
                    <button type="button" on:click=move |_|date.set(today_local())>"이번 달"</button>
                    <button type="button" aria-label="다음 달" on:click=move |_|
                        date.update(|d|{
                            let (y,m)=(d.year(),d.month());
                            *d=if m==12{NaiveDate::from_ymd_opt(y+1,1,1).unwrap()}
                            else{NaiveDate::from_ymd_opt(y,m+1,1).unwrap()};
                        })>"→"</button>
                </div>
            </div>
            <Show when=move ||!error.get().is_empty()>
                <p class="api-error" role="alert">{move ||error.get()}</p>
            </Show>
            <div class="calendar-layout">
                <section class="calendar-sheet">
                    <div class="calendar-grid">
                        {["일","월","화","수","목","금","토"].into_iter().map(|label|
                            view!{<span class="weekday">{label}</span>}).collect_view()}
                        {move ||{
                            let first=date.get().with_day(1).unwrap();
                            let offset=first.weekday().num_days_from_sunday() as i64;
                            let begin=first-Duration::days(offset);
                            let next_month=if first.month()==12{
                                NaiveDate::from_ymd_opt(first.year()+1,1,1).unwrap()
                            }else{
                                NaiveDate::from_ymd_opt(first.year(),first.month()+1,1).unwrap()
                            };
                            let count=((offset+(next_month-first).num_days()+6)/7)*7;
                            let month_events=events();
                            (0..count).map(move |shift|{
                                let day=begin+Duration::days(shift);
                                let matches=month_events.iter().filter(|e|e.date==ymd(day)).collect::<Vec<_>>();
                                let count=matches.len();
                                let label=matches.first().map(|e|e.name.clone()).unwrap_or_default();
                                view!{
                                    <button type="button"
                                        class:out-month=move ||day.month()!=date.get().month()
                                        class:today=move ||day==today_local()
                                        class:selected=move ||day==date.get()
                                        aria-pressed=move ||day==date.get()
                                        on:click=move |_|date.set(day)>
                                        <span class="calendar-num">{format!("{:02}",day.day())}</span>
                                        <span class="calendar-event-text">{label}</span>
                                        {if count>1 {format!("+{}",count-1)} else {String::new()}}
                                    </button>
                                }
                            }).collect_view()
                        }}
                    </div>
                </section>
                <section class="event-sheet" aria-label="선택한 날짜의 학사일정">
                    <div class="aside-top">
                        <span>"선택한 날짜"</span>
                        <span>{move ||if busy.get(){"불러오는 중".to_owned()}else{
                            let ym=date.get().format("%Y%m").to_string();
                            format!("이번 달 {}건",events().iter().filter(|e|e.date.starts_with(&ym)).count())
                        }}</span>
                    </div>
                    <div class="picked-date">
                        <h2>{move ||format!("{:02}.{:02}",date.get().month(),date.get().day())}</h2>
                        <span>{move ||format!("{}요일",day_letter(date.get()))}</span>
                    </div>
                    <div class="event-lines" aria-live="polite" aria-atomic="true">
                        {move ||{
                            let chosen=ymd(date.get());
                            let all=events();
                            let matching=all.iter().filter(|e|e.date==chosen).cloned().collect::<Vec<_>>();
                            if !matching.is_empty() {
                                view!{
                                    <div class="picked-event-group">
                                        <span class="event-context">"이날 일정"</span>
                                        {matching.into_iter().map(|event|view!{
                                            <div class="event-row"><strong>{event.name}</strong></div>
                                        }).collect_view()}
                                    </div>
                                }.into_any()
                            }else if let Some(upcoming)=all.into_iter()
                                .filter(|e|e.date>chosen).min_by(|a,b|a.date.cmp(&b.date)) {
                                view!{
                                    <div class="picked-event-group">
                                        <span class="picked-empty">"이날 예정된 일정이 없어요."</span>
                                        <div class="event-row">
                                            <span class="event-context">"다음 일정 · " {event_date(&upcoming.date)}</span>
                                            <strong>{upcoming.name}</strong>
                                        </div>
                                    </div>
                                }.into_any()
                            }else{
                                view!{<p class="picked-empty">"예정된 학사일정이 없어요."</p>}.into_any()
                            }
                        }}
                    </div>
                </section>
            </div>
        </div>
    }
}

#[component]
fn SchoolInfo(profile:RwSignal<Option<Profile>>) -> impl IntoView {
    view! {
        <div class="scene" data-scene="school">
            <div class="scene-head"><div><span class="eyebrow">"내 학교"</span>
                <h1>"학교 정보"</h1></div>
</div>
            <section class="content-sheet school-sheet">
                <span class="eyebrow">"학교 정보"</span>
                <h2>{move ||profile.get().map(|p|p.school.name).unwrap_or_default()}</h2>
                <p>{move ||profile.get().map(|p|p.school.address).unwrap_or_default()}</p>
                <div class="school-details">
                    <div><small>"학교 유형"</small><strong>{move ||profile.get().map(|p|p.school.kind).unwrap_or_default()}</strong></div>
                    <div><small>"학급"</small><strong>{move ||profile.get().map(|p|format!("{}학년 {}반",p.grade,p.class_name)).unwrap_or_default()}</strong></div>
                    <div><small>"전화번호"</small><strong>{move ||profile.get().map(|p|p.school.phone).unwrap_or_default()}</strong></div>
                </div>
                <div class="school-actions"><a href="/legacy" class="button-strong">"기존 Flow ↗"</a>
                    <a href="https://www.schoolinfo.go.kr/Main.do" target="_blank" rel="noopener noreferrer">"학교알리미 ↗"</a></div>
            </section>
        </div>
    }
}

#[component]
fn Settings(dark:RwSignal<bool>,profile:RwSignal<Option<Profile>>) -> impl IntoView {
    view!{
        <div class="scene" data-scene="settings">
            <div class="scene-head"><div><span class="eyebrow">"화면과 정보 관리"</span>
                <h1>"설정"</h1></div>
</div>
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
                    <a href="/legacy" class="setting-toggle">"기존 Flow ↗"</a></div>
            </section>
            <p class="note">"이전 화면은 ‘이전 버전’ 메뉴에서 열 수 있습니다. 일부 기능은 아직 기존 화면에서 제공합니다."</p>
        </div>
    }
}

fn main() {
    leptos::mount::mount_to_body(App);
}
