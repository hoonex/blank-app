const STORAGE_KEY = 'flow-calendar-events-v1';

const state = {
  cursor: new Date(),
  selectedDate: new Date(),
  mode: 'month',
  filters: new Set(['school', 'personal', 'work']),
  events: loadEvents()
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const els = {
  monthTitle: $('#monthTitle'),
  todayLabel: $('#todayLabel'),
  selectedDateTitle: $('#selectedDateTitle'),
  calendarContainer: $('#calendarContainer'),
  agendaList: $('#agendaList'),
  monthlyCount: $('#monthlyCount'),
  dialog: $('#eventDialog'),
  form: $('#eventForm'),
  eventId: $('#eventId'),
  eventTitle: $('#eventTitle'),
  eventDate: $('#eventDate'),
  eventTime: $('#eventTime'),
  eventCategory: $('#eventCategory'),
  eventNotes: $('#eventNotes'),
  dialogTitle: $('#dialogTitle'),
  deleteEvent: $('#deleteEvent')
};

function loadEvents() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved)) return saved;
  } catch {}
  const today = toISODate(new Date());
  const tomorrow = toISODate(addDays(new Date(), 1));
  return [
    { id: crypto.randomUUID(), title: '오늘 할 일 정리', date: today, time: '19:30', category: 'personal', notes: '하루 일정과 우선순위를 간단히 정리합니다.' },
    { id: crypto.randomUUID(), title: '프로젝트 점검', date: tomorrow, time: '17:00', category: 'work', notes: '진행 상황 확인 및 다음 작업 정리' }
  ];
}

function saveEvents() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.events));
}

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseISODate(value) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function sameDate(a, b) {
  return toISODate(a) === toISODate(b);
}

function formatMonthTitle(date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function formatSelected(date) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }).format(date);
}

function categoryLabel(cat) {
  return { school: '학교', personal: '개인', work: '프로젝트' }[cat] || '기타';
}

function visibleEventsFor(date) {
  const key = toISODate(date);
  return state.events
    .filter(e => e.date === key && state.filters.has(e.category))
    .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
}

function render() {
  els.todayLabel.textContent = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date());
  els.monthTitle.textContent = state.mode === 'month' ? formatMonthTitle(state.cursor) : `${formatSelected(startOfWeek(state.cursor))} 주간`;
  els.selectedDateTitle.textContent = formatSelected(state.selectedDate);
  renderCalendar();
  renderAgenda();
  renderMonthlyCount();
}

function renderMonthlyCount() {
  const y = state.cursor.getFullYear();
  const m = state.cursor.getMonth();
  const count = state.events.filter(e => {
    const d = parseISODate(e.date);
    return d.getFullYear() === y && d.getMonth() === m && state.filters.has(e.category);
  }).length;
  els.monthlyCount.textContent = `${count} 일정`;
}

function renderCalendar() {
  if (state.mode === 'week') {
    renderWeek();
  } else {
    renderMonth();
  }
}

function renderMonth() {
  const first = new Date(state.cursor.getFullYear(), state.cursor.getMonth(), 1);
  const gridStart = addDays(first, -first.getDay());
  const weekdays = ['일','월','화','수','목','금','토'];

  els.calendarContainer.innerHTML = `
    <div class="calendar-weekdays">${weekdays.map(d => `<div>${d}</div>`).join('')}</div>
    <div class="month-grid" id="monthGrid"></div>
  `;

  const grid = $('#monthGrid');
  for (let i = 0; i < 42; i++) {
    const date = addDays(gridStart, i);
    const events = visibleEventsFor(date);
    const cell = document.createElement('div');
    cell.className = 'day-cell';
    if (date.getMonth() !== state.cursor.getMonth()) cell.classList.add('muted');
    if (sameDate(date, new Date())) cell.classList.add('today');
    if (sameDate(date, state.selectedDate)) cell.classList.add('selected');

    const shown = events.slice(0, 3);
    const extra = Math.max(events.length - shown.length, 0);
    cell.innerHTML = `
      <div class="day-number">${date.getDate()}</div>
      <div class="event-chips">
        ${shown.map(e => `<div class="event-chip ${e.category}" data-event-id="${e.id}">${escapeHtml(e.title)}</div>`).join('')}
        ${extra ? `<div class="more-chip">+${extra}개</div>` : ''}
      </div>
    `;

    cell.addEventListener('click', (ev) => {
      const eventId = ev.target?.dataset?.eventId;
      if (eventId) {
        ev.stopPropagation();
        openEdit(eventId);
        return;
      }
      state.selectedDate = date;
      if (date.getMonth() !== state.cursor.getMonth()) state.cursor = new Date(date.getFullYear(), date.getMonth(), 1);
      render();
    });
    grid.appendChild(cell);
  }
}

function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0,0,0,0);
  return addDays(d, -d.getDay());
}

function renderWeek() {
  const start = startOfWeek(state.cursor);
  const weekdays = ['일','월','화','수','목','금','토'];
  const grid = document.createElement('div');
  grid.className = 'week-grid';

  for (let i = 0; i < 7; i++) {
    const date = addDays(start, i);
    const events = visibleEventsFor(date);
    const col = document.createElement('div');
    col.className = 'week-day';
    if (sameDate(date, state.selectedDate)) col.classList.add('selected');
    col.innerHTML = `
      <div class="week-day-head">
        <div class="week-day-name">${weekdays[i]}</div>
        <div class="week-day-num">${date.getDate()}</div>
      </div>
      ${events.map(e => `<div class="week-event" data-event-id="${e.id}"><div class="t">${e.time || '시간 미정'}</div>${escapeHtml(e.title)}</div>`).join('')}
    `;
    col.addEventListener('click', (ev) => {
      const eventId = ev.target.closest('[data-event-id]')?.dataset.eventId;
      if (eventId) {
        openEdit(eventId);
        return;
      }
      state.selectedDate = date;
      render();
    });
    grid.appendChild(col);
  }

  els.calendarContainer.innerHTML = '';
  els.calendarContainer.appendChild(grid);
}

function renderAgenda() {
  const events = visibleEventsFor(state.selectedDate);
  if (!events.length) {
    const tpl = $('#agendaEmptyTemplate');
    els.agendaList.replaceChildren(tpl.content.cloneNode(true));
    return;
  }

  els.agendaList.innerHTML = events.map(e => `
    <article class="agenda-item" data-event-id="${e.id}">
      <div class="agenda-item-top">
        <div class="agenda-title">${escapeHtml(e.title)}</div>
        <div class="agenda-time">${e.time || '시간 미정'}</div>
      </div>
      ${e.notes ? `<div class="agenda-note">${escapeHtml(e.notes)}</div>` : ''}
      <div class="category-pill">${categoryLabel(e.category)}</div>
    </article>
  `).join('');

  $$('.agenda-item').forEach(item => item.addEventListener('click', () => openEdit(item.dataset.eventId)));
}

function escapeHtml(value='') {
  return value.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function openCreate(date = state.selectedDate) {
  els.form.reset();
  els.eventId.value = '';
  els.eventDate.value = toISODate(date);
  els.eventCategory.value = 'school';
  els.dialogTitle.textContent = '새 일정';
  els.deleteEvent.classList.add('hidden');
  els.dialog.showModal();
  setTimeout(() => els.eventTitle.focus(), 50);
}

function openEdit(id) {
  const event = state.events.find(e => e.id === id);
  if (!event) return;
  els.eventId.value = event.id;
  els.eventTitle.value = event.title;
  els.eventDate.value = event.date;
  els.eventTime.value = event.time || '';
  els.eventCategory.value = event.category;
  els.eventNotes.value = event.notes || '';
  els.dialogTitle.textContent = '일정 수정';
  els.deleteEvent.classList.remove('hidden');
  els.dialog.showModal();
}

els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const payload = {
    id: els.eventId.value || crypto.randomUUID(),
    title: els.eventTitle.value.trim(),
    date: els.eventDate.value,
    time: els.eventTime.value,
    category: els.eventCategory.value,
    notes: els.eventNotes.value.trim()
  };
  if (!payload.title || !payload.date) return;

  const idx = state.events.findIndex(ev => ev.id === payload.id);
  if (idx >= 0) state.events[idx] = payload;
  else state.events.push(payload);

  state.selectedDate = parseISODate(payload.date);
  state.cursor = new Date(state.selectedDate);
  saveEvents();
  els.dialog.close();
  render();
});

$('#closeDialog').addEventListener('click', () => els.dialog.close());
$('#cancelDialog').addEventListener('click', () => els.dialog.close());
els.deleteEvent.addEventListener('click', () => {
  const id = els.eventId.value;
  state.events = state.events.filter(e => e.id !== id);
  saveEvents();
  els.dialog.close();
  render();
});

['#openCreateDesktop','#openCreateMobileTop','#quickAdd','#floatingAdd'].forEach(sel => {
  $(sel)?.addEventListener('click', () => openCreate());
});

$('#goToday').addEventListener('click', () => {
  state.cursor = new Date();
  state.selectedDate = new Date();
  render();
});

$('#prevPeriod').addEventListener('click', () => {
  if (state.mode === 'month') state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth() - 1, 1);
  else state.cursor = addDays(state.cursor, -7);
  render();
});

$('#nextPeriod').addEventListener('click', () => {
  if (state.mode === 'month') state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth() + 1, 1);
  else state.cursor = addDays(state.cursor, 7);
  render();
});

$$('[data-calendar-mode]').forEach(btn => btn.addEventListener('click', () => {
  state.mode = btn.dataset.calendarMode;
  $$('[data-calendar-mode]').forEach(b => b.classList.toggle('active', b === btn));
  render();
}));

$$('.calendar-filter input').forEach(input => input.addEventListener('change', () => {
  if (input.checked) state.filters.add(input.dataset.category);
  else state.filters.delete(input.dataset.category);
  render();
}));

$$('.nav-item').forEach(btn => btn.addEventListener('click', () => {
  $$('.nav-item').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const view = btn.dataset.view;
  if (view === 'today') {
    state.cursor = new Date();
    state.selectedDate = new Date();
  } else if (view === 'upcoming') {
    const future = state.events
      .filter(e => parseISODate(e.date) >= new Date(new Date().setHours(0,0,0,0)))
      .sort((a,b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''))[0];
    if (future) {
      state.selectedDate = parseISODate(future.date);
      state.cursor = new Date(state.selectedDate);
    }
  }
  render();
}));

els.dialog.addEventListener('click', (e) => {
  const rect = els.dialog.getBoundingClientRect();
  const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
  if (!inside) els.dialog.close();
});

render();
