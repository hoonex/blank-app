window.FLOW_ADMIN_RELEASES=[
  {
    version:'2026.09.10.next',status:'candidate',date:'2026-09-10',title:'Wide School Today density',summary:'Desktop Today에서 중복 시험 deck과 과도한 utility card 높이를 제거하고 실제 콘텐츠 높이에 맞춘 후보 릴리즈입니다.',
    pullRequest:237,commit:null,tags:['School','Desktop','UI/UX','Candidate'],
    changes:[
      {type:'fix',area:'Today',title:'Desktop 시험 UI 단일화',detail:'모바일 v5 exam deck과 desktop v3 exam feed가 동시에 렌더되는 경로를 제거합니다.'},
      {type:'fix',area:'Today',title:'Utility column intrinsic sizing',detail:'급식/시험 카드를 실제 콘텐츠 높이에 맞춰 giant dead space를 제거합니다.'},
      {type:'test',area:'Audit',title:'Vertical density gate',detail:'wide-touch, 1366, 1920에서 실제 exam content bottom과 card bottom의 차이를 검증합니다.'}
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
    {id:'school-today-desktop',group:'School',platform:['desktop'],title:'School · Today',subtitle:'persistent rail · timetable · meal · exams',x:120,y:130,w:300,h:176,releases:['2026.09.09.2','2026.09.10.next']},
    {id:'school-week-desktop',group:'School',platform:['desktop'],title:'School · Week',subtitle:'full weekly timetable workspace',x:500,y:130,w:300,h:176,releases:['2026.09.09.2']},
    {id:'school-schedule-desktop',group:'School',platform:['desktop','tablet'],title:'School · Schedule',subtitle:'calendar + selected-day events',x:880,y:130,w:300,h:176,releases:['2026.09.09.2']},
    {id:'school-transit-desktop',group:'School',platform:['desktop'],title:'School · Transit',subtitle:'route input + preview workspace',x:1260,y:130,w:300,h:176,releases:['2026.09.10.1']},
    {id:'school-info-desktop',group:'School',platform:['desktop','tablet'],title:'School · Information',subtitle:'hero + 13-field profile grid',x:1640,y:130,w:300,h:176,releases:['2026.09.10.1']},
    {id:'school-settings-desktop',group:'School',platform:['desktop','tablet','mobile'],title:'School · Settings',subtitle:'theme · bell · meal · install',x:2020,y:130,w:300,h:176,releases:['2026.09.09.2']},

    {id:'school-today-mobile',group:'School',platform:['mobile'],title:'School · Today Mobile',subtitle:'date rail · bottom nav · touch controls',x:120,y:430,w:300,h:176,releases:[]},
    {id:'school-today-tablet',group:'School',platform:['tablet'],title:'School · Today Tablet',subtitle:'touch-first shell · wide layout exception',x:500,y:430,w:300,h:176,releases:['2026.09.10.next']},
    {id:'university-home',group:'University',platform:['desktop','tablet','mobile'],title:'University · Home',subtitle:'landing · search · saved university',x:880,y:430,w:300,h:176,releases:[]},
    {id:'university-dashboard',group:'University',platform:['desktop','tablet','mobile'],title:'University · Dashboard',subtitle:'today · timetable · widgets',x:1260,y:430,w:300,h:176,releases:[]},
    {id:'university-campus',group:'University',platform:['desktop','tablet','mobile'],title:'University · Campus',subtitle:'campus map · route editor',x:1640,y:430,w:300,h:176,releases:[]},

    {id:'admin-overview',group:'Admin',platform:['desktop','tablet','mobile'],title:'Admin · Overview',subtitle:'operations · health · integrations',x:500,y:820,w:300,h:176,releases:[]},
    {id:'admin-releases',group:'Admin',platform:['desktop','tablet','mobile'],title:'Admin · Releases',subtitle:'version history · filters · linked screens',x:1000,y:820,w:300,h:176,releases:['2026.09.10.next']},
    {id:'admin-wireframes',group:'Admin',platform:['desktop','tablet','mobile'],title:'Admin · Wireframes',subtitle:'zoom · pan · fit · minimap · inspector',x:1500,y:820,w:300,h:176,releases:['2026.09.10.next']},

    {id:'flow-edge',group:'Platform',platform:['system'],title:'Flow Edge',subtitle:'school-data · university-data · flow-admin',x:650,y:1180,w:300,h:176,releases:[]},
    {id:'supabase',group:'Platform',platform:['system'],title:'Supabase',subtitle:'Auth · Postgres · Edge Functions',x:1080,y:1180,w:300,h:176,releases:[]},
    {id:'cloudflare',group:'Platform',platform:['system'],title:'Cloudflare',subtitle:'static routes · worker · production probes',x:1510,y:1180,w:300,h:176,releases:[]}
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
