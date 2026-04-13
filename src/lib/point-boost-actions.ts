'use client';

import { httpsCallable } from 'firebase/functions';

import { initializeFirebase } from '@/firebase';

export type PointBoostMode = 'day' | 'window';

export type CreatePointBoostEventSecureInput = {
  centerId: string;
  mode: PointBoostMode;
  startAtMs: number;
  endAtMs: number;
  multiplier: number;
  message?: string;
};

export type CreatePointBoostEventSecureResult = {
  ok: boolean;
  eventId: string;
};

export type CancelPointBoostEventSecureInput = {
  centerId: string;
  eventId: string;
};

export type CancelPointBoostEventSecureResult = {
  ok: boolean;
  eventId: string;
};

export async function createPointBoostEventSecure(input: CreatePointBoostEventSecureInput) {
  const { functions } = initializeFirebase();
  const callable = httpsCallable<CreatePointBoostEventSecureInput, CreatePointBoostEventSecureResult>(
    functions,
    'createPointBoostEventSecure'
  );
  const result = await callable(input);
  return result.data;
}

export async function cancelPointBoostEventSecure(input: CancelPointBoostEventSecureInput) {
  const { functions } = initializeFirebase();
  const callable = httpsCallable<CancelPointBoostEventSecureInput, CancelPointBoostEventSecureResult>(
    functions,
    'cancelPointBoostEventSecure'
  );
  const result = await callable(input);
  return result.data;
}
