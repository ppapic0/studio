# 트랙학습센터 로컬 환경 구축 가이드

이 문서는 Firebase Studio에서 개발된 코드를 로컬 컴퓨터로 옮겨서 실행하는 방법을 설명합니다.

## 1. 전제 조건
- **Node.js**: v20 이상 버전이 설치되어 있어야 합니다.
- **Firebase CLI**: `npm install -g firebase-tools` 명령어로 설치하세요.
- **Git**: (선택 사항) 코드 관리를 위해 필요합니다.

## 2. 프로젝트 다운로드 및 설치
1. Firebase Studio 상단 메뉴 등을 통해 전체 프로젝트 폴더를 다운로드합니다.
2. 터미널(또는 CMD)에서 해당 폴더로 이동합니다.
3. 의존성 패키지를 설치합니다:
   ```bash
   npm install
   cd functions && npm install && cd ..
   ```

## 3. 환경 변수 설정
1. 루트 디렉토리에 있는 `.env.example` 파일을 복사하여 `.env.local` 파일을 만듭니다.
2. [Firebase 콘솔](https://console.firebase.google.com/) -> 프로젝트 설정 -> 내 앱에서 웹 앱의 구성 값(apiKey, appId 등)을 복사하여 `.env.local`에 채워 넣습니다.

## 4. 데이터베이스(Firestore) 가져오기
실제 데이터베이스의 데이터 자체는 코드에 포함되지 않습니다. 데이터를 로컬로 가져오려면 다음 방법 중 하나를 선택하세요.

### 방법 A: 운영 데이터베이스 직접 연결 (추천)
- 로컬에서 앱을 실행하더라도 `.env.local`에 실제 프로젝트의 API Key를 넣으면 구글 클라우드에 있는 데이터와 실시간으로 통신합니다. 별도의 다운로드가 필요 없습니다.

### 방법 B: 데이터 내보내기/가져오기 (백업용)
- Google Cloud Console의 Firestore '내보내기/가져오기' 기능을 사용하여 데이터를 버킷에 저장한 후 다운로드할 수 있습니다. (고급 사용자용)

## 5. 실행하기
- **Next.js 앱 실행**: `npm run dev` (접속: http://localhost:9002)
- **Firebase 함수 빌드**: `cd functions && npm run build`
- **Firebase 함수 배포**: `firebase deploy --only functions`

## 6. 주의 사항
- **CORS 설정**: 로컬에서 Cloud Functions를 호출할 때 CORS 에러가 발생할 수 있습니다. 배포된 함수의 도메인과 로컬 주소를 Firebase 콘솔에서 허용해 주어야 합니다.
- **인증**: `firebase login` 명령어를 통해 본인의 구글 계정으로 로그인되어 있어야 배포 및 관리가 가능합니다.
