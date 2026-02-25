/**
 * This component MUST be used inside a Client Component or it will throw.
 * It listens for custom 'permission-error' events and throws them,
 * which allows them to be caught by the Next.js Error Boundary and
 * displayed in the development overlay.
 */
'use client';

import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useEffect } from 'react';

export function FirebaseErrorListener() {
  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      // Throw the error to make it visible in the Next.js development overlay
      throw error;
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  return null; // This component doesn't render anything
}
