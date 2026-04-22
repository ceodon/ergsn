# ERGSN 파트너 애널리틱스 대시보드 — 운영자 가이드

> 본 문서는 ERGSN 내부 운영자용입니다. 파트너에게 직접 공유하지 마세요.
> 최종 갱신: 2026-04-23 · 대상 범위: Phase 0 (token-URL 인증)

---

## 전체 흐름 한눈에

```
[1] 파트너가 Verified 결제              ERGSN (운영자)
     ↓                                    ↓
[2] 파트너 기본정보 수집  ←─────────── 파트너와 상담
     ↓
[3] curl 1번으로 파트너 등록
     ↓
[4] 응답으로 dashboard_url 받음
     ↓
[5] 파트너에게 카톡/텔레그램으로 URL 전달
     ↓
[6] 파트너는 URL 북마크 → 아무때나 접속
```

---

## 준비 (딱 한번)

### ADMIN_KEY 확인

대시보드를 관리할 때 쓰는 비밀번호입니다. 한 번만 꺼내서 안전한 곳(1Password, 메모장 등)에 저장하세요.

1. [Cloudflare Dashboard](https://dash.cloudflare.com) 로그인
2. **Workers & Pages** → **ergsn-rfq-tracker** 클릭
3. **Settings** → **Variables and Secrets**
4. `ADMIN_KEY` 항목의 값을 복사

> ⚠️ 이 키가 유출되면 누구나 파트너를 등록/삭제할 수 있습니다. Git/이메일/슬랙 등에 **절대 붙여넣지 마세요**.

---

## 파트너 1명 등록하기 (반복 작업)

### Step 1. 파트너에게 물어볼 정보

결제 완료된 Verified 파트너에게 아래 4가지를 확인하세요:

| 항목 | 예시 | 설명 |
|---|---|---|
| 회사명 | `태흥시큐리티(주)` | 대시보드 상단에 표시됨 |
| 섹터 | `K-Security` | 벤치마크 비교 그룹 |
| 등록 제품 | `DL-10X, DL-12X, DL-16X` | **반드시 `index.html` 의 `MODEL_LABELS` 값 그대로** |
| 파트너 ID | `P-001` | 내부 관리용 (본인이 정함, 중복 불가) |

### Step 2. curl 명령 한 줄로 등록

터미널(Git Bash / WSL / Mac Terminal 등) 어디서든 OK:

```bash
curl -X POST https://ergsn-rfq-tracker.ceodon.workers.dev/partner/create \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: 여기에_ADMIN_KEY_붙여넣기" \
  -d '{
    "id": "P-001",
    "company_name": "태흥시큐리티(주)",
    "tier": "verified",
    "sector": "K-Security",
    "product_ids": ["DL-10X","DL-12X","DL-16X"]
  }'
```

### Step 3. 응답 받기

성공하면 이런 JSON 이 떨어집니다:

```json
{
  "ok": true,
  "id": "P-001",
  "access_token": "A9fK2mP8nQ4vR7xY3zL6wH1jB5sD8tE0",
  "dashboard_url": "https://ergsn.net/partner-dashboard.html?t=A9fK2mP8nQ4vR7xY3zL6wH1jB5sD8tE0"
}
```

### Step 4. 파트너에게 URL 전달

`dashboard_url` 만 복사해서 해당 파트너에게 **개별 메시지**로 보내세요:

> 카카오톡 채널 1:1 또는 텔레그램 DM 권장

보내는 문구 예시:

```
안녕하세요, [회사명] 님.
ERGSN Verified Partner 전용 실시간 대시보드 접근 URL 입니다:

https://ergsn.net/partner-dashboard.html?t=A9fK2mP8nQ4vR7xY3zL6wH1jB5sD8tE0

※ 이 URL 은 비밀번호와 동일하게 취급해주세요. 공개된 채널(오픈채팅방,
  공용 이메일 등)에 공유하시면 안 됩니다. 북마크해두시고 혼자만
  사용하시는 것을 권장드립니다.

※ 혹시라도 URL 이 유출된 것 같으면 바로 저희에게 알려주세요.
  즉시 새 URL 로 교체해드립니다.
```

---

## 파트너 입장 (파트너가 하는 일)

1. 받은 URL 을 브라우저 북마크
2. 언제든 접속 → 최근 30일 실시간 현황 표시:
   - **RFQ 건수** (전월 대비 증감)
   - **바이어 국가 분포**
   - **일자별 RFQ 차트**
   - **최근 RFQ 10건** (바이어 국가/회사명/상태)
   - **섹터 내 동종 파트너 수**

> 💡 파트너는 별도 로그인 필요 없음. URL 자체가 열쇠.

---

## 관리 작업

### 현재 등록된 파트너 목록 보기

```bash
curl https://ergsn-rfq-tracker.ceodon.workers.dev/partner/list \
  -H "X-Admin-Key: 여기에_ADMIN_KEY"
```

토큰은 응답에 포함되지 않습니다 (보안).

### URL 유출됐을 때 — 토큰 재발급

파트너가 "URL 이 공유채팅방에 실수로 올라갔어요" 같은 연락을 했다면:

```bash
curl -X POST https://ergsn-rfq-tracker.ceodon.workers.dev/partner/rotate \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: 여기에_ADMIN_KEY" \
  -d '{"id": "P-001"}'
```

→ 새 `dashboard_url` 이 응답에 옴. 파트너에게 새 URL 전달하면 끝.
→ 기존 URL 은 즉시 무효화되어 404 반환.

### 새 제품이 추가됐을 때

파트너의 제품 목록을 업데이트하려면 **토큰 재발급 API 를 다른 용도로 쓸 수는 없습니다** (현재는 토큰만 교체). 제품 목록 업데이트는 Cloudflare Dashboard 에서 D1 로 직접 UPDATE:

1. Dashboard → **D1** → `ergsn-rfq` → **Console** 탭
2. 쿼리:
   ```sql
   UPDATE partners
   SET product_ids = 'DL-10X,DL-12X,DL-16X,NEW-PRODUCT-ID'
   WHERE id = 'P-001';
   ```
3. **Execute**

> Phase 1 에서 이 작업도 API 로 자동화 예정.

### 파트너 삭제

```sql
-- D1 Console 에서 실행
DELETE FROM partners WHERE id = 'P-001';
```

기존 `dashboard_url` 은 즉시 404 반환.

---

## 자주 하게 될 실수 — 주의사항

| ❌ 실수 | ✅ 올바른 방법 |
|---|---|
| `product_ids` 에 소문자나 임의 문자열 넣기 | `index.html` 의 `MODEL_LABELS` 값 그대로 (예: `DL-10X` · `KT-3DAD`) |
| 여러 파트너에게 같은 `id` 재사용 | ID 는 고유해야 함 (`P-001` → `P-002` 순차) |
| 대시보드 URL 을 회사 공용 메신저에 공유 | 특정 담당자에게 1:1 전달 권장 |
| ADMIN_KEY 를 commit / 노션 / Slack 에 붙여넣기 | 1Password 등 암호 관리자에만 저장 |
| 파트너가 "로그인 비번 뭐예요?" 물어봄 | Phase 0 은 로그인 없음 — URL 자체가 접근 권한. "북마크만 하세요" 로 안내 |

---

## 테스트 계정 만들어보기

실제 파트너가 아직 없어도 본인 테스트 계정 하나 만들어서 동작 확인 가능:

```bash
# 생성
curl -X POST https://ergsn-rfq-tracker.ceodon.workers.dev/partner/create \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: <ADMIN_KEY>" \
  -d '{
    "id": "TEST-001",
    "company_name": "ERGSN Internal Test",
    "tier": "verified",
    "sector": "K-Security",
    "product_ids": ["DL-10X","DL-12X","DL-16X","DL-10XD","DL-12XD","DL-16XD"]
  }'
```

응답의 URL 로 접속하면 DL 시리즈로 들어온 모든 RFQ 가 집계되어 표시됩니다.

테스트 끝나면 D1 콘솔에서 삭제:

```sql
DELETE FROM partners WHERE id = 'TEST-001';
```

---

## 대시보드 URL 보안

Phase 0 는 **URL 자체가 비밀번호** 입니다. 유출 위험 요소 3가지:

1. **브라우저 히스토리** — 파트너 PC 를 다른 직원이 쓰면 보일 수 있음
   → 파트너에게 "시크릿 창에서 쓰거나 본인 전용 크롬 프로필 사용" 권장
2. **스크린샷/화면공유** — URL 표시줄이 캡처에 포함될 수 있음
   → 대시보드 본문만 캡처하도록 안내
3. **Referer 헤더** — 대시보드에서 다른 사이트 링크 클릭 시 전달됨
   → `<meta name="referrer" content="no-referrer">` 로 이미 차단

유출 의심되면 즉시 `/partner/rotate` 실행.

---

## Phase 1 / Phase 2 로드맵

### Phase 1 (파트너 ~20명 도달 시)
- `partner-login.html` 이메일 매직링크 로그인
- MailChannels (Cloudflare Worker 무료 메일 발송)
- 세션 쿠키 기반 인증 → URL 유출 리스크 해소
- 제품뷰 트래킹 (Plausible 커스텀 이벤트 또는 자체 카운터)
- 벤치마크 퍼센타일 계산 (섹터 내 동종 파트너 비교)

### Phase 2 (파트너 ~100명 또는 Featured 티어 론칭 시)
- Kakao OAuth 로그인 (한국 제조사용)
- Google OAuth 로그인 (글로벌 Featured 파트너용)
- 파트너 셀프서비스 온보딩 (`partners-kr.html` → 자동 승인)
- Featured 전용 기능: 바이어 국가 코호트 · 우선매칭 노출 로그

> 전환 트리거 상세는 `memory/project_partner_dashboard.md` 참고.

---

## 트러블슈팅

### "invalid token" 응답
- 토큰이 `/partner/rotate` 로 교체되었거나, 파트너가 `DELETE` 됨
- D1 Console 에서 `SELECT id, access_token FROM partners WHERE id='P-001'` 으로 확인

### "missing token" 응답
- URL 에 `?t=` 파라미터 누락. 파트너가 URL 을 잘못 복사한 경우

### "unauthorized" 응답
- `X-Admin-Key` 헤더 누락 또는 ADMIN_KEY 값 틀림
- Cloudflare Dashboard 에서 ADMIN_KEY 재확인

### 대시보드 열었는데 "tracking pending" 만 보임
- 파트너의 제품에 대한 RFQ 가 해당 기간(기본 30일) 내 0건
- `?range=365` 로 기간 확장해서 확인 가능
- `product_ids` CSV 가 실제 RFQ 에 들어온 `models[]` 값과 매칭 안 됨 (대소문자/표기 차이 확인)

### Worker 가 504/500 응답
- Cloudflare 장애 가능성 → [Cloudflare Status](https://www.cloudflarestatus.com/) 확인
- D1 바인딩 끊어짐 → Dashboard → Worker → Settings → Bindings 확인

---

## 관련 파일

- `cloudflare-worker-rfq.js` — Worker 소스 (Cloudflare Dashboard 수동 배포)
- `partner-dashboard.html` — 파트너 보는 페이지
- `memory/project_partner_dashboard.md` — Phase 1/2 로드맵 + 결정 사항
- `memory/reference_cloudflare_workers.md` — Worker 엔드포인트 레퍼런스
