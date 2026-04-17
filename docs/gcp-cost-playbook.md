# GCP 비용 절감 런북

이 문서는 이 프로젝트의 Firebase App Hosting 배포 습관과 GCP 비용 점검 절차를 함께 정리한 운영용 가이드입니다.

## 1. 지금 비용이 튄 핵심 포인트

- 2026-04-01~2026-04-15 기준 주요 증가분은 `Compute Engine`, `Networking`, `Cloud Build`입니다.
- 이 프로젝트는 [firebase.json](../firebase.json), [apphosting.yaml](../apphosting.yaml), [package.json](../package.json) 기준으로 Firebase App Hosting backend `studio`를 사용합니다.
- Firebase 공식 문서 기준 App Hosting은 Cloud Build로 앱을 빌드하고, Cloud Run으로 서빙하고, Cloud CDN으로 캐시합니다.
- Firebase Studio 공식 문서 기준 Firebase Studio workspaces는 Google Cloud VM 위에서 실행됩니다. 따라서 유휴 Studio VM, 디스크, 외부 IP가 남아 있으면 `Compute Engine` 비용이 따로 튈 수 있습니다.

## 2. 이 레포에서 바뀐 운영 규칙

- `npm run deploy`는 더 이상 바로 `firebase deploy`를 실행하지 않습니다.
- 전체 배포는 `npm run deploy:all`처럼 명시적으로만 허용합니다.
- App Hosting 배포는 `npm run deploy:apphosting`처럼 의도를 드러내는 명령으로만 실행합니다.
- App Hosting 수동 rollout은 `npm run rollout:apphosting`으로 실행합니다.
- Functions, Firestore rules, Firestore indexes는 각각 분리 배포합니다.

### 안전한 배포 명령

```bash
npm run deploy:functions
npm run deploy:firestore
npm run deploy:rules
npm run deploy:indexes
npm run deploy:apphosting
npm run deploy:all
npm run rollout:apphosting
```

### 참고

- `npm run deploy -- functions --dry-run`처럼 `--dry-run`을 붙여 검증할 수 있습니다.
- `npm run rollout:apphosting`의 기본 브랜치는 `release`입니다.
- 다른 브랜치에서 rollout 하려면 `npm run rollout:apphosting -- --branch prod`처럼 실행합니다.

## 3. Firebase Console에서 직접 바꿔야 하는 것

이 항목은 로컬 코드만으로는 완전히 자동화되지 않습니다. Firebase CLI는 현재 backend 생성/조회/삭제와 rollout 생성은 지원하지만, 기존 backend의 `automatic rollouts` 설정 자체를 바꾸는 update 명령은 제공하지 않습니다.

### App Hosting 자동 rollout 끄기

1. Firebase Console에서 `Hosting & Serverless > App Hosting`으로 이동합니다.
2. backend `studio`를 엽니다.
3. Settings 또는 Deployment 탭에서 `automatic rollouts`를 끕니다.
4. live branch를 `main` 대신 `release` 또는 `prod`로 바꿉니다.

### 권장 브랜치 전략

- `main`: 개발 통합 브랜치
- `release` 또는 `prod`: App Hosting live branch
- 운영 반영은 merge 후 `npm run rollout:apphosting`으로 수동 실행

## 4. Billing Reports에서 먼저 확인할 것

### Compute Engine

Billing Reports에서 아래 조건으로 drill-down 합니다.

- 기간: `2026-04-14 ~ 2026-04-15`
- 서비스: `Compute Engine`
- 프로젝트: `Firebase app`
- 위치: `asia-northeast3`
- SKU: `Micro Instance with burstable CPU running in Seoul`, `Storage PD Capacity in Seoul`

확인 후 우선 정리 후보:

- 사용하지 않는 Firebase Studio workspace VM
- 중지된 VM에 붙어 남아 있는 Persistent Disk
- 사용 중이 아닌 정적 외부 IP
- 테스트용으로 만들어두고 방치한 VM

### Networking

Billing Reports에서 아래 조건으로 drill-down 합니다.

- 서비스: `Networking`
- 프로젝트: `Firebase app`
- 같은 날짜 구간

확인 후 우선 정리 후보:

- 미사용 Load Balancer
- 미사용 외부 IP
- 예상보다 큰 egress
- 테스트용 백엔드나 프리뷰 URL에 붙은 트래픽

## 5. 검증 루틴

- 변경 후 3일, 7일 시점에 Billing Reports에서 같은 필터로 다시 비교합니다.
- App Hosting Rollouts 화면에서 build/rollout 횟수가 줄었는지 확인합니다.
- `Compute Engine`과 `Networking`은 일별 비용이 거의 0으로 떨어졌는지 확인합니다.
- `apphosting.yaml`의 `maxInstances: 1`은 이미 보수적으로 설정되어 있으므로 첫 절감 포인트로 건드리지 않습니다.

## 6. 참고 자료

- Firebase App Hosting 개요: <https://firebase.google.com/docs/app-hosting>
- App Hosting 비용: <https://firebase.google.com/docs/app-hosting/costs>
- App Hosting 대체 배포 방식: <https://firebase.google.com/docs/app-hosting/alt-deploy>
- App Hosting backend 설정: <https://firebase.google.com/docs/app-hosting/configure>
- App Hosting 다중 환경 배포: <https://firebase.google.com/docs/app-hosting/multiple-environments>
- Firebase Security Rules 배포: <https://firebase.google.com/docs/rules/manage-deploy>
- Firebase Studio 개요: <https://firebase.google.com/docs/studio>
