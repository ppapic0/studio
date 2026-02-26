'use client';

import { useState, useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * 전역적으로 방출되는 'permission-error' 이벤트를 수신하는 보이지 않는 컴포넌트입니다.
 * 수신된 에러를 다시 던져 Next.js의 global-error.tsx에서 캡처할 수 있도록 합니다.
 * 
 * 중요: 이 컴포넌트는 어떠한 Firestore 쿼리(useCollection, getDoc 등)도 직접 수행해서는 안 됩니다.
 */
export function FirebaseErrorListener() {
  const [error, setError] = useState<FirestorePermissionError | null>(null);

  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      // 에러가 발생했을 때 상태를 업데이트하여 리렌더링 시 throw 하도록 합니다.
      setError(error);
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  // 에러가 있으면 throw 하여 에러 경계(Error Boundary)에서 처리하게 합니다.
  if (error) {
    throw error;
  }

  return null;
}
