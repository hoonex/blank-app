use chrono::{Datelike, Duration, NaiveDate, Weekday};
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet, HashMap};
use worker::*;

const LEGACY_SCHOOL: &str =
    "https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/school-data";

fn field(v: &Value, key: &str) -> String {
    match v.get(key) {
        Some(Value::String(s)) => s.trim().to_owned(),
        Some(Value::Number(n)) => n.to_string(),
        _ => String::new(),
    }
}
fn required<'a>(m: &'a HashMap<String,String>, key: &str) -> Result<&'a str,String> {
    m.get(key).map(|s|s.as_str()).filter(|s|!s.is_empty())
        .ok_or_else(|| format!("Missing required parameter: {key}"))
}
fn date8(d: NaiveDate) -> String { d.format("%Y%m%d").to_string() }
fn map_school(row: &Value) -> Value {
    json!({
        "officeCode": field(row,"ATPT_OFCDC_SC_CODE"),
        "officeName": field(row,"ATPT_OFCDC_SC_NM"),
        "schoolCode": field(row,"SD_SCHUL_CODE"),
        "name": field(row,"SCHUL_NM"),
        "englishName": field(row,"ENG_SCHUL_NM"),
        "kind": field(row,"SCHUL_KND_SC_NM"),
        "location": field(row,"LCTN_SC_NM"),
        "jurisdiction": field(row,"JU_ORG_NM"),
        "type": field(row,"FOND_SC_NM"),
        "postalCode": field(row,"ORG_RDNZC"),
        "address": field(row,"ORG_RDNMA"),
        "addressDetail": field(row,"ORG_RDNDA"),
        "phone": field(row,"ORG_TELNO"),
        "fax": field(row,"ORG_FAXNO"),
        "homepage": field(row,"HMPG_ADRES"),
        "coed": field(row,"COEDU_SC_NM"),
        "highSchoolType": field(row,"HS_SC_NM"),
        "highSchoolTrack": field(row,"HS_GNRL_BUSNS_SC_NM"),
        "specialPurpose": field(row,"SPCLY_PURPS_HS_ORD_NM"),
        "admissionTerm": field(row,"ENE_BFE_SEHF_SC_NM"),
        "dayNight": field(row,"DGHT_SC_NM"),
        "founded": field(row,"FOND_YMD"),
        "anniversary": field(row,"FOAS_MEMRD"),
        "loadedAt": field(row,"LOAD_DTM"),
    })
}

async fn neis(env:&Env, endpoint:&str,params:&[(&str,&str)]) -> Result<Vec<Value>,String> {
    let secret=env.secret("NEIS_KEY")
        .map_err(|_|"NEIS_KEY is not configured on the preview Worker".to_owned())?;
    let mut url=url::Url::parse(&format!("https://open.neis.go.kr/hub/{endpoint}"))
        .map_err(|e|e.to_string())?;
    {
        let mut q=url.query_pairs_mut();
        q.append_pair("KEY", &secret.to_string())
            .append_pair("Type","json").append_pair("pIndex","1").append_pair("pSize","1000");
        for (k,v) in params {q.append_pair(k,v);}
    }
    let mut reply=Fetch::Url(url).send().await.map_err(|e|e.to_string())?;
    if reply.status_code() != 200 {return Err(format!("NEIS {endpoint} returned {}",reply.status_code()));}
    let raw:Value=reply.json().await.map_err(|e|e.to_string())?;
    if let Some(block)=raw.get(endpoint).and_then(|v|v.as_array()) {
        for fragment in block {
            if let Some(rows)=fragment.get("row").and_then(|v|v.as_array()) {
                return Ok(rows.clone());
            }
        }
    }
    // NEIS can legitimately return INFO-200 when no data exists.
    if let Some(result)=raw.get("RESULT") {
        let code=field(result,"CODE");
        if !code.is_empty() && code!="INFO-000" && code!="INFO-200" {
            return Err(format!("NEIS returned {code} for {endpoint}"));
        }
    }
    Ok(Vec::new())
}
async fn search(env:&Env,m:&HashMap<String,String>)->Result<Value,String>{
    let query=required(m,"q")?.trim();
    if query.chars().count()<2 {return Err("학교명을 2글자 이상 입력하세요.".into());}
    let mut candidates=BTreeMap::<String,Value>::new();
    let normalized=query.replace(' ',"");
    let mut variants=vec![query.to_owned(),normalized.clone()];
    for (suffix,full) in [("고","고등학교"),("중","중학교"),("초","초등학교")] {
        if normalized.ends_with(suffix) {
            variants.push(format!("{}{}",normalized.trim_end_matches(suffix),full));
        }
    }
    variants.dedup();
    for name in variants {
        let rows=neis(env,"schoolInfo",&[("SCHUL_NM",&name)]).await?;
        for school in rows {
            let key=field(&school,"SD_SCHUL_CODE");
            if !key.is_empty() {candidates.insert(key,school);}
        }
        if candidates.len()>=16 {break;}
    }
    let mut schools:Vec<_>=candidates.into_values().collect();
    schools.sort_by_key(|row| {
        let name=field(row,"SCHUL_NM").replace(' ',"");
        let rank=if name==normalized {0} else if name.starts_with(&normalized) {1}
           else if name.contains(&normalized) {2} else {3};
        (rank,name.len())
    });
    Ok(json!({"schools":schools.into_iter().take(16).map(|v|map_school(&v)).collect::<Vec<_>>()}))
}
async fn classes(env:&Env,m:&HashMap<String,String>)->Result<Value,String>{
    let office=required(m,"office")?;
    let school=required(m,"school")?;
    let grade=required(m,"grade")?;
    let rows=neis(env,"classInfo",&[
        ("ATPT_OFCDC_SC_CODE",office),("SD_SCHUL_CODE",school),("GRADE",grade)
    ]).await?;
    let classes=rows.iter().map(|row|field(row,"CLASS_NM"))
        .filter(|s|!s.is_empty()).collect::<BTreeSet<_>>();
    Ok(json!({"classes":classes.into_iter().collect::<Vec<_>>()}))
}
fn timetable_endpoint(kind:&str)->&'static str {
    if kind.contains("초등"){ "elsTimetable" }
    else if kind.contains("중학"){ "misTimetable" }
    else if kind.contains("특수"){ "spsTimetable" }
    else { "hisTimetable" }
}
fn schedule_event(row:&Value)->Value {
    json!({
        "date":field(row,"AA_YMD"),
        "name":field(row,"EVENT_NM"),
        "content":field(row,"EVENT_CNTNT"),
        "grade1":field(row,"ONE_GRADE_EVENT_YN"),
        "grade2":field(row,"TW_GRADE_EVENT_YN"),
        "grade3":field(row,"THREE_GRADE_EVENT_YN"),
        "grade4":field(row,"FR_GRADE_EVENT_YN"),
        "grade5":field(row,"FIV_GRADE_EVENT_YN"),
        "grade6":field(row,"SIX_GRADE_EVENT_YN"),
        "holidayType":field(row,"SBTR_DD_SC_NM"),
    })
}
async fn dashboard(env:&Env,m:&HashMap<String,String>)->Result<Value,String>{
    let office=required(m,"office")?;
    let school=required(m,"school")?;
    let grade=required(m,"grade")?;
    let class=required(m,"class")?;
    let kind=m.get("kind").map(|s|s.as_str()).unwrap_or("고등학교");
    // Date must be explicit. Silent guessing is inappropriate for data APIs.
    let day=NaiveDate::parse_from_str(required(m,"date")?,"%Y%m%d")
        .map_err(|_|"Invalid YYYYMMDD date".to_owned())?;
    let monday=day-Duration::days(day.weekday().num_days_from_monday() as i64);
    let friday=monday+Duration::days(4);
    let meal_start=monday-Duration::days(2);
    let meal_end=friday+Duration::days(9);
    let month_start=day.with_day(1).ok_or("Invalid month")?;
    let month_next=if day.month()==12 {
        NaiveDate::from_ymd_opt(day.year()+1,1,1).ok_or("Invalid year")?
    } else {
        NaiveDate::from_ymd_opt(day.year(),day.month()+1,1).ok_or("Invalid month")?
    };
    let month_end=month_next-Duration::days(1);
    let common=[("ATPT_OFCDC_SC_CODE",office),("SD_SCHUL_CODE",school)];
    let tt_from=date8(monday);let tt_to=date8(friday);
    let meal_from=date8(meal_start);let meal_to=date8(meal_end);
    let start=date8(month_start);let end=date8(month_end);
    // The futures in join! borrow their parameter arrays. Bind arrays first so
    // they outlive the asynchronous calls (E0716).
    let timetable_params=[
        ("ATPT_OFCDC_SC_CODE",office),("SD_SCHUL_CODE",school),
        ("GRADE",grade),("CLASS_NM",class),("TI_FROM_YMD",tt_from.as_str()),("TI_TO_YMD",tt_to.as_str())
    ];
    let meal_params=[
        ("ATPT_OFCDC_SC_CODE",office),("SD_SCHUL_CODE",school),
        ("MLSV_FROM_YMD",meal_from.as_str()),("MLSV_TO_YMD",meal_to.as_str())
    ];
    let schedule_params=[
        ("ATPT_OFCDC_SC_CODE",office),("SD_SCHUL_CODE",school),
        ("AA_FROM_YMD",start.as_str()),("AA_TO_YMD",end.as_str())
    ];
    let (s,t,me,ev)=futures::join!(
        neis(env,"schoolInfo",&common),
        neis(env,timetable_endpoint(kind),&timetable_params),
        neis(env,"mealServiceDietInfo",&meal_params),
        neis(env,"SchoolSchedule",&schedule_params)
    );
    let schools=s?;
    let timetable=t?;
    let meals=me?;
    let mut events=ev?;
    let mut schedule_mode="month";
    if events.is_empty() {
        if let Ok(all)=neis(env,"SchoolSchedule",&common).await {
            events=all.into_iter().filter(|r|field(r,"AA_YMD").starts_with(&start[..6])).collect();
            if !events.is_empty(){schedule_mode="all-fallback";}
        }
    }
    let list:Vec<_>=timetable.iter().map(|row|json!({
        "date":field(row,"ALL_TI_YMD"),
        "period":field(row,"PERIO").parse::<u8>().unwrap_or(0),
        "subject":field(row,"ITRT_CNTNT"),
        "grade":field(row,"GRADE"),
        "className":field(row,"CLASS_NM")
    })).collect();
    let food:Vec<_>=meals.iter().map(|row|{
        let dishes=field(row,"DDISH_NM");
        json!({
            "date":field(row,"MLSV_YMD"),
            "type":field(row,"MMEAL_SC_NM"),
            "dishes":dishes.split("<br/>").map(str::trim)
                .filter(|s|!s.is_empty()).collect::<Vec<_>>(),
            "calories":field(row,"CAL_INFO"),
            "nutrition":field(row,"NTR_INFO"),
            "origin":field(row,"ORPLC_INFO"),
            "people":field(row,"MLSV_FGR")
        })
    }).collect();
    let event_list=events.iter().map(schedule_event).collect::<Vec<_>>();
    Ok(json!({
        "school":schools.first().map(map_school),
        "selected":date8(day),"from":tt_from,"to":tt_to,
        "timetable":list,"meals":food,
        "events":event_list,"scheduleMeta":{"mode":schedule_mode,"count":events.len()}
    }))
}
async fn handle(env:&Env, req:&Request) -> Result<Value,String> {
    let url=req.url().map_err(|e|e.to_string())?;
    let params:HashMap<String,String>=url.query_pairs().map(|(k,v)|(k.to_string(),v.to_string())).collect();
    match params.get("action").map(|s|s.as_str()).unwrap_or("search") {
        "search" => search(env,&params).await,
        "classes" => classes(env,&params).await,
        "dashboard" => dashboard(env,&params).await,
        other=>Err(format!("Unknown action: {other}")),
    }
}
fn json_reply(body:&Value, status:u16) -> Result<Response> {
    let mut reply=Response::from_json(body)?.with_status(status);
    reply.headers_mut().set("Access-Control-Allow-Origin","*")?;
    reply.headers_mut().set("Access-Control-Allow-Methods","GET, OPTIONS")?;
    reply.headers_mut().set("Access-Control-Allow-Headers","content-type, apikey, authorization")?;
    reply.headers_mut().set("Cache-Control","public, max-age=120")?;
    Ok(reply)
}
#[event(fetch)]
async fn fetch(req: Request, env: Env, _ctx: Context) -> Result<Response> {
    if req.method()==Method::Options {
        return json_reply(&json!({"ok":true}),200);
    }
    if req.method()!=Method::Get {return json_reply(&json!({"error":"Method not allowed"}),405);}
    match req.path().as_str() {
        "/healthz"=>json_reply(&json!({"status":"ok","service":"flow-v2-rust-worker"}),200),
        "/api/v2/school"=>{
            let url=req.url()?;
            let action=url.query_pairs().find(|(k,_)| k=="action").map(|(_,v)|v.to_string()).unwrap_or("search".into());
            // The legacy media/places parser stays available only until equivalent
            // Rust implementations are verified. No credentials are sent to the browser.
            if action=="media" || action=="place" {
                let mut upstream=url::Url::parse(LEGACY_SCHOOL)?;
                upstream.set_query(url.query());
                let mut reply=Fetch::Url(upstream).send().await?;
                reply.headers_mut().set("Access-Control-Allow-Origin","*")?;
                return Ok(reply);
            }
            match handle(&env,&req).await {
                Ok(data)=>json_reply(&data,200),
                Err(message)=> {
                    let status=if message.contains("Missing required") || message.contains("Invalid")
                      || message.contains("Unknown action") {400} else {502};
                    json_reply(&json!({"error":message}),status)
                }
            }
        },
        _=>json_reply(&json!({"error":"Not found"}),404)
    }
}
