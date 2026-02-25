'use client';
import {
  onSnapshot,
  query,
  collection,
  where,
  type DocumentData,
  type Firestore,
  type Query,
} from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';

import { useFirestore } from '@/firebase/provider';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

export function useCollection<T>(path: string, field?: string, value?: string) {
  const firestore = useFirestore();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const collectionQuery = useMemo(() => {
    if (!firestore) return null;
    const ref = collection(firestore, path);
    if (field && value) {
      return query(ref, where(field, '==', value));
    }
    return ref;
  }, [firestore, path, field, value]);

  useEffect(() => {
    if (!collectionQuery) return;
    setLoading(true);

    const unsubscribe = onSnapshot(
      collectionQuery,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as T[];
        setData(data);
        setLoading(false);
      },
      (err) => {
        const permissionError = new FirestorePermissionError({
          path: (collectionQuery as Query<DocumentData>).path,
          operation: 'list',
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        setError(permissionError);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [collectionQuery]);

  return { data, loading, error };
}
