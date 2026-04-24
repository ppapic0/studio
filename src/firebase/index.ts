
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
  memoryLocalCache,
  Firestore,
} from 'firebase/firestore';
import { getFunctions, Functions } from 'firebase/functions';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

/**
 * 프로젝트 전역 싱글톤 Firebase 서비스 인스턴스
 * Firebase Studio 운영 지침에 따라 에뮬레이터 코드를 절대 사용하지 않습니다.
 */
let firebaseApp: FirebaseApp | null = null;
let firestore: Firestore | null = null;
let auth: Auth | null = null;
let functions: Functions | null = null;
let storage: FirebaseStorage | null = null;

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

  firestore = initializeFirestore(app, {
    // Parent dashboard attaches many real-time listeners at once.
    // Keeping Firestore on the default in-memory cache avoids IndexedDB
    // restore issues that were surfacing as internal assertion errors.
    localCache: memoryLocalCache(),
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
  // 서버 배포 리전(asia-northeast3)을 명시적으로 설정하여 CORS 및 404/internal 에러 방지
  functions = getFunctions(app, 'asia-northeast3');
  return functions;
}

function ensureStorage(app: FirebaseApp): FirebaseStorage {
  if (storage) return storage;
  storage = getStorage(app);
  return storage;
}

/**
 * Firebase 서비스를 초기화하고 싱글톤 인스턴스를 반환
 */
export function initializeFirebase() {
  const app = ensureApp();
  const db = ensureFirestore(app);
  const a = ensureAuth(app);
  const fn = ensureFunctions(app);
  const st = ensureStorage(app);

  return { firebaseApp: app, auth: a, firestore: db, functions: fn, storage: st };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
