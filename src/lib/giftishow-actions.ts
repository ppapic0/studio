'use client';

import { httpsCallable } from 'firebase/functions';

import { initializeFirebase } from '@/firebase';
import type { GiftishowOrder, GiftishowSettings } from '@/lib/types';

type GiftishowProductSyncSummary = {
  syncedCount: number;
  availableCount: number;
  lastCatalogSyncedAt: string;
  mode: 'mock' | 'live';
};

type GiftishowSettingsSaveInput = {
  centerId: string;
  enabled: boolean;
  bannerId?: string;
  templateId?: string;
  authCode?: string;
  authToken?: string;
  userId?: string;
  callbackNo?: string;
};

type GiftishowSettingsSaveResult = {
  ok: boolean;
  settings: GiftishowSettings;
};

type GiftishowBizmoneyResult = {
  ok: boolean;
  balance: number;
  mode: 'mock' | 'live';
};

type GiftishowOrderRequestResult = {
  ok: boolean;
  order: GiftishowOrder;
};

type GiftishowOrderMutationResult = {
  ok: boolean;
  order: GiftishowOrder;
};

export async function saveGiftishowSettingsSecure(input: GiftishowSettingsSaveInput) {
  const { functions } = initializeFirebase();
  const callable = httpsCallable<GiftishowSettingsSaveInput, GiftishowSettingsSaveResult>(
    functions,
    'saveGiftishowSettingsSecure'
  );
  const result = await callable(input);
  return result.data;
}

export async function syncGiftishowCatalogSecure(centerId: string) {
  const { functions } = initializeFirebase();
  const callable = httpsCallable<{ centerId: string }, GiftishowProductSyncSummary>(
    functions,
    'syncGiftishowCatalogSecure'
  );
  const result = await callable({ centerId });
  return result.data;
}

export async function getGiftishowBizmoneySecure(centerId: string) {
  const { functions } = initializeFirebase();
  const callable = httpsCallable<{ centerId: string }, GiftishowBizmoneyResult>(
    functions,
    'getGiftishowBizmoneySecure'
  );
  const result = await callable({ centerId });
  return result.data;
}

export async function createGiftishowOrderRequestSecure(input: { centerId: string; goodsCode: string }) {
  const { functions } = initializeFirebase();
  const callable = httpsCallable<{ centerId: string; goodsCode: string }, GiftishowOrderRequestResult>(
    functions,
    'createGiftishowOrderRequestSecure'
  );
  const result = await callable(input);
  return result.data;
}

export async function approveGiftishowOrderSecure(input: { centerId: string; orderId: string }) {
  const { functions } = initializeFirebase();
  const callable = httpsCallable<{ centerId: string; orderId: string }, GiftishowOrderMutationResult>(
    functions,
    'approveGiftishowOrderSecure'
  );
  const result = await callable(input);
  return result.data;
}

export async function rejectGiftishowOrderSecure(input: { centerId: string; orderId: string; reason?: string }) {
  const { functions } = initializeFirebase();
  const callable = httpsCallable<{ centerId: string; orderId: string; reason?: string }, GiftishowOrderMutationResult>(
    functions,
    'rejectGiftishowOrderSecure'
  );
  const result = await callable(input);
  return result.data;
}

export async function cancelGiftishowOrderSecure(input: { centerId: string; orderId: string; reason?: string }) {
  const { functions } = initializeFirebase();
  const callable = httpsCallable<{ centerId: string; orderId: string; reason?: string }, GiftishowOrderMutationResult>(
    functions,
    'cancelGiftishowOrderSecure'
  );
  const result = await callable(input);
  return result.data;
}

export async function resendGiftishowOrderSecure(input: { centerId: string; orderId: string }) {
  const { functions } = initializeFirebase();
  const callable = httpsCallable<{ centerId: string; orderId: string }, GiftishowOrderMutationResult>(
    functions,
    'resendGiftishowOrderSecure'
  );
  const result = await callable(input);
  return result.data;
}
