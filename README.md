# THE TABLE 🌍

**A classroom negotiation game about resources and energy.** Nine countries, six resources, ten rounds. Teams have to trade, in English, to keep their country fed, watered and powered while one crisis after another hits the world.

Made by a teacher for a high-school class on resources and energy, taught in English. Free to download and run in your own class.

---

## Why I made it

The class topic was resources and energy: why countries fight over them, and how people think about them. I could have told students what people think, shown a video, or handed out articles, but that wouldn't feel real to them, and **reading random articles was exactly what I wanted to avoid.**

I wanted students to **feel it on their skin**: live through it first, then look back at how they acted and what they valued. After that, the ideas we study in class (different ways of seeing international relations) are much easier to understand, because they've already seen them happen at their own table.

So instead of memorizing "this country has a large population", each team has to find more food, water and fuel every round just to survive.

## How it's played

- **Teams:** 9 countries (Ethiopia, Egypt, Laos, Thailand, Turkmenistan, Venezuela, Bolivia, Ukraine, Canada), usually 2 students per country (built for 17–18 students).
- **Resources:** oil, gas, critical minerals, water, food and power. Every country produces a different mix, and no one has everything they need. A gas-rich country with little food has to trade gas for food.
- **Each round (20 minutes, 10 rounds):**
  1. A **world event** appears on the projector: a Mekong drought, an oil route closed, food prices spiking, a global drought warning… Each crisis leads into the next.
  2. Teams **negotiate face to face, in English**, and record trades on their phones.
  3. Teams may use their country's **special move** or **reinvest** minerals and power to produce more next round.
  4. At the end of the round, each country needs enough **energy, water and food**: +3 points if it has them, −3 if not. The requirements rise as the game goes on.
- **Secret information:** each team sees only its own country card (its strengths, weaknesses and special move). Scores are public; how much others actually hold, you only learn by negotiating, just like real diplomacy.
- **Round 9, the climate pact:** every country secretly chooses to *comply* (give up this round's oil and gas) or *ignore*. If 6 or more comply, everyone gets +3, including those who ignored. If not, only the compliers lose. A designed free-rider dilemma.
- **Round 10:** the battery boom. Every critical mineral you hold is worth a point.
- **Afterwards:** a reflection on how each team acted (did you hoard? share? break promises?), which leads into the class's theory lessons.

Full rules: [`게임기획안_종합본.md`](게임기획안_종합본.md) (Korean) · Country cards: [`THE_TABLE_국가카드_영문.md`](THE_TABLE_국가카드_영문.md) · Events: [`THE_TABLE_이벤트_영문.md`](THE_TABLE_이벤트_영문.md)

**In our class:** teams hoarded after the first shocks, found loopholes, broke a promise or two, and the cheated countries teamed up against the leaders. Only 2 of 9 countries kept the climate pact. In the reflection, the 1st and the 7th place teams reached the same conclusion: there were enough resources for everyone, but they didn't share.

---

## Run it in your class

The game runs online on two free services, so you don't install anything on your computer: **[Vercel](https://vercel.com)** hosts the game, and **[Upstash](https://upstash.com)** saves the game state between rounds. Each teacher gets their **own** copy on their own free accounts. You'll need a free [GitHub](https://github.com) account too (Vercel signs in with it).

**1. Make your own copy.** Click this button, sign in with GitHub, and follow the steps:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FdevSeanYoo%2Fthe_table&project-name=the-table&env=ADMIN_PASSWORD&envDescription=The%20password%20for%20the%20teacher%27s%20admin%20page)

When it asks for `ADMIN_PASSWORD`, type the password you'll use to run the game. Then click **Deploy** and wait about a minute.

**2. Add the save storage.** In your new Vercel project: **Storage** → **Upstash for Redis** (free plan) → **Create** → connect it to this project. Then go to **Deployments**, click **⋯** on the top one → **Redeploy**, so the game picks up the storage.

**3. Play.** Your game lives at `https://<your-project>.vercel.app` (Vercel shows the address):

| Who | Page | What it's for |
|---|---|---|
| Teacher | `/admin` (your password) | Start rounds, show events, hand out team PINs, fix mistakes |
| Projector | `/dashboard` | Leaderboard, breaking news, round timer |
| Students | `/play` | Pick your country, enter the team PIN from the admin page, trade |

<details>
<summary>Problems?</summary>

- **The game forgets everything / errors on every action:** the storage from step 2 isn't connected yet, or the project wasn't redeployed after connecting it.
- **Admin login says it's off:** `ADMIN_PASSWORD` is missing. Add it under the project's **Settings → Environment Variables**, then redeploy.
- **Something went wrong mid-game:** on the admin page, **Round Checkpoints** rewinds to the start of a round, and **Manual Override** fixes any number by hand.
- **New class, fresh game:** in **Round Checkpoints**, go back to Round 1, then give teams new PINs in **Team Access PINs**.
</details>

---

## For developers

- **Server** (`server/` + `api/`): Node.js, no framework; on Vercel, `api/` runs as serverless functions. The game rules are pure functions in `server/src/engine/`. Each request loads the state, applies it and saves it again; the timer stores an end time instead of ticking (`server/src/lazyTimer.js`). State goes to Upstash Redis (`UPSTASH_REDIS_REST_*` or Vercel's `KV_REST_API_*` variables), or to `server/data/save.json` when neither is set.
- **Client** (`client/`): React + Vite. Polls the server every 2 seconds.
- **Local development** (needs Node.js): `npm install`, `ADMIN_PASSWORD=… node server/dev-server.js` (API on port 4000; without a password it makes a random one and prints it), and in a second terminal `cd client && npm install && npm run dev` (port 5173).
- **Tests:** `node server/test/engine.test.mjs`: 29 engine tests (trades, passives, every special move, reinvestment, scoring, rounds 4/6/9/10, rewinds).
- **Spec:** [`THE_TABLE_개발스펙.md`](THE_TABLE_개발스펙.md) (Korean).

<details>
<summary>Engine decisions not in the spec (Korean)</summary>

- **자원 생산 시점**: 매 라운드 "Start Timer" 클릭 시, 그 라운드의 기본 생산량이 각국 보유량에 더해짐(라운드당 1회, 멱등).
- **라오스→태국 전력 자동이전**: 생산 직후 자동 처리. 라오스가 그 라운드에 "Emergency Release"를 쓰면 이전분을 되돌림.
- **에너지 소모 판정(트랙A)**: 원유를 먼저 소모하고 부족분을 가스로 채움.
- **투르크메니스탄 가스 해금**: 거래로 "받은" 광물 누적 3개 달성 시점 기준(자체 생산 광물 없음이라 자연히 거래 수령만 해당).
- **반응형 Special Move(이집트/태국/투르크메니스탄)**: 그 라운드 내에서만 유효, 라운드가 넘어가면 자동 소멸(거래 잠김과 함께). 투르크메니스탄의 "Block It"은 그 라운드에 발동된 아무 Special Move나 선택해 무효화 가능하도록 구현(스펙 5번 표의 "무효화할 상대 Special Move 선택" 문구를 넓게 해석).
- 스펙 7절에 명시된 대로, 자동 판정으로 커버되지 않는 예외 상황은 관리자 페이지의 **Manual Override**로 직접 보정하도록 설계함.
</details>
