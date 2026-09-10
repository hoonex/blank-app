window.FLOW_ADMIN_RELEASES=[
  {
    version:'2026.09.10.next',status:'candidate',date:'2026-09-10',title:'Admin release history + interactive UI map',summary:'관리자 화면에서 버전별 패치노트와 Flow 전체 UI/UX 구조를 한눈에 보고 확대·축소·이동·필터링할 수 있는 후보 릴리즈입니다.',
    pullRequest:238,commit:null,tags:['Admin','Release notes','Wireframe','UI/UX','Candidate'],
    changes:[
      {type:'improve',area:'Admin',title:'Versioned patch notes',detail:'Production/Candidate 상태, 검색, 필터, 버전별 변경사항과 관련 화면을 한 화면에서 확인할 수 있습니다.'},
      {type:'improve',area:'Wireframes',title:'Zoomable UI/UX map',detail:'School, University, Admin, Platform 노드를 휠 줌, +/- 줌, 드래그 pan, Fit, Reset, fullscreen, minimap으로 탐색합니다.'},
      {type:'improve',area:'Wireframes',title:'Release-linked highlighting',detail:'버전을 선택하면 해당 릴리즈에서 변경된 화면 노드가 강조되고 inspector에서 관련 릴리즈와 화면 정보를 확인할 수 있습니다.'},
      {type:'test',area:'Audit',title:'Desktop interaction coverage',detail:'1440×900에서 릴리즈 렌더, 버전 강조, inspector, zoom, pan, Fit, overflow를 Playwright로 검증합니다.'}
    ],
    screens:['admin-releases','admin-wireframes']
  },
  {
    version:'2026.09.10.2',status:'production',date:'2026-09-10',title:'Wide School Today density',summary:'Desktop Today의 중복 시험 deck을 제거하고 급식·시험 utility column을 실제 콘텐츠 높이에 맞춘 production 릴리즈입니다.',
    pullRequest:237,commit:'b1f01485130350a7c8b1e8c8309d6622a7855ce8',tags:['School','Desktop','UI/UX','Production'],
    changes:[
      {type:'fix',area:'Today',title:'Desktop 시험 UI 단일화',detail:'wide desktop에서는 v3 exam feed를 authoritative하게 사용하고 mobile/tablet v5 exam deck은 기존 touch UX로 유지합니다.'},
      {type:'fix',area:'Today',title:'Utility column intrinsic sizing',detail:'급식/시험 카드가 실제 콘텐츠 높이에 맞게 수축되어 giant dead space가 사라졌습니다.'},
      {type:'test',area:'Audit',title:'Vertical density + mobile preservation gates',detail:'wide-touch, 1366, 1920 vertical density와 phone/tablet v5 exam deck 보존을 함께 검증합니다.'}
    ],
    screens:['school-today-desktop','school-today-tablet']
  },
  {
    version:'2026.09.10.1',status:'production',date:'2026-09-10',title:'School information + Transit desktop workspace',summary:'School 정보 카드의 orphan row를 정리하고 Transit 초기 화면을 desktop workspace에 맞게 재구성한 릴리즈입니다.',
    pullRequest:236,commit:'0950f3a42afa3f363dc55f61ad770948d3185fe4',tags:['School','Transit','Desktop','Production'],
    changes:[
      {type:'fix',area:'School info',title:'13-field profile row 정리',detail:'마지막 계열 카드가 혼자 떨어지지 않도록 desktop profile grid의 마지막 5개 필드를 한 행으로 정렬했습니다.'},
      {type:'improve',area:'Transit',title:'Desktop 2-column initial workspace',detail:'왼쪽 경로 입력은 compact하게 유지하고 오른쪽 route preview가 넓은 화면을 활용하도록 구성했습니다.'},
      {type:'fix',area:'Navigation',title:'Hidden view leakage 차단',detail:'Transit의 display rule이 다른 destination의 hidden state를 깨지 않도록 :not(.hidden) contract를 적용했습니다.'},
      {type:'test',area:'Audit',title:'School/Transit 1366·1920 visual coverage',detail:'School info와 Transit의 desktop screenshot/geometry를 Browser UX audit에 포함했습니다.'}
    ],
    screens:['school-info-desktop','school-transit-desktop']
  },
  {
    version:'2026.09.09.2',status:'production',date:'2026-09-09',title:'School persistent desktop workspace',summary:'School을 확대된 모바일 화면이 아닌 실제 desktop workspace로 재구성한 릴리즈입니다.',
    pullRequest:235,commit:'f510c3f6f692e42fef44be9a59a836812d53df04',tags:['School','Desktop','IA','Production'],
    changes:[
      {type:'improve',area:'Shell',title:'Persistent desktop rail',detail:'Today, Week, Schedule, School, Settings를 desktop left rail에서 직접 전환하도록 구성했습니다.'},
      {type:'improve',area:'Today',title:'Two-column workspace',detail:'시간표와 급식/시험 utility column을 desktop 정보 밀도에 맞게 분리했습니다.'},
      {type:'fix',area:'Navigation',title:'Desktop Today/Week semantics',detail:'중복 segmented control을 제거하고 persistent rail의 Today와 Week를 독립 destination으로 정리했습니다.'},
      {type:'fix',area:'Responsive',title:'Phone vs desktop content ratio 정리',detail:'portrait tablet의 touch-first 예외를 유지하면서 non-mobile content ratio를 desktop 기준으로 통일했습니다.'}
    ],
    screens:['school-today-desktop','school-week-desktop','school-schedule-desktop','school-settings-desktop']
  }
];

window.FLOW_ADMIN_UI_MAP={
  width:2460,height:1500,
  nodes:[
    {id:'school-today-desktop',group:'School',platform:['desktop'],title:'School · Today',subtitle:'persistent rail · timetable · meal · exams',x:80,y:90,w:300,h:176,releases:['2026.09.09.2','2026.09.10.2']},
    {id:'school-week-desktop',group:'School',platform:['desktop'],title:'School · Week',subtitle:'full weekly timetable workspace',x:400,y:90,w:300,h:176,releases:['2026.09.09.2']},
    {id:'school-schedule-desktop',group:'School',platform:['desktop','tablet'],title:'School · Schedule',subtitle:'calendar + selected-day events',x:720,y:90,w:300,h:176,releases:['2026.09.09.2']},
    {id:'school-transit-desktop',group:'School',platform:['desktop'],title:'School · Transit',subtitle:'route input + preview workspace',x:1040,y:90,w:300,h:176,releases:['2026.09.10.1']},
    {id:'school-info-desktop',group:'School',platform:['desktop','tablet'],title:'School · Information',subtitle:'hero + 13-field profile grid',x:1360,y:90,w:300,h:176,releases:['2026.09.10.1']},
    {id:'school-settings-desktop',group:'School',platform:['desktop','tablet','mobile'],title:'School · Settings',subtitle:'theme · bell · meal · install',x:1680,y:90,w:300,h:176,releases:['2026.09.09.2']},

    {id:'school-today-mobile',group:'School',platform:['mobile'],title:'School · Today Mobile',subtitle:'date rail · bottom nav · touch controls',x:80,y:330,w:300,h:176,releases:[]},
    {id:'school-today-tablet',group:'School',platform:['tablet'],title:'School · Today Tablet',subtitle:'touch-first shell · wide layout exception',x:400,y:330,w:300,h:176,releases:['2026.09.10.2']},
    {id:'university-home',group:'University',platform:['desktop','tablet','mobile'],title:'University · Home',subtitle:'landing · search · saved university',x:720,y:330,w:300,h:176,releases:[]},
    {id:'university-dashboard',group:'University',platform:['desktop','tablet','mobile'],title:'University · Dashboard',subtitle:'today · timetable · widgets',x:1040,y:330,w:300,h:176,releases:[]},
    {id:'university-campus',group:'University',platform:['desktop','tablet','mobile'],title:'University · Campus',subtitle:'campus map · route editor',x:1360,y:330,w:300,h:176,releases:[]},

    {id:'admin-overview',group:'Admin',platform:['desktop','tablet','mobile'],title:'Admin · Overview',subtitle:'operations · health · integrations',x:400,y:580,w:300,h:176,releases:[]},
    {id:'admin-releases',group:'Admin',platform:['desktop','tablet','mobile'],title:'Admin · Releases',subtitle:'version history · filters · linked screens',x:720,y:580,w:300,h:176,releases:['2026.09.10.next']},
    {id:'admin-wireframes',group:'Admin',platform:['desktop','tablet','mobile'],title:'Admin · Wireframes',subtitle:'zoom · pan · fit · minimap · inspector',x:1040,y:580,w:300,h:176,releases:['2026.09.10.next']},

    {id:'flow-edge',group:'Platform',platform:['system'],title:'Flow Edge',subtitle:'school-data · university-data · flow-admin',x:400,y:830,w:300,h:176,releases:[]},
    {id:'supabase',group:'Platform',platform:['system'],title:'Supabase',subtitle:'Auth · Postgres · Edge Functions',x:720,y:830,w:300,h:176,releases:[]},
    {id:'cloudflare',group:'Platform',platform:['system'],title:'Cloudflare',subtitle:'static routes · worker · production probes',x:1040,y:830,w:300,h:176,releases:[]}
  ],
  edges:[
    {source:'school-today-desktop',target:'school-week-desktop',label:'Week'},
    {source:'school-week-desktop',target:'school-schedule-desktop',label:'Schedule'},
    {source:'school-schedule-desktop',target:'school-transit-desktop',label:'Transit'},
    {source:'school-transit-desktop',target:'school-info-desktop',label:'School'},
    {source:'school-info-desktop',target:'school-settings-desktop',label:'Settings'},
    {source:'school-today-mobile',target:'school-today-tablet',label:'responsive'},
    {source:'school-today-tablet',target:'school-today-desktop',label:'desktop ratio'},
    {source:'university-home',target:'university-dashboard',label:'select university'},
    {source:'university-dashboard',target:'university-campus',label:'Campus'},
    {source:'admin-overview',target:'admin-releases',label:'Releases'},
    {source:'admin-releases',target:'admin-wireframes',label:'highlight map'},
    {source:'school-today-desktop',target:'flow-edge',label:'school-data'},
    {source:'university-dashboard',target:'flow-edge',label:'university-data'},
    {source:'admin-overview',target:'flow-edge',label:'flow-admin'},
    {source:'flow-edge',target:'supabase',label:'runtime'},
    {source:'supabase',target:'cloudflare',label:'deploy / observe'}
  ]
};
