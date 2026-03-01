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

  // 기본 호스트 및 SSL 설정을 SDK에 위임하여 시간 동기화 오류 가능성을 낮춥니다.
  firestore = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });

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
