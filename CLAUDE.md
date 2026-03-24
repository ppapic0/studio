# 스터디센터 웹앱 — 프로젝트 규칙

## ⛔ 절대 규칙 (위반 금지)

- `handleStudyStartStop`의 `disabled={isProcessingAction}`과 `onClick` 연결 절대 변경 금지
- 탭 `value` 문자열(`home` / `studyDetail` / `data` / `communication` / `billing`) 변경 금지 — URL sync + Firebase 로그와 연동됨
- `isMobile`은 `useAppContext()`에서 가져온 AppContext 값 사용 — CSS `sm:` 브레이크포인트로 대체 불가
- Firestore 구독에 전달하는 배열/객체는 반드시 `useMemo`로 안정화 — 매 렌더마다 새 참조 생성 시 INTERNAL ASSERTION FAILED 발생

---

## 기술 스택

- **Framework**: Next.js 15 App Router (`'use client'` 컴포넌트)
- **Database**: Firebase Firestore (realtime subscriptions via `useDoc` / `useCollection` / `useMemoFirebase`)
- **Auth**: Firebase Auth (`useUser()`)
- **UI**: shadcn/ui (Radix UI) + Tailwind CSS + `cn()` 유틸
- **Charts**: Recharts (`ResponsiveContainer`, `LineChart`, `BarChart`)
- **Icons**: lucide-react
- **AI**: Genkit (`@genkit-ai/google-genai`)
- **결제**: TossPayments SDK
- **Functions**: Firebase Cloud Functions (`functions/src/index.ts`)

---

## 폴더 구조

```
src/
  app/                  # Next.js App Router 페이지
    dashboard/          # 메인 대시보드 (학생·교사·학부모·관리자)
    kiosk/              # 출석 키오스크
    login/ signup/      # 인증
  components/
    dashboard/          # 역할별 대시보드 컴포넌트
      student-dashboard.tsx
      teacher-dashboard.tsx
      parent-dashboard.tsx
      bottom-nav.tsx
    ui/                 # shadcn/ui 컴포넌트
  contexts/
    app-context.tsx     # 전역 상태 (role, tier, viewMode, isTimerActive 등)
  firebase/             # Firebase 클라이언트 훅 모음
  lib/
    types.ts            # 공유 타입 정의
    tier-theme.ts       # getTierTheme() — 동적 CSS 토큰
    parent-dashboard-model.ts
```

---

## 핵심 컨텍스트 값 (`useAppContext()`)

| 값 | 타입 | 설명 |
|---|---|---|
| `activeMembership` | `CenterMembership \| null` | 현재 로그인 멤버십 (role 포함) |
| `currentTier` | `TIERS[n]` | 학생 등급 (브론즈~챌린저) |
| `isTimerActive` | `boolean` | 집중 세션 진행 중 여부 |
| `viewMode` | `'mobile' \| 'desktop'` | 미리보기 모드 |

`isMobile = viewMode === 'mobile'` — 대시보드 내부에서 이렇게 파생함

---

## 역할(role) 별 진입점

| role | 주요 컴포넌트 |
|---|---|
| `student` | `student-dashboard.tsx` |
| `teacher` / `centerAdmin` | `teacher-dashboard.tsx` |
| `parent` | `parent-dashboard.tsx` |

---

## 학부모 탭 구조

URL 파라미터 `?parentTab=` 으로 제어:

| value | 라벨 |
|---|---|
| `home` | 홈 |
| `studyDetail` | 학습 |
| `data` | 학습분석 |
| `communication` | 소통 |
| `billing` | 수납 |

---

## 빌드 / 개발 명령어

```bash
npm run dev          # 개발 서버 (포트 9002)
npm run dev:safe     # 파일 감시 polling 모드 (Windows)
npm run build        # 프로덕션 빌드
npm run typecheck    # 타입 검사
npm run emulators    # Firebase 에뮬레이터
npm run deploy       # Firebase 배포
```

---

## 코딩 컨벤션

- Tailwind 동적 클래스는 `cn()` (`src/lib/utils.ts`) 사용
- 숫자 폰트: `dashboard-number` CSS 클래스 (globals.css에 정의)
- 브랜드 색상: `#14295F`(네이비), `#FF7A16`(오렌지)
- 카드 기본 radius: `rounded-[2rem]` (홈 카드), `rounded-2xl` (인라인 카드)
- Firestore 배열 의존성은 `useMemo`로 안정화 필수
- `tierTheme` = `getTierTheme(currentTier)` — 런타임 동적 CSS 토큰, 하드코딩 금지
