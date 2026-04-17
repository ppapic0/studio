# Firebase Studio

This is a NextJS starter in Firebase Studio.

## 시작하기

앱을 사용하려면 먼저 Firebase 프로젝트에 연결해야 합니다.

### 1. 환경 변수 설정하기

먼저, 프로젝트의 루트 디렉토리에서 `.env` 파일을 복사하여 `.env.local` 파일을 생성하세요.

```bash
cp .env .env.local
```

다음으로, Firebase 프로젝트의 웹 앱 구성 정보를 가져와야 합니다.

1.  [Firebase 콘솔](https://console.firebase.google.com/)로 이동합니다.
2.  당신의 프로젝트를 선택합니다 (또는 새로 만듭니다).
3.  **프로젝트 설정**으로 이동합니다 (톱니바퀴 아이콘 클릭).
4.  "내 앱" 카드에서 웹 앱을 선택합니다 (또는 새로 만듭니다).
5.  "Firebase SDK 스니펫" 섹션에서 **구성(Config)** 옵션을 선택합니다.
6.  `apiKey`, `authDomain` 등의 구성 값을 복사하여 `.env.local` 파일에 붙여넣습니다.

완성된 `.env.local` 파일은 아래와 같은 형식이 됩니다:

```
# Firebase 웹 앱 구성
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
NEXT_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:abc123def456

# 개발용 비밀 키 (Cloud Function 용)
DEV_SECRET=SUPER_SECRET_DEV_KEY
```

### 2. Firebase Cloud Functions 설정하기

이 프로젝트는 `devJoinCenter`라는 개발 전용 Cloud Function을 포함하고 있습니다. 이 함수는 특정 역할을 가진 테스트 사용자를 쉽게 생성할 수 있도록 돕습니다.

1.  **`functions` 디렉토리로 이동합니다:**
    ```bash
    cd functions
    ```

2.  **의존성을 설치합니다:**
    ```bash
    npm install
    ```

3.  **개발용 비밀 키 설정:**
    `devJoinCenter` 함수는 승인되지 않은 사용을 막기 위해 비밀 키로 보호됩니다. Firebase Functions 환경 구성에 이 키를 설정해야 합니다. **이 값은 `.env.local` 파일의 `DEV_SECRET`과 일치해야 합니다.**

    ```bash
    firebase functions:config:set dev.secret="SUPER_SECRET_DEV_KEY"
    ```
    (`"SUPER_SECRET_DEV_KEY"`는 원하는 다른 비밀 문자열로 변경할 수 있습니다.)

4.  **함수를 배포합니다:**
    ```bash
    firebase deploy --only functions
    ```

### 3. 앱 실행하기

이제 Next.js 개발 서버를 실행할 수 있습니다.

```bash
npm run dev
```

브라우저에서 [http://localhost:9002](http://localhost:9002)를 엽니다.

- 새 계정으로 회원가입할 수 있습니다.
- 회원가입 후에는 `/connection-test` 페이지로 리디렉션됩니다.
- 이 페이지에서 `devJoinCenter` 함수를 사용하여 특정 역할로 테스트 센터에 가입할 수 있습니다.
- 센터에 가입한 후에는 `/app` 페이지로 이동하여 "보안 규칙 테스트 패널"을 통해 역할 기반 권한을 확인할 수 있습니다.

## 배포 주의

- 이 프로젝트의 루트 `deploy` 스크립트는 보호용 라우터입니다.
- Functions만 배포할 때는 `npm run deploy:functions`
- Firestore rules/indexes는 `npm run deploy:firestore`, `npm run deploy:rules`, `npm run deploy:indexes`
- App Hosting만 배포할 때는 `npm run deploy:apphosting`
- App Hosting 수동 rollout은 `npm run rollout:apphosting`
- 전체 Firebase 배포가 정말 필요할 때만 `npm run deploy:all`

자세한 비용 절감 운영 가이드는 [docs/gcp-cost-playbook.md](./docs/gcp-cost-playbook.md)를 참고하세요.
