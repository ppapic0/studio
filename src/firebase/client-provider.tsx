'use client';

import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { Functions } from 'firebase/functions';
import { FirebaseProvider } from '@/firebase/provider';
import React, { useEffect, useState } from 'react';

/**
 * Ensures that Firebase is only initialized once on the client.
 */
export function FirebaseClientProvider(props: {
  children: React.ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  functions: Functions;
}) {
  const { children, ...rest } = props;
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  if (!hydrated) {
    return null;
  }
  return <FirebaseProvider {...rest}>{children}</FirebaseProvider>;
}
