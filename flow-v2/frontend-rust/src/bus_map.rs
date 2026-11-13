//! Kakao Maps JavaScript SDK bridge: initialized only when there are actual
//! BIS coordinates. The browser-visible key is reused from legacy Flow.
use wasm_bindgen::prelude::*;

#[wasm_bindgen(inline_js = r#"
const KAKAO_JS_KEY = "cc0aae65f94df3b64e5d231dd3a9963a";
let sdkPromise = null;
let renderSequence = 0;

function ensureKakaoMap() {
  if (globalThis.kakao?.maps?.Map) return Promise.resolve(true);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise(resolve => {
    let finished = false;
    const finish = ok => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      if (!ok) sdkPromise = null;
      resolve(ok);
    };
    const timeout = setTimeout(() => finish(false), 10000);
    const script = document.createElement("script");
    script.async = true;
    script.dataset.flowKakaoBusMap = "true";
    script.src = "https://dapi.kakao.com/v2/maps/sdk.js?appkey=" +
      encodeURIComponent(KAKO_JS_KEY_SAFE()) + "&autoload=false";
    script.addEventListener("load", () => {
      try {
        if (!globalThis.kakao?.maps?.load) return finish(false);
        globalThis.kakao.maps.load(() => finish(Boolean(globalThis.kakao?.maps?.Map)));
      } catch (_) { finish(false); }
    }, {once:true});
    script.addEventListener("error", () => finish(false), {once:true});
    document.head.append(script);
  });
  return sdkPromise;
}
function KAKO_JS_KEY_SAFE() { return KAKAO_JS_KEY; }

function setStatus(host, message, kind) {
  host.dataset.mapStatus = kind;
  const label = host.closest(".bus-map-wrap")?.querySelector(".bus-map-status");
  if (label) label.textContent = message;
}

export async function render_stop_map(raw, activeId) {
  const host = document.getElementById("flow-kakao-bus-map");
  const seq = ++renderSequence;
  if (!host || !host.isConnected) return;
  let rows = [];
  try { rows = JSON.parse(raw || "[]"); } catch (_) {}
  rows = (Array.isArray(rows) ? rows : []).filter(row =>
    Number.isFinite(row.lat) && Number.isFinite(row.lng) &&
    row.lat >= 35.4 && row.lat <= 36.5 &&
    row.lng >= 127.7 && row.lng <= 129.4);
  if (!rows.length) {
    if (host.__flowKakaoMarkers) {
      host.__flowKakaoMarkers.forEach(marker => marker.setMap(null));
      host.__flowKakaoMarkers = [];
    }
    setStatus(host, "좌표가 있는 정류장이 없어요. 다른 이름으로 검색해 주세요.", "empty");
    return;
  }
  setStatus(host, "정류장 위치 지도를 불러오는 중", "loading");
  const ready = await ensureKakaoMap();
  if (seq !== renderSequence || !host.isConnected) return;
  if (!ready) {
    setStatus(host, "카카오 지도를 불러오지 못했어요. 정류장 목록은 계속 이용할 수 있어요.", "error");
    return;
  }
  try {
    const k = globalThis.kakao.maps;
    const first = rows.find(row => row.id === activeId) || rows[0];
    const center = new k.LatLng(first.lat, first.lng);
    if (!host.__flowKakaoMap) {
      host.__flowKakaoMap = new k.Map(host, {center, level:4});
      host.__flowKakaoMarkers = [];
    }
    const map = host.__flowKakaoMap;
    host.__flowKakaoMarkers.forEach(marker => marker.setMap(null));
    const bounds = new k.LatLngBounds(), markers = [];
    rows.forEach(row => {
      const location = new k.LatLng(row.lat, row.lng);
      bounds.extend(location);
      const marker = new k.Marker({map, position:location, title: row.name + " · " + row.number});
      k.event.addListener(marker, "click", () => {
        const options = [...host.closest(".bus-panel").querySelectorAll("[data-bus-stop-id]")];
        const item = options.find(el => el.getAttribute("data-bus-stop-id") === row.id);
        if (item) item.click();
        else {
          const status = host.closest(".bus-map-wrap")?.querySelector(".bus-map-status");
          if (status) status.textContent = row.name + " · 정류장 " + row.number;
        }
      });
      markers.push(marker);
    });
    host.__flowKakaoMarkers = markers;
    if (rows.length === 1) {
      map.setCenter(center);
      map.setLevel(3);
    } else {
      map.setBounds(bounds, 28, 28, 28, 28);
    }
    setStatus(host, rows.length === 1 ?
      first.name + " · 정류장 위치" :
      rows.length + "개 정류장 위치 · 지도의 핀이나 아래 목록에서 선택",
      "ready");
    host.dataset.markerCount = String(rows.length);
    k.event.trigger(map, "resize");
  } catch (_) {
    setStatus(host, "지도 표시 중 오류가 발생했어요. 정류장 목록은 이용할 수 있어요.", "error");
  }
}
"#)]
extern "C" {
    pub fn render_stop_map(json: &str, active_id: &str);
}
