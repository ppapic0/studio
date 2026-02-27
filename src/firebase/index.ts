'use client';

import { firebaseConfig } from '@/firebase/config';
import {
  initializeApp,
  getApps,
  getApp,
  FirebaseApp,
} from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  Firestore,
} from 'firebase/firestore';
import { getFunctions, Functions } from 'firebase/functions';

/**
 * 프로젝트 전역 싱글톤 Firebase 서비스 인스턴스
 * - Firestore는 반드시 initializeFirestore로만 생성(설정 강제)
 * - getFirestore(app) 사용 금지: 설정(host/ssl) 다른 인스턴스가 생길 수 있음
 */
let firebaseApp: FirebaseApp | null = null;
let firestore: Firestore | null = null;
let auth: Auth | null = null;
let functions: Functions | null = null;

function ensureApp(): FirebaseApp {
  if (firebaseApp) return firebaseApp;

  if (getApps().length > 0) {
    firebaseApp = getApp();
    return firebaseApp;
  }

  firebaseApp = initializeApp(firebaseConfig);
  return firebaseApp;
}

function ensureFirestore(app: FirebaseApp): Firestore {
  if (firestore) return firestore;

  // ✅ 항상 initializeFirestore로만 생성해서 host/ssl 강제
  firestore = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
    host: 'firestore.googleapis.com',
    ssl: true,
  });

  // ✅ 디버그(브라우저 콘솔에서 확인)
  // @ts-ignore
  console.log('[DEBUG] Firestore host:', firestore?._settings?.host, 'ssl:', firestore?._settings?.ssl);

  return firestore;
}

function ensureAuth(app: FirebaseApp): Auth {
  if (auth) return auth;
  auth = getAuth(app);
  return auth;
}

function ensureFunctions(app: FirebaseApp): Functions {
  if (functions) return functions;
  functions = getFunctions(app, 'asia-northeast3');
  return functions;
}

/**
 * Firebase 서비스를 초기화하고 싱글톤 인스턴스를 반환
 */
export function initializeFirebase() {
  const app = ensureApp();
  const db = ensureFirestore(app);
  const a = ensureAuth(app);
  const fn = ensureFunctions(app);

  return { firebaseApp: app, auth: a, firestore: db, functions: fn };
}

/**
 * (호환용) 앱 인스턴스로부터 SDK를 가져오는 함수
 * - Firestore는 getFirestore()로 만들지 말고 ensureFirestore() 사용
 */
export function getSdks(app: FirebaseApp) {
  const db = ensureFirestore(app);
  const a = ensureAuth(app);
  const fn = ensureFunctions(app);

  return {
    firebaseApp: app,
    auth: a,
    firestore: db,
    functions: fn,
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