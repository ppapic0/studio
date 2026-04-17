
# 트랙학습센터 로컬 환경 구축 가이드

이 문서는 Firebase Studio에서 개발된 코드를 로컬 컴퓨터로 옮겨서 실행하고 관리하는 방법을 설명합니다.

## 1. 전제 조건
- **Node.js**: v20 이상 버전 설치
- **Firebase CLI**: `npm install -g firebase-tools`
- **프로젝트 다운로드**: Firebase Studio IDE 상단 메뉴에서 [Export] 또는 [Download]를 클릭하여 전체 소스 코드를 받으세요.

## 2. 설치 및 환경 설정
1. 다운로드한 폴더의 압축을 풀고 터미널에서 해당 위치로 이동합니다.
2. 의존성 설치:
   ```bash
   npm install
   cd functions && npm install && cd ..
   ```
3. 환경 변수 설정:
   - 루트의 `.env.example` 파일을 복사하여 `.env.local` 파일을 만듭니다.
   - [Firebase Console](https://console.firebase.google.com/) -> 프로젝트 설정에서 Web App 설정을 복사해 채워 넣습니다.

## 3. 데이터베이스 관리 (수동 삭제 등)
앱 내에서 방대한 데이터로 인해 삭제가 지연되거나 실패할 경우, Firebase Console에서 직접 조작하는 것이 가장 확실합니다.
- **주요 데이터 경로**:
  - `users`: 사용자 기본 프로필
  - `centers/{centerId}/students`: 학생 상세 정보
  - `centers/{centerId}/studyLogs`: 방대한 학습 기록
  - `centers/{centerId}/plans`: 주간/일일 계획

## 4. 로컬 실행
- **Next.js 앱 실행**: `npm run dev` (접속: http://localhost:9002)
- **Firebase 함수 배포**: `firebase deploy --only functions`

## 5. 배포 운영 규칙

이 프로젝트는 Firebase App Hosting backend `studio`를 함께 사용합니다. 루트에서 무심코 전체 배포를 하면 App Hosting까지 같이 배포되어 Cloud Build 비용이 추가될 수 있으므로, 이제는 대상별 명령만 사용합니다.

- **Functions만 배포**: `npm run deploy:functions`
- **Firestore rules + indexes 배포**: `npm run deploy:firestore`
- **Firestore rules만 배포**: `npm run deploy:rules`
- **Firestore indexes만 배포**: `npm run deploy:indexes`
- **App Hosting만 배포**: `npm run deploy:apphosting`
- **App Hosting 수동 rollout**: `npm run rollout:apphosting`
- **전체 배포**: `npm run deploy:all`

`npm run deploy`는 이제 보호용 가드 스크립트라서, 대상 없이 실행하면 어떤 배포가 Cloud Build를 유발하는지 설명하고 종료합니다.

## 6. 비용 점검 메모

- Firebase App Hosting은 Cloud Build로 앱을 빌드하고 Cloud Run으로 서빙합니다.
- Firebase Studio는 Google Cloud VM 위에서 실행되므로, 사용하지 않는 Studio workspace VM이나 디스크가 남아 있으면 `Compute Engine` 비용이 따로 발생할 수 있습니다.
- 비용 점검 절차는 [docs/gcp-cost-playbook.md](./docs/gcp-cost-playbook.md)에 정리해 두었습니다.

## 7. 주의 사항
- **CORS 설정**: 로컬 호출 시 Firebase Console에서 도메인 허용이 필요할 수 있습니다.
- **동기화**: 데이터 수정 시 '데이터 통합 저장' 버튼을 누르면 Auth, Firestore, 랭킹 정보가 한꺼번에 업데이트됩니다.
