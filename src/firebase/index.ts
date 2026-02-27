'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager, 
  Firestore 
} from 'firebase/firestore';
import { getFunctions, Functions } from 'firebase/functions';

/**
 * 프로젝트 전역에서 공유될 Firebase 서비스 인스턴스 (싱글톤)
 */
let firebaseApp: FirebaseApp;
let firestore: Firestore;
let auth: Auth;
let functions: Functions;

/**
 * Firebase 서비스를 초기화하고 인스턴스를 반환합니다.
 * 에뮬레이터 연결 코드를 완전히 제거하고 오직 프로덕션 환경으로만 연결합니다.
 */
export function initializeFirebase() {
  // 이미 앱이 초기화되어 있다면 기존 인스턴스들을 반환
  if (getApps().length > 0) {
    firebaseApp = getApp();
    return getSdks(firebaseApp);
  }

  // 1. Firebase App 초기화
  firebaseApp = initializeApp(firebaseConfig);

  // 2. Firestore 초기화 (프로덕션 호스트 명시 및 오프라인 캐시 설정)
  firestore = initializeFirestore(firebaseApp, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    host: 'firestore.googleapis.com',
    ssl: true,
  });

  // 3. 기타 서비스 인스턴스 생성
  auth = getAuth(firebaseApp);
  functions = getFunctions(firebaseApp, 'asia-northeast3');

  return { firebaseApp, auth, firestore, functions };
}

/**
 * 초기화된 앱 인스턴스로부터 서비스 인스턴스들을 안전하게 가져오는 헬퍼 함수
 */
export function getSdks(app: FirebaseApp) {
  if (!firestore) {
    firestore = getFirestore(app);
  }
  if (!auth) {
    auth = getAuth(app);
  }
  if (!functions) {
    functions = getFunctions(app, 'asia-northeast3');
  }

  return {
    firebaseApp: app,
    auth,
    firestore,
    functions
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
