mod bus;
use bus::BusInfo;
use chrono::{Datelike, Duration, NaiveDate, Weekday};
use gloo_net::http::Request;
use leptos::prelude::*;
use serde::{Deserialize, Serialize};
use wasm_bindgen_futures::spawn_local;
use wasm_bindgen::JsCast;

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
    fn from_index(index: usize) -> Self {
        match index { 0 => Self::Today, 1 => Self::Schedule, 2 => Self::School, _ => Self::Settings }
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
fn change_month(date:RwSignal<NaiveDate>,offset:i32){
    let first=date.get_untracked();
    let index=first.year()*12 + first.month() as i32 - 1 + offset;
    let year=index.div_euclid(12);
    let month=index.rem_euclid(12) as u32 + 1;
    if let Some(next)=NaiveDate::from_ymd_opt(year,month,1){date.set(next);}
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


// A native touch contract: one finger, dominant horizontal motion, no gesture
// state outside the active surface. CSS keeps vertical scrolling native.
fn touch_start(event: &web_sys::TouchEvent) -> Option<(i32, i32)> {
    if event.touches().length() != 1 { return None; }
    event.touches().item(0).map(|p| (p.client_x(), p.client_y()))
}
fn touch_end(event: &web_sys::TouchEvent) -> Option<(i32, i32)> {
    event.changed_touches().item(0).map(|p| (p.client_x(), p.client_y()))
}
fn mobile_viewport() -> bool {
    web_sys::window().and_then(|w|w.inner_width().ok())
        .and_then(|v|v.as_f64()).unwrap_or(1024.) <= 870.
}
// Return the moving plate's pixel offset and the closest selection.
// The named host avoids event-delegation currentTarget surprises in Leptos.
fn drag_position(event: &web_sys::TouchEvent, selector: &str, count: usize, gap: f64)
    -> Option<(f64, usize)> {
    let point=event.touches().item(0)?;
    let host=web_sys::window()?.document()?.query_selector(selector).ok()??;
    let rect=host.get_bounding_client_rect();
    let width=rect.width();
    if width <= 0. { return None; }
    let segment=((width - 10. - gap * (count as f64 - 1.)) / count as f64).max(1.);
    let x=(point.client_x() as f64-rect.left()-5.-segment/2.)
        .clamp(0., (width-10.-segment).max(0.));
    let position=(point.client_x() as f64-rect.left()).clamp(0.,width-0.001);
    let index=((position / width * count as f64).floor() as usize).min(count-1);
    Some((x,index))
}
fn switch_section(next:Tab, current:RwSignal<Tab>, motion:RwSignal<usize>, direction:RwSignal<i32>) {
    if current.get_untracked() != next {
        direction.set(if next.index()>current.get_untracked().index(){1}else{-1});
        // A new tab starts at the top of its independent scrollport.
        if let Some(main)=web_sys::window().and_then(|w|w.document())
            .and_then(|doc|doc.query_selector(".flow-main").ok().flatten()) {
            main.set_scroll_top(0);
        }
        if let Some(window)=web_sys::window() {
            window.scroll_to_with_x_and_y(0.0,0.0);
        }
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
    let direction = RwSignal::new(1i32);
    let scene_swipe = RwSignal::<Option<(i32,i32)>>::new(None);
    let nav_touch = RwSignal::<Option<(i32,i32)>>::new(None);
    let nav_drag_x = RwSignal::<Option<f64>>::new(None);
    let nav_preview = RwSignal::<Option<Tab>>::new(None);
    let nav_suppress_click = RwSignal::new(false);
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
            <div class="flow-shell" data-mode=move ||tab.get().label()
                style=move ||format!("--portal-x:{}%;--travel-dir:{}",
                    (tab.get().index() as f64+0.5)*25.,direction.get())
                on:contextmenu=move |ev| {
                    // Suppress Android's hold-to-select menu, not desktop mouse right click.
                    if mobile_viewport() { ev.prevent_default(); }
                }>
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
                                    on:click=move |_|switch_section(item,tab,page_motion,direction)>
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
                <main class="flow-main" id="content"
                    on:touchstart=move |ev| {
                        if !mobile_viewport() {return;}
                        // Horizontal navigation never steals taps on content controls.
                        if let Some(element)=ev.target().and_then(|t|t.dyn_into::<web_sys::Element>().ok()){
                            if element.closest("button,a,input,textarea,select,[contenteditable],.calendar-grid,.calendar-sheet,.day-strip,.week-grid").ok().flatten().is_some(){
                                scene_swipe.set(None);return;
                            }
                        }
                        scene_swipe.set(touch_start(&ev));
                    }
                    on:touchend=move |ev| {
                        if let (Some((start_x,start_y)),Some((end_x,end_y)))=
                            (scene_swipe.get_untracked(),touch_end(&ev)) {
                            let dx=end_x-start_x;
                            let dy=end_y-start_y;
                            if dx.abs()>=68 && (dx.abs() as f64)>(dy.abs() as f64)*1.35 {
                                let old=tab.get_untracked().index() as i32;
                                let target=(old+if dx<0 {1} else {-1}).clamp(0,3) as usize;
                                switch_section(Tab::from_index(target),tab,page_motion,direction);
                            }
                        }
                        scene_swipe.set(None);
                    }
                    on:touchcancel=move |_|scene_swipe.set(None)>
                    {move ||match tab.get(){
                        Tab::Today => view!{<Today data=dashboard date=date
                            profile=profile busy=busy error=error
                            tab=tab page_motion=page_motion direction=direction/>}.into_any(),
                        Tab::Schedule => view!{<Schedule data=dashboard date=date
                            profile=profile busy=busy error=error/>}.into_any(),
                        Tab::School => view!{<SchoolInfo profile=profile/>}.into_any(),
                        Tab::Settings => view!{<Settings dark=dark profile=profile/>}.into_any(),
                    }}
                </main>
                <nav class="mobile-bottom" aria-label="모바일 메뉴" data-dragging=move ||if nav_drag_x.get().is_some(){"true"}else{"false"}
                    style=move ||format!("--nav-drag-x:{:.1}px",nav_drag_x.get().unwrap_or(0.))
                    on:touchstart=move |ev| {
                        nav_touch.set(touch_start(&ev));
                        nav_drag_x.set(None);
                        nav_preview.set(None);
                        nav_suppress_click.set(false);
                    }
                    on:touchmove=move |ev| {
                        if let (Some((start_x,start_y)),Some((now_x,now_y)))=
                            (nav_touch.get_untracked(),ev.touches().item(0).map(|p|(p.client_x(),p.client_y()))) {
                            if (now_x-start_x).abs()<9 || (now_y-start_y).abs()>40{return;}
                            if let Some((px,i))=drag_position(&ev,".mobile-bottom",4,4.){
                                nav_drag_x.set(Some(px));
                                nav_preview.set(Some(Tab::from_index(i)));
                            }
                        }
                    }
                    on:touchend=move |_ev| {
                        if let Some(item)=nav_preview.get_untracked(){
                            nav_suppress_click.set(true);
                            switch_section(item,tab,page_motion,direction);
                        }
                        nav_touch.set(None);nav_drag_x.set(None);nav_preview.set(None);
                    }
                    on:touchcancel=move |_|{
                        nav_touch.set(None);nav_drag_x.set(None);nav_preview.set(None);
                    }>
                    {[Tab::Today,Tab::Schedule,Tab::School,Tab::Settings].into_iter()
                        .map(|item|view!{
                            <button type="button"
                                class:active=move ||tab.get()==item
                                class:preview=move ||nav_preview.get()==Some(item)
                                aria-current=move ||if tab.get()==item{"page"}else{"false"}
                                on:click=move |_|{
                                    if nav_suppress_click.get_untracked(){
                                        nav_suppress_click.set(false);
                                    }else{switch_section(item,tab,page_motion,direction);}
                                }>
                                <span>{item.label()}</span>
                            </button>
                        }).collect_view()}
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
    profile:RwSignal<Option<Profile>>, busy:RwSignal<bool>,error:RwSignal<String>,
    tab:RwSignal<Tab>,page_motion:RwSignal<usize>,direction:RwSignal<i32>
)->impl IntoView{
    let week_mode=RwSignal::new(false);
    let date_touch=RwSignal::<Option<(i32,i32)>>::new(None);
    let date_drag=RwSignal::new(0.0f64);
    let date_direction=RwSignal::new(1i32);
    let date_last_swipe=RwSignal::new(0.0f64);
    let toggle_touch=RwSignal::<Option<(i32,i32)>>::new(None);
    let toggle_drag_x=RwSignal::<Option<f64>>::new(None);
    let toggle_preview=RwSignal::<Option<bool>>::new(None);
    let toggle_suppress_click=RwSignal::new(false);
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
                    <div class="day-carousel" role="group" aria-label="날짜 선택. 좌우로 밀어서 하루 이동"
                        style=move ||format!("--day-drag-x:{:.1}px;--day-dir:{}",date_drag.get(),date_direction.get())
                        on:touchstart=move |ev|{
                            date_touch.set(touch_start(&ev));
                            date_drag.set(0.);
                        }
                        on:touchmove=move |ev|{
                            if let (Some((sx,sy)),Some(point))=
                                (date_touch.get_untracked(),ev.touches().item(0)){
                                let dx=point.client_x()-sx;
                                let dy=point.client_y()-sy;
                                if dx.abs()>5 && dx.abs() > dy.abs()*2 {
                                    date_drag.set((dx as f64 * 0.5).clamp(-65.,65.));
                                }
                            }
                        }
                        on:touchend=move |ev|{
                            if let (Some((sx,sy)),Some((ex,ey)))=
                                (date_touch.get_untracked(),touch_end(&ev)){
                                let dx=ex-sx;
                                let dy=ey-sy;
                                if dx.abs()>=42 && dx.abs()*100 > dy.abs()*135 {
                                    let direction=if dx<0 {1} else {-1};
                                    date_direction.set(direction);
                                    date_last_swipe.set(js_sys::Date::now());
                                    date.update(|day|*day+=Duration::days(direction as i64));
                                }
                            }
                            date_touch.set(None);
                            date_drag.set(0.);
                        }
                        on:touchcancel=move |_|{
                            date_touch.set(None);
                            date_drag.set(0.);
                        }>
                        <For each=move ||vec![date.get()] key=|day|ymd(*day)
                            children=move |center|{
                                view!{
                                    <div class="day-strip">
                                        {(-2i64..=2).map(|offset|{
                                            let day=center+Duration::days(offset);
                                            view!{
                                                <button type="button"
                                                    class:active=move ||date.get()==day
                                                    aria-pressed=move ||date.get()==day
                                                    aria-label=format!("{}월 {}일 {}요일",day.month(),day.day(),day_letter(day))
                                                    on:click=move |_|{
                                                        if js_sys::Date::now()-date_last_swipe.get_untracked()<550. {return;}
                                                        date_direction.set(if day>=date.get_untracked(){1}else{-1});
                                                        date.set(day);
                                                    }>
                                                    <small>{day_letter(day)}</small>
                                                    <strong>{format!("{:02}",day.day())}</strong>
                                                </button>
                                            }
                                        }).collect_view()}
                                    </div>
                                }
                            }/>
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
                        <div class="switch-track" role="group" aria-label="시간표 보기"
                            data-dragging=move ||if toggle_drag_x.get().is_some(){"true"}else{"false"}
                            style=move ||format!("--toggle-drag-x:{:.1}px",toggle_drag_x.get().unwrap_or(0.))
                            on:touchstart=move |ev|{
                                toggle_touch.set(touch_start(&ev));
                                toggle_drag_x.set(None);toggle_preview.set(None);
                                toggle_suppress_click.set(false);
                            }
                            on:touchmove=move |ev|{
                                if let (Some((sx,_)),Some(p))=(toggle_touch.get_untracked(),ev.touches().item(0)){
                                    if (p.client_x()-sx).abs()<7{return;}
                                    if let Some((px,index))=drag_position(&ev,".switch-track",2,4.){
                                        toggle_drag_x.set(Some(px));toggle_preview.set(Some(index==1));
                                    }
                                }
                            }
                            on:touchend=move |_ev|{
                                if let Some(next)=toggle_preview.get_untracked(){
                                    toggle_suppress_click.set(true);week_mode.set(next);
                                }
                                toggle_touch.set(None);toggle_drag_x.set(None);toggle_preview.set(None);
                            }
                            on:touchcancel=move |_|{
                                toggle_touch.set(None);toggle_drag_x.set(None);toggle_preview.set(None);
                            }>
                            <button type="button" class:chosen=move ||!week_mode.get()
                                class:preview=move ||toggle_preview.get()==Some(false)
                                aria-pressed=move ||!week_mode.get()
                                on:click=move |_|{
                                    if toggle_suppress_click.get_untracked(){toggle_suppress_click.set(false);}
                                    else{week_mode.set(false);}
                                }>"하루"</button>
                            <button type="button" class:chosen=move ||week_mode.get()
                                class:preview=move ||toggle_preview.get()==Some(true)
                                aria-pressed=move ||week_mode.get()
                                on:click=move |_|{
                                    if toggle_suppress_click.get_untracked(){toggle_suppress_click.set(false);}
                                    else{week_mode.set(true);}
                                }>"주간"</button>
                        </div>
                    </div>
                    <Show when=move ||!week_mode.get() fallback=move ||view!{
                        <div class="week-grid" role="table" aria-label="월요일부터 금요일 주간 시간표">
                            <div class="week-grid-row week-grid-header" role="row">
                                <span class="week-period-title" role="columnheader">"교시"</span>
                                {move || (0..5).map(|offset|{
                                    let day=monday(selected())+Duration::days(offset);
                                    view!{
                                        <button type="button" role="columnheader"
                                            class:today=move ||date.get()==day
                                            aria-pressed=move ||date.get()==day
                                            on:click=move |_|date.set(day)>
                                            <span>{day_letter(day)}</span>
                                            <strong>{format!("{:02}",day.day())}</strong>
                                        </button>
                                    }
                                }).collect_view()}
                            </div>
                            {move ||{
                                let first=monday(date.get());
                                let rows=data.get().map(|d|d.timetable).unwrap_or_default();
                                let max_period=rows.iter().filter(|item|{
                                    NaiveDate::parse_from_str(&item.date,"%Y%m%d").ok()
                                        .map(|d|monday(d)==first).unwrap_or(false)
                                }).map(|item|item.period).max().unwrap_or(7).clamp(7,9);
                                (1u8..=max_period).map(|period|{
                                    let cells=(0..5).map(|offset|{
                                        let day=first+Duration::days(offset);
                                        let subject=rows.iter()
                                            .find(|item|item.date==ymd(day)&&item.period==period)
                                            .map(|item|item.subject.clone()).unwrap_or_default();
                                        let empty=subject.is_empty();
                                        let description=if empty {"수업 없음".to_owned()}else{subject.clone()};
                                        view!{
                                            <button type="button" class="week-cell"
                                                class:today=move ||date.get()==day
                                                class:empty=empty
                                                aria-label=format!("{}요일 {}교시 {}",day_letter(day),period,description)
                                                on:click=move |_|date.set(day)>
                                                <span>{if empty {"—".to_owned()}else{subject}}</span>
                                            </button>
                                        }
                                    }).collect_view();
                                    view!{
                                        <div class="week-grid-row" role="row">
                                            <span class="week-period" role="rowheader">{format!("{:02}",period)}</span>
                                            {cells}
                                        </div>
                                    }
                                }).collect_view()
                            }}
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
                        <div class="transit-actions">
                            <button type="button" class="transit-link"
                                on:click=move |_|switch_section(Tab::School,tab,page_motion,direction)>
                                "버스 도착정보"
                            </button>
                            <a class="transit-legacy" href="/transit">"기존 교통 화면"</a>
                        </div>
                        <p class="transit-caution">"정류장을 검색하면 Flow에서 바로 운행정보를 확인할 수 있어요."</p>
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
    let month_touch=RwSignal::<Option<(i32,i32)>>::new(None);
    let month_drag=RwSignal::new(0.0f64);
    let month_direction=RwSignal::new(1i32);
    let month_recent=RwSignal::new(0.0f64);
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
                <div class="month-actions">
                    <button type="button" class="month-chevron" aria-label="이전 달"
                        on:click=move |_|change_month(date,-1)>"←"</button>
                    <Show when=move ||{
                        let today=today_local();
                        date.get().month()!=today.month()||date.get().year()!=today.year()
                    }>
                        <button type="button" class="month-reset"
                            on:click=move |_|date.set(today_local())>"이번 달"</button>
                    </Show>
                    <button type="button" class="month-chevron" aria-label="다음 달"
                        on:click=move |_|change_month(date,1)>"→"</button>
                </div>
            </div>
            <Show when=move ||!error.get().is_empty()>
                <p class="api-error" role="alert">{move ||error.get()}</p>
            </Show>
            <div class="calendar-layout">
                <section class="calendar-sheet"
                    style=move ||format!("--month-drag:{:.1}px;--month-dir:{}",month_drag.get(),month_direction.get())
                    on:touchstart=move |ev|{
                        month_touch.set(touch_start(&ev));month_drag.set(0.);
                    }
                    on:touchmove=move |ev|{
                        if let (Some((sx,sy)),Some(p))=(month_touch.get_untracked(),ev.touches().item(0)){
                            let dx=p.client_x()-sx;let dy=p.client_y()-sy;
                            if dx.abs()>8 && dx.abs()*100>dy.abs()*160 {
                                month_drag.set((dx as f64*0.33).clamp(-52.,52.));
                            }
                        }
                    }
                    on:touchend=move |ev|{
                        if let (Some((sx,sy)),Some((ex,ey)))=(month_touch.get_untracked(),touch_end(&ev)){
                            let dx=ex-sx;let dy=ey-sy;
                            if dx.abs()>=56 && dx.abs()*100>dy.abs()*135{
                                let step=if dx<0{1}else{-1};
                                month_direction.set(step);
                                month_recent.set(js_sys::Date::now());
                                change_month(date,step);
                            }
                        }
                        month_touch.set(None);month_drag.set(0.);
                    }
                    on:touchcancel=move |_|{month_touch.set(None);month_drag.set(0.);}>
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
                                        on:click=move |_|{
                                            if js_sys::Date::now()-month_recent.get_untracked()<520.{return;}
                                            date.set(day);
                                        }>
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
            <div class="scene-head"><div><span class="eyebrow">"학교와 통학"</span>
                <h1>"학교"</h1></div>
</div>
            <BusInfo/>
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
                <div class="setting-row"><div><strong>"전체 기능"</strong><small>"시간표 수정·교내 정보 등 기존 기능을 계속 사용할 수 있습니다."</small></div>
                    <a href="/legacy" class="setting-toggle">"기존 Flow ↗"</a></div>
                <div class="setting-row"><div><strong>"버스 정보"</strong>
                    <small>"학교 탭에서 정류장을 검색하고 운행 상태를 직접 확인할 수 있어요."</small></div></div>
                <div class="setting-row"><div><strong>"대학교 모드"</strong><small>"기존 대학 기능은 같은 주소에서 이용 가능합니다."</small></div>
                    <a href="/university" class="setting-toggle">"대학교 모드 ↗"</a></div>
            </section>
            <p class="note">"이전 화면은 ‘이전 버전’ 메뉴에서 열 수 있습니다. 일부 기능은 아직 기존 화면에서 제공합니다."</p>
        </div>
    }
}

fn main() {
    leptos::mount::mount_to_body(App);
}
