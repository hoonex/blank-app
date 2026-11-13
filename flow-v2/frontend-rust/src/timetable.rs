//! Local class timetable edits; NEIS source data remains recoverable.
use crate::{Dashboard, Lesson, Profile, ymd, stored, store};
use chrono::{NaiveDate,Datelike};
use leptos::prelude::*;
use serde::{Deserialize,Serialize};

pub const KEY: &str = "flow-school-timetable-overrides-v1";
#[derive(Clone,Debug,PartialEq,Serialize,Deserialize)]
pub struct TimetableOverride { key:String, subject:String }

fn identity(p:&Profile,day:NaiveDate,period:u8)->String{
    format!("{}|{}|{}|{}|{}|{}",p.school.office_code,p.school.school_code,
        p.grade,p.class_name,ymd(day),period)
}
pub fn initial()->Vec<TimetableOverride>{stored(KEY).unwrap_or_default()}
pub fn subject_at(data:Option<&Dashboard>,profile:Option<&Profile>,day:NaiveDate,
                  period:u8,edits:&[TimetableOverride])->String{
    let original=data.and_then(|d|d.timetable.iter().find(|l|
        l.date==ymd(day) && l.period==period))
        .map(|l|l.subject.clone()).unwrap_or_default();
    match profile{
        Some(p)=>edits.iter().find(|e|e.key==identity(p,day,period))
            .map(|e|e.subject.clone()).unwrap_or(original),
        None=>original
    }
}
pub fn day_lessons(data:Option<&Dashboard>,profile:Option<&Profile>,
                   day:NaiveDate,edits:&[TimetableOverride])->Vec<Lesson>{
    (1u8..=9).filter_map(|period|{
        let subject=subject_at(data,profile,day,period,edits);
        if subject.trim().is_empty(){None}else{
            Some(Lesson{date:ymd(day),period,subject})
        }
    }).collect()
}
fn change_entry(profile:&Profile,day:NaiveDate,period:u8,
                value:Option<String>,edits:RwSignal<Vec<TimetableOverride>>){
    let key=identity(profile,day,period);
    let mut updated=edits.get_untracked();
    updated.retain(|e|e.key!=key);
    if let Some(subject)=value{updated.push(TimetableOverride{key,subject})}
    store(KEY,&updated);
    edits.set(updated);
}
#[component]
pub fn TimetableEditor(data:RwSignal<Option<Dashboard>>,date:RwSignal<NaiveDate>,
                       profile:RwSignal<Option<Profile>>,
                       edits:RwSignal<Vec<TimetableOverride>>,
                       open:RwSignal<bool>)->impl IntoView{
    let period=RwSignal::new(1u8);
    let draft=RwSignal::new(String::new());
    let message=RwSignal::new(String::new());
    Effect::new(move |_|{
        let day=date.get();
        let chosen=period.get();
        let dashboard=data.get();
        let p=profile.get();
        let overrides=edits.get();
        draft.set(subject_at(dashboard.as_ref(),p.as_ref(),day,chosen,&overrides));
        message.set(String::new());
    });
    view!{
        <Show when=move ||open.get()>
            <section class="timetable-editor" aria-label="시간표 직접 수정">
                <div class="editor-top">
                    <div>
                        <span class="module-kicker">"내 시간표"</span>
                        <h3>"과목 수정"</h3>
                    </div>
                    <button type="button" class="editor-close" aria-label="시간표 수정 닫기"
                        on:click=move |_|open.set(false)>"닫기"</button>
                </div>
                <p class="editor-help">"공식 시간표는 그대로 두고 선택한 교시만 이 기기에 저장해요."</p>
                <div class="editor-periods" role="group" aria-label="수정할 교시">
                    {(1u8..=9).map(|p|view!{
                        <button type="button" class:active=move ||period.get()==p
                            aria-pressed=move ||period.get()==p
                            on:click=move |_|period.set(p)>{p.to_string()}</button>
                    }).collect_view()}
                </div>
                <label class="editor-label" for="subject-draft">
                    {move ||format!("{}월 {}일 · {}교시 과목명",
                        date.get().month(),date.get().day(),period.get())}
                </label>
                <input id="subject-draft" type="text" maxlength="48"
                    autocomplete="off" placeholder="과목명을 입력하세요"
                    prop:value=move ||draft.get()
                    on:input=move |ev|draft.set(event_target_value(&ev))/>
                <div class="editor-actions">
                    <button type="button" class="editor-save"
                        on:click=move |_|{
                            if let Some(p)=profile.get_untracked(){
                                let value=draft.get_untracked().trim().chars().take(48).collect::<String>();
                                change_entry(&p,date.get_untracked(),period.get_untracked(),Some(value),edits);
                                message.set("이 기기에 저장했어요.".into());
                            }
                        }>"저장"</button>
                    <button type="button" class="editor-reset"
                        on:click=move |_|{
                            if let Some(p)=profile.get_untracked(){
                                change_entry(&p,date.get_untracked(),period.get_untracked(),None,edits);
                                message.set("원래 시간표로 복원했어요.".into());
                            }
                        }>"원본 복원"</button>
                </div>
                <p class="editor-status" aria-live="polite">{move ||message.get()}</p>
            </section>
        </Show>
    }
}
