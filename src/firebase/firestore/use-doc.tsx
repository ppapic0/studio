'use client';
    
import { useState, useEffect } from 'react';
import {
  DocumentReference,
  onSnapshot,
  DocumentData,
  FirestoreError,
  DocumentSnapshot,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { shouldUseStrictFirestorePermissionErrors } from '@/lib/client-debug-flags';

/** Utility type to add an 'id' field to a given type T. */
type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useDoc hook.
 * @template T Type of the document data.
 */
export interface UseDocResult<T> {
  data: WithId<T> | null; // Document data with ID, or null.
  isLoading: boolean;       // True if loading.
  error: FirestoreError | Error | null; // Error object, or null.
}

/**
 * React hook to subscribe to a single Firestore document in real-time.
 * Handles nullable references and conditional enabling.
 * 
 * @template T Optional type for document data. Defaults to any.
 * @param {DocumentReference<DocumentData> | null | undefined} memoizedDocRef -
 * The Firestore DocumentReference.
 * @param {object} options - Options for the hook.
 * @param {boolean} options.enabled - Whether the subscription is enabled.
 * @returns {UseDocResult<T>} Object with data, isLoading, error.
 */
export function useDoc<T = any>(
  memoizedDocRef: DocumentReference<DocumentData> | null | undefined,
  options: { enabled?: boolean } = { enabled: true }
): UseDocResult<T> {
  type StateDataType = WithId<T> | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  const [resolvedPath, setResolvedPath] = useState<string | null>(null);

  const enabled = options.enabled !== false;
  const currentPath = memoizedDocRef?.path ?? null;
  const strictPermissionErrors = shouldUseStrictFirestorePermissionErrors();

  useEffect(() => {
    if (!memoizedDocRef || !enabled) {
      setData(null);
      setIsLoading(false);
      setError(null);
      setResolvedPath(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      memoizedDocRef,
      (snapshot: DocumentSnapshot<DocumentData>) => {
        if (snapshot.exists()) {
          setData({ ...(snapshot.data() as T), id: snapshot.id });
        } else {
          setData(null);
        }
        setError(null);
        setResolvedPath(memoizedDocRef.path);
        setIsLoading(false);
      },
      (err: FirestoreError) => {
        // 권한 오류인 경우에만 전역 에러 리스너를 실행합니다.
        if (err.code === 'permission-denied') {
          const contextualError = new FirestorePermissionError({
            operation: 'get',
            path: memoizedDocRef.path,
          })

          setError(contextualError)
          if (strictPermissionErrors) {
            errorEmitter.emit('permission-error', contextualError);
          }
        } else {
          // 기타 오류(시간 동기화 등)는 콘솔에만 출력합니다.
          setError(err);
          console.warn("Firestore Doc Listener Warning:", err.message);
        }
        
        setData(null)
        setResolvedPath(memoizedDocRef.path)
        setIsLoading(false)
      }
    );

    return () => unsubscribe();
  }, [memoizedDocRef, enabled]);

  const isWaitingForFirstSnapshot = Boolean(memoizedDocRef && enabled && resolvedPath !== currentPath);
  const shouldReturnEmptyData = !memoizedDocRef || !enabled || isWaitingForFirstSnapshot;

  return {
    data: shouldReturnEmptyData ? null : data,
    isLoading: isLoading || isWaitingForFirstSnapshot,
    error,
  };
}
