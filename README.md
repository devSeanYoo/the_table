# THE TABLE — Web App

`THE_TABLE_개발스펙.md`, `게임기획안_종합본.md`, `THE_TABLE_국가카드_영문.md`, `THE_TABLE_이벤트_영문.md` 네 파일의 스펙을 그대로 구현한 웹앱입니다.

- **서버** (`server/` + `api/`): Node.js. 게임 상태·규칙 엔진은 순수 함수(`server/src/engine/*`)로 작성되어 있고, 요청마다 상태를 불러와(로드) 처리한 뒤 다시 저장(세이브)하는 **서버리스** 구조입니다. 실시간 소켓 연결이 아니라, 클라이언트가 짧은 주기로 상태를 다시 요청(폴링)하는 방식입니다.
- **클라이언트** (`client/`): React + Vite. 세 가지 화면 — 관리자 / 공용 대시보드 / 개인 페이지. 2초마다 서버 상태를 폴링하고, 타이머는 서버가 보내주는 종료 시각(`endsAt`)을 기준으로 브라우저에서 부드럽게 카운트다운합니다.
- **저장소**: 배포 환경(Vercel)에서는 **Upstash Redis**에 저장합니다 — 서버리스 함수는 요청이 끝나면 메모리가 사라지므로, 로컬 파일에 의존하면 안 됩니다. 로컬 개발 중에는 Upstash 설정이 없으면 자동으로 `server/data/save.json` 파일에 저장합니다 (`server/src/persistence.js`).

누구나 내려받아 자기 수업에서 쓸 수 있습니다. 실행 방법은 세 가지입니다: **① 내 컴퓨터 한 대에서**, **② 교실 와이파이로 학생 기기 연결**, **③ 내 Vercel 계정에 올려 온라인으로**.

## ① 내 컴퓨터에서 실행하기

준비물: [Node.js](https://nodejs.org) LTS 버전 (설치 후 터미널에서 `node -v`로 확인).

```bash
# 1. 내려받기 (또는 GitHub의 Code → Download ZIP 후 압축 풀기)
git clone https://github.com/devSeanYoo/the_table.git
cd the_table

# 2. 설치 (처음 한 번만)
npm install
cd client && npm install && cd ..

# 3. API 서버 실행 (포트 4000)
node server/dev-server.js

# 4. 새 터미널에서 클라이언트 실행 (포트 5173)
cd client && npm run dev
```

브라우저에서 `http://localhost:5173` 접속.

- **관리자 비밀번호:** 기본값은 없습니다. `ADMIN_PASSWORD` 환경변수로 직접 정하거나(예: `ADMIN_PASSWORD=내비밀번호 node server/dev-server.js`), 정하지 않으면 서버가 실행할 때마다 임의의 비밀번호를 만들어 터미널에 보여줍니다.
- 라운드 타이머 기본 20분 (`TIMER_SECONDS` 환경변수로 테스트용 단축 가능, 예: `TIMER_SECONDS=30`)
- 국가별 접속 PIN은 관리자 페이지의 "Team Access PINs" 패널에서 확인·배포·재발급
- 진행 상황은 `server/data/save.json`에 저장됩니다 (재시작하면 이어짐).

## ② 교실 와이파이로 학생 기기 연결하기

인터넷 서비스 가입 없이 교사 노트북을 서버로 써서, 같은 와이파이의 학생 기기들이 접속하게 합니다:

1. 교사 노트북에서 ①의 3단계(API 서버)를 실행합니다.
2. 노트북의 로컬 IP 확인 (Windows: `ipconfig`, Mac: `ipconfig getifaddr en0`).
3. `client/.env` 파일 생성: `VITE_API_URL=http://<교사노트북IP>:4000`
4. 클라이언트를 `cd client && npm run dev -- --host`로 실행해 같은 와이파이의 다른 기기에서 접속 가능하게 합니다.
5. 학생들은 `http://<교사노트북IP>:5173/play` 로 접속, 팀 국가 선택.

노트북을 끄면 진행이 멈춥니다 (재시작하면 이어짐).

## ③ 내 Vercel 계정에 올려 온라인으로 쓰기 (선택)

학생들이 각자 인터넷으로 접속하게 하려면, 이 저장소를 **자기 GitHub로 Fork**한 뒤 자기 계정에 배포합니다:

1. **Upstash 계정 생성** ([upstash.com](https://upstash.com), 무료) → Redis 데이터베이스 하나 생성 (Region은 아무 곳이나, 무료 티어면 충분합니다). 생성 후 "REST API" 섹션에서 `UPSTASH_REDIS_REST_URL`과 `UPSTASH_REDIS_REST_TOKEN` 두 값을 복사해둡니다.
2. **Vercel 계정 생성** ([vercel.com](https://vercel.com), 무료) → GitHub 연동 후 Fork한 저장소를 Import 합니다.
3. Vercel 프로젝트의 **Settings → Environment Variables**에서 아래 세 개를 추가합니다:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `ADMIN_PASSWORD` (원하는 관리자 비밀번호. 설정하지 않으면 관리자 로그인이 꺼져 있습니다)
4. **Deploy** 클릭. 빌드 명령/출력 경로는 `vercel.json`에 이미 설정되어 있어 별도 설정이 필요 없습니다.
5. 배포가 끝나면 Vercel이 주는 자기 도메인(예: `<내프로젝트>.vercel.app`)으로 접속. `/admin`, `/dashboard`, `/play`가 모두 같은 도메인에서 동작합니다.

게임 진행 중 문제가 생기면, 관리자 페이지의 "Round Checkpoints"에서 라운드 시작 시점으로 되돌릴 수 있습니다.

## 화면 구조

| 경로 | 설명 |
|---|---|
| `/` | 홈 (역할 선택) |
| `/admin` | 관리자 (비밀번호 로그인) |
| `/dashboard` | 공용 대시보드 (프로젝터용) |
| `/play` → `/play/:COUNTRY` | 개인 페이지 (국가 선택, 비밀번호 없음) |

## 게임 엔진 설계 메모 (스펙에 명시되지 않아 구현 시 확정한 부분)

- **자원 생산 시점**: 매 라운드 "Start Timer" 클릭 시, 그 라운드의 기본 생산량이 각국 보유량에 더해짐(라운드당 1회, 멱등).
- **라오스→태국 전력 자동이전**: 생산 직후 자동 처리. 라오스가 그 라운드에 "Emergency Release"를 쓰면 이전분을 되돌림.
- **에너지 소모 판정(트랙A)**: 원유를 먼저 소모하고 부족분을 가스로 채움.
- **투르크메니스탄 가스 해금**: 거래로 "받은" 광물 누적 3개 달성 시점 기준(자체 생산 광물 없음이라 자연히 거래 수령만 해당).
- **반응형 Special Move(이집트/태국/투르크메니스탄)**: 그 라운드 내에서만 유효, 라운드가 넘어가면 자동 소멸(거래 잠김과 함께). 투르크메니스탄의 "Block It"은 그 라운드에 발동된 아무 Special Move나 선택해 무효화 가능하도록 구현(스펙 5번 표의 "무효화할 상대 Special Move 선택" 문구를 넓게 해석).
- 스펙 7절에 명시된 대로, 자동 판정으로 커버되지 않는 예외 상황은 관리자 페이지의 **Manual Override**로 직접 보정하도록 설계함.
- **서버리스 전환**: 라운드 타이머는 실시간 서버 tick 대신, 종료 시각(`endsAt`)을 저장해두고 각 요청마다 "이미 끝났는가"만 확인하는 지연 평가(lazy) 방식으로 처리(`server/src/lazyTimer.js`). 클라이언트는 `endsAt`을 기준으로 로컬에서 카운트다운을 그려 폴링 사이에도 매끄럽게 보이도록 함.

## 테스트

`server/test/engine.test.mjs`에 게임 로직 유닛 테스트 28개 포함 (거래 규칙, 패시브, 모든 Special Move, 재투자, 트랙A 채점, 라운드 4/6/9/10 특수 처리, 되돌리기 기능 등). 실행:

```bash
node server/test/engine.test.mjs
```

브라우저로 전체 흐름(관리자 로그인 → 라운드 진행 → 국가 페이지 거래 → 대시보드 확인 → 체크포인트 복원)을 서버리스 API(로컬 파일 백엔드) 기준으로 직접 확인 완료. 최종 구현 상세(정보 은닉 정책, 라운드 9·10 흐름 변경 등)는 `THE_TABLE_개발스펙.md` 참고.
