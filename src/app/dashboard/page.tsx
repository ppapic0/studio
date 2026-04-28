'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StudentDashboard } from '@/components/dashboard/student-dashboard';
import { AdminDashboard } from '@/components/dashboard/admin-dashboard';
import { ParentDashboard } from '@/components/dashboard/parent-dashboard';
import { useUser, useFunctions, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { Loader2, RefreshCw, Compass, Sparkles, Link2, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { httpsCallable } from 'firebase/functions';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { type StudentProfile, type User as UserType } from '@/lib/types';
import {
  buildClientConsentSnapshot,
  LEGAL_CURRENT_DATA_CATEGORIES,
  LEGAL_RECONSENT_DESCRIPTION,
  LEGAL_REQUIRED_PRIVACY_SUMMARY,
  LEGAL_REQUIRED_TERMS_SUMMARY,
  MARKETING_CONSENT_VERSION,
  PRIVACY_ROUTE,
  PRIVACY_VERSION,
  TERMS_ROUTE,
  TERMS_VERSION,
} from '@/lib/legal-documents';

const inviteFormSchema = z.object({
  inviteCode: z.string().trim().min(1, '초대 코드를 입력해 주세요.'),
});

const parentLinkFormSchema = z.object({
  studentLinkCode: z.string().trim().regex(/^\d{6}$/, '학생 코드(6자리 숫자)를 입력해 주세요.'),
  parentPhoneNumber: z.string().trim().optional(),
});

type LegalConsentFormState = {
  termsConsent: boolean;
  privacyConsent: boolean;
  age14Consent: boolean;
  marketingEmailConsent: boolean;
};

function hasAcceptedCurrentConsent(
  consent: {
    agreed?: unknown;
    version?: unknown;
  } | null | undefined,
  version: string
): boolean {
  return consent?.agreed === true && consent?.version === version;
}

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

function extractPhoneNumber(source: unknown): string {
  if (!source || typeof source !== 'object') return '';
  const candidate = (source as { phoneNumber?: unknown }).phoneNumber;
  return typeof candidate === 'string' ? candidate : '';
}

function isValidKoreanMobilePhone(raw: string): boolean {
  return /^01\d{8,9}$/.test(raw);
}

function resolveCallableErrorMessage(error: any, fallback: string): string {
  const detailMessageRaw =
    typeof error?.details === 'string'
      ? error.details
      : typeof error?.details?.userMessage === 'string'
        ? error.details.userMessage
        : typeof error?.details?.message === 'string'
          ? error.details.message
          : typeof error?.details?.error === 'string'
            ? error.details.error
            : '';
  const detailMessage = String(detailMessageRaw || '')
    .replace(/^\d+\s+FAILED_PRECONDITION:?\s*/i, '')
    .replace(/^\d+\s+INVALID_ARGUMENT:?\s*/i, '')
    .replace(/^\d+\s+ALREADY_EXISTS:?\s*/i, '')
    .replace(/^\d+\s+INTERNAL:?\s*/i, '')
    .trim();

  const rawMessage = String(error?.message || '').trim();
  const strippedRaw = rawMessage.replace(/^FirebaseError:\s*/i, '').trim();
  const normalizedRaw = strippedRaw
    .replace(/^\d+\s+FAILED_PRECONDITION:?\s*/i, '')
    .replace(/^\d+\s+INVALID_ARGUMENT:?\s*/i, '')
    .replace(/^\d+\s+ALREADY_EXISTS:?\s*/i, '')
    .replace(/^\d+\s+INTERNAL:?\s*/i, '')
    .trim();

  const code = String(error?.code || '').toLowerCase();
  const hasFailedPrecondition = code.includes('failed-precondition') || /failed[_ -]?precondition/i.test(strippedRaw);
  const hasInvalidArgument = code.includes('invalid-argument') || /invalid[_ -]?argument/i.test(strippedRaw);
  const hasAlreadyExists = code.includes('already-exists') || /already[_ -]?exists/i.test(strippedRaw);
  const isInternal = code.includes('internal') || /\b(functions\/internal|internal)\b/i.test(normalizedRaw);

  if (detailMessage) return detailMessage;
  if (!isInternal && normalizedRaw) return normalizedRaw;

  if (hasFailedPrecondition) {
    return '사전 조건이 맞지 않습니다. 입력한 학생 코드 또는 초대 코드를 다시 확인해 주세요.';
  }
  if (hasInvalidArgument) {
    return '입력값이 올바르지 않습니다. 필수 항목을 다시 확인해 주세요.';
  }
  if (hasAlreadyExists) {
    return '이미 연결된 계정입니다. 연동 상태를 다시 확인해 주세요.';
  }

  return fallback;
}

export default function DashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const functions = useFunctions();
  const { activeMembership, activeStudentId, membershipsLoading, viewMode } = useAppContext();
  const router = useRouter();
  const { toast } = useToast();
  const [isInviteSubmitting, setIsInviteSubmitting] = useState(false);
  const [isParentLinkSubmitting, setIsParentLinkSubmitting] = useState(false);
  const [isPhoneCaptureOpen, setIsPhoneCaptureOpen] = useState(false);
  const [phoneCaptureValue, setPhoneCaptureValue] = useState('');
  const [isPhoneCaptureSaving, setIsPhoneCaptureSaving] = useState(false);
  const [savedPhoneFallback, setSavedPhoneFallback] = useState('');
  const [isLegalConsentDialogOpen, setIsLegalConsentDialogOpen] = useState(false);
  const [isLegalConsentSaving, setIsLegalConsentSaving] = useState(false);
  const [legalConsentForm, setLegalConsentForm] = useState<LegalConsentFormState>({
    termsConsent: false,
    privacyConsent: false,
    age14Consent: false,
    marketingEmailConsent: false,
  });
  const isMobile = activeMembership?.role === 'parent' || viewMode === 'mobile';
  const isStudentRole = activeMembership?.role === 'student';
  const isParentRole = activeMembership?.role === 'parent';
  const authUid = user?.uid || null;
  const studentDocId = activeStudentId || authUid || null;

  useEffect(() => {
    if (activeMembership?.role === 'kiosk') {
      router.replace('/kiosk');
    }
  }, [activeMembership?.role, router]);

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile, isLoading: isUserProfileLoading } = useDoc<UserType>(userProfileRef, { enabled: Boolean(user) });

  const studentProfileRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || activeMembership.role !== 'student' || !studentDocId) return null;
    return doc(firestore, 'centers', activeMembership.id, 'students', studentDocId);
  }, [firestore, activeMembership, studentDocId]);
  const { data: studentProfile, isLoading: isStudentProfileLoading } = useDoc<StudentProfile>(studentProfileRef, { enabled: isStudentRole });

  const inviteForm = useForm<z.infer<typeof inviteFormSchema>>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: { inviteCode: '' },
  });

  const parentLinkForm = useForm<z.infer<typeof parentLinkFormSchema>>({
    resolver: zodResolver(parentLinkFormSchema),
    defaultValues: { studentLinkCode: '', parentPhoneNumber: '' },
  });

  const hasCurrentTermsConsent = hasAcceptedCurrentConsent(userProfile?.legalConsents?.terms, TERMS_VERSION);
  const hasCurrentPrivacyConsent = hasAcceptedCurrentConsent(userProfile?.legalConsents?.privacy, PRIVACY_VERSION);
  const hasCurrentAge14Consent = hasAcceptedCurrentConsent(userProfile?.legalConsents?.age14, PRIVACY_VERSION);
  const hasCurrentMarketingEmailConsent = hasAcceptedCurrentConsent(
    userProfile?.legalConsents?.marketingEmail,
    MARKETING_CONSENT_VERSION
  );
  const hasCurrentRequiredLegalConsents =
    hasCurrentTermsConsent && hasCurrentPrivacyConsent && hasCurrentAge14Consent;
  const needsLegalConsentPrompt = Boolean(user && !isUserProfileLoading && !hasCurrentRequiredLegalConsents);
  const requiredLegalConsentsAccepted =
    legalConsentForm.termsConsent && legalConsentForm.privacyConsent && legalConsentForm.age14Consent;

  const resolvedSelfPhone = useMemo(() => {
    if (!activeMembership) return '';
    const studentPhone = extractPhoneNumber(studentProfile);
    if (activeMembership.role === 'student') {
      return normalizePhone(studentPhone || userProfile?.phoneNumber || activeMembership.phoneNumber || '');
    }
    if (activeMembership.role === 'parent') {
      return normalizePhone(userProfile?.phoneNumber || activeMembership.phoneNumber || '');
    }
    return '';
  }, [activeMembership, studentProfile, userProfile?.phoneNumber]);

  const effectiveSelfPhone = savedPhoneFallback || resolvedSelfPhone;
  const isPhoneLookupReady = useMemo(() => {
    if (!activeMembership || !user) return false;
    if (activeMembership.role === 'student') {
      return !isUserProfileLoading && !isStudentProfileLoading;
    }
    if (activeMembership.role === 'parent') {
      return !isUserProfileLoading;
    }
    return true;
  }, [activeMembership, user, isStudentProfileLoading, isUserProfileLoading]);

  useEffect(() => {
    if (!user || isUserProfileLoading) return;
    setLegalConsentForm({
      termsConsent: hasCurrentTermsConsent,
      privacyConsent: hasCurrentPrivacyConsent,
      age14Consent: hasCurrentAge14Consent,
      marketingEmailConsent: hasCurrentMarketingEmailConsent,
    });
  }, [
    user,
    isUserProfileLoading,
    hasCurrentTermsConsent,
    hasCurrentPrivacyConsent,
    hasCurrentAge14Consent,
    hasCurrentMarketingEmailConsent,
  ]);

  useEffect(() => {
    if (!user || isUserProfileLoading) return;
    setIsLegalConsentDialogOpen(needsLegalConsentPrompt);
  }, [user, isUserProfileLoading, needsLegalConsentPrompt]);

  useEffect(() => {
    if (!activeMembership || !user) return;
    if (activeMembership.role !== 'student' && activeMembership.role !== 'parent') return;
    if (needsLegalConsentPrompt || isLegalConsentSaving) {
      setIsPhoneCaptureOpen(false);
      return;
    }
    if (!isPhoneLookupReady) return;
    if (effectiveSelfPhone) {
      setIsPhoneCaptureOpen(false);
      return;
    }
    setPhoneCaptureValue((prev) => prev || '');
    setIsPhoneCaptureOpen(true);
  }, [activeMembership, user, effectiveSelfPhone, isPhoneLookupReady, needsLegalConsentPrompt, isLegalConsentSaving]);

  const buildDashboardLegalConsentsPayload = useCallback(() => {
    return {
      terms: buildClientConsentSnapshot({
        agreed: legalConsentForm.termsConsent,
        version: TERMS_VERSION,
        source: 'dashboard',
      }),
      privacy: buildClientConsentSnapshot({
        agreed: legalConsentForm.privacyConsent,
        version: PRIVACY_VERSION,
        source: 'dashboard',
      }),
      age14: buildClientConsentSnapshot({
        agreed: legalConsentForm.age14Consent,
        version: PRIVACY_VERSION,
        source: 'dashboard',
      }),
      marketingEmail: buildClientConsentSnapshot({
        agreed: legalConsentForm.marketingEmailConsent,
        version: MARKETING_CONSENT_VERSION,
        source: 'dashboard',
        channel: 'email',
      }),
    };
  }, [legalConsentForm]);

  const handleSaveLegalConsents = useCallback(async () => {
    if (!user || !firestore || !userProfileRef) {
      toast({
        variant: 'destructive',
        title: '저장 준비 중',
        description: '계정 정보를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.',
      });
      return;
    }

    if (!requiredLegalConsentsAccepted) {
      toast({
        variant: 'destructive',
        title: '필수 동의 확인',
        description: '이용약관, 개인정보 수집 및 이용, 만 14세 이상 확인에 모두 동의해 주세요.',
      });
      return;
    }

    setIsLegalConsentSaving(true);
    try {
      await setDoc(
        userProfileRef,
        {
          id: user.uid,
          email: user.email || userProfile?.email || '',
          displayName:
            user.displayName ||
            userProfile?.displayName ||
            activeMembership?.displayName ||
            '사용자',
          createdAt: userProfile?.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
          legalConsents: buildDashboardLegalConsentsPayload(),
        },
        { merge: true }
      );

      setIsLegalConsentDialogOpen(false);
      toast({
        title: '개인정보 동의 저장 완료',
        description: '현재 약관과 개인정보 수집·이용 동의가 계정에 반영되었습니다.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '동의 저장 실패',
        description: resolveCallableErrorMessage(error, '동의 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'),
      });
    } finally {
      setIsLegalConsentSaving(false);
    }
  }, [
    activeMembership?.displayName,
    buildDashboardLegalConsentsPayload,
    firestore,
    requiredLegalConsentsAccepted,
    toast,
    user,
    userProfile?.createdAt,
    userProfile?.displayName,
    userProfile?.email,
    userProfileRef,
  ]);

  async function onInviteSubmit(values: z.infer<typeof inviteFormSchema>) {
    if (!user || !functions) return;

    if (needsLegalConsentPrompt) {
      setIsLegalConsentDialogOpen(true);
      toast({
        variant: 'destructive',
        title: '개인정보 동의 필요',
        description: '센터 가입 전에 현재 개인정보 수집 및 이용 동의를 먼저 완료해 주세요.',
      });
      return;
    }

    setIsInviteSubmitting(true);
    try {
      const redeemFn = httpsCallable(functions, 'redeemInviteCode');
      const result: any = await redeemFn({ code: values.inviteCode.trim() });

      if (result.data?.ok) {
        toast({ title: '가입 완료', description: result.data.message || '센터 가입이 완료되었습니다.' });
        setTimeout(() => window.location.reload(), 250);
      }
    } catch (error: any) {
      const message = resolveCallableErrorMessage(error, '초대 코드 가입 중 오류가 발생했습니다.');
      toast({
        variant: 'destructive',
        title: '가입 실패',
        description: message,
      });
    } finally {
      setIsInviteSubmitting(false);
    }
  }

  async function onParentLinkSubmit(values: z.infer<typeof parentLinkFormSchema>) {
    if (!user || !functions) return;

    if (needsLegalConsentPrompt) {
      setIsLegalConsentDialogOpen(true);
      toast({
        variant: 'destructive',
        title: '개인정보 동의 필요',
        description: '학생 연동 전에 현재 개인정보 수집 및 이용 동의를 먼저 완료해 주세요.',
      });
      return;
    }

    const normalizedPhone = normalizePhone(values.parentPhoneNumber || '');
    if (!isValidKoreanMobilePhone(normalizedPhone)) {
      parentLinkForm.setError('parentPhoneNumber', {
        message: '본인 휴대폰 번호를 01012345678 형식으로 입력해 주세요.',
      });
      return;
    }

    setIsParentLinkSubmitting(true);
    try {
      const completeSignupFn = httpsCallable(functions, 'completeSignupWithInvite');
      const result: any = await completeSignupFn({
        role: 'parent',
        studentLinkCode: values.studentLinkCode.trim(),
        parentPhoneNumber: normalizedPhone,
        legalConsents: buildDashboardLegalConsentsPayload(),
      });

      if (result.data?.ok) {
        toast({ title: '연동 완료', description: '학부모 계정이 학생과 연결되었습니다.' });
        setTimeout(() => window.location.reload(), 250);
      }
    } catch (error: any) {
      const message = resolveCallableErrorMessage(error, '학생 코드 연동 중 오류가 발생했습니다.');
      const lowered = message.toLowerCase();
      const isPhoneError = lowered.includes('phone') || lowered.includes('\uC804\uD654');
      if (isPhoneError) {
        parentLinkForm.setError('parentPhoneNumber', { message });
      } else {
        parentLinkForm.setError('studentLinkCode', { message });
      }
      toast({
        variant: 'destructive',
        title: '연동 실패',
        description: message,
      });
    } finally {
      setIsParentLinkSubmitting(false);
    }
  }

  const persistSelfPhoneDirectly = async (normalizedPhone: string) => {
    if (!user || !firestore) {
      throw new Error('저장 준비가 아직 끝나지 않았습니다. 잠시 후 다시 시도해 주세요.');
    }

    await setDoc(
      doc(firestore, 'users', user.uid),
      {
        phoneNumber: normalizedPhone,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  };

  const handleSavePhoneCapture = async () => {
    if (!user || !activeMembership || !firestore) {
      toast({
        variant: 'destructive',
        title: '저장 준비 중',
        description: '계정 정보를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.',
      });
      return;
    }
    const normalizedPhone = normalizePhone(phoneCaptureValue);
    if (!isValidKoreanMobilePhone(normalizedPhone)) {
      toast({
        variant: 'destructive',
        title: '전화번호 확인',
        description: '휴대폰 번호를 01012345678 형식으로 입력해 주세요.',
      });
      return;
    }

    setIsPhoneCaptureSaving(true);
    try {
      if (activeMembership.role !== 'student' && activeMembership.role !== 'parent') {
        throw new Error('학생 또는 학부모 계정에서만 전화번호를 저장할 수 있습니다.');
      }

      await persistSelfPhoneDirectly(normalizedPhone);

      setSavedPhoneFallback(normalizedPhone);
      setIsPhoneCaptureOpen(false);
      toast({
        title: '전화번호 저장 완료',
        description: '본인 전화번호가 바로 저장되었습니다.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '저장 실패',
        description: resolveCallableErrorMessage(error, '전화번호 저장 중 오류가 발생했습니다.'),
      });
    } finally {
      setIsPhoneCaptureSaving(false);
    }
  };

  const legalConsentDialog = user ? (
    <Dialog
      open={isLegalConsentDialogOpen}
      onOpenChange={(open) => {
        if (needsLegalConsentPrompt || isLegalConsentSaving) return;
        setIsLegalConsentDialogOpen(open);
      }}
    >
      <DialogContent
        className={cn(
          'rounded-[2rem] border-none p-0 shadow-2xl sm:max-w-xl',
          needsLegalConsentPrompt && '[&>button]:hidden'
        )}
        onPointerDownOutside={(event) => {
          if (needsLegalConsentPrompt) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (needsLegalConsentPrompt) event.preventDefault();
        }}
      >
        <div className="rounded-t-[2rem] bg-[#14295F] px-6 py-6 text-white sm:px-7">
          <DialogHeader className="text-left">
            <DialogTitle className="text-[1.8rem] font-black tracking-[-0.04em]">
              개인정보 처리 동의 확인
            </DialogTitle>
            <DialogDescription className="pt-2 text-sm font-bold leading-6 text-white/78">
              {LEGAL_RECONSENT_DESCRIPTION}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="grid gap-4 px-6 py-6 sm:px-7">
          <div className="rounded-[1.5rem] border border-[#14295F]/10 bg-[#f8fbff] p-4">
            <p className="text-sm font-black text-[#14295F]">현재 수집 항목</p>
            <div className="mt-3 grid gap-2 text-[11px] font-semibold leading-5 text-[#14295F]/70">
              {LEGAL_CURRENT_DATA_CATEGORIES.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>

          <div className="grid gap-3 rounded-[1.6rem] border border-[#14295F]/10 bg-[#f8fbff] p-4">
            <div className="grid gap-1">
              <p className="text-sm font-black text-[#14295F]">필수 동의</p>
              <p className="text-[11px] font-semibold leading-5 text-[#14295F]/58">
                아래 항목에 동의해야 서비스 이용을 계속할 수 있습니다.
              </p>
            </div>

            <div className="rounded-[1.25rem] border border-[#14295F]/10 bg-white px-4 py-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={legalConsentForm.termsConsent}
                  onCheckedChange={(checked) =>
                    setLegalConsentForm((prev) => ({ ...prev, termsConsent: Boolean(checked) }))
                  }
                  disabled={isLegalConsentSaving}
                  className="mt-1 h-5 w-5 rounded-md border-[#14295F]/20 data-[state=checked]:border-[#14295F] data-[state=checked]:bg-[#14295F] data-[state=checked]:text-white"
                />
                <div className="grid gap-1">
                  <p className="text-sm font-black text-[#14295F]">[필수] 이용약관에 동의합니다.</p>
                  <p className="text-[11px] font-semibold leading-5 text-[#14295F]/58">
                    {LEGAL_REQUIRED_TERMS_SUMMARY}
                  </p>
                  <Link
                    href={TERMS_ROUTE}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-black text-[#FF7A16] underline underline-offset-4"
                  >
                    이용약관 전문 보기
                  </Link>
                </div>
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-[#14295F]/10 bg-white px-4 py-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={legalConsentForm.privacyConsent}
                  onCheckedChange={(checked) =>
                    setLegalConsentForm((prev) => ({ ...prev, privacyConsent: Boolean(checked) }))
                  }
                  disabled={isLegalConsentSaving}
                  className="mt-1 h-5 w-5 rounded-md border-[#14295F]/20 data-[state=checked]:border-[#14295F] data-[state=checked]:bg-[#14295F] data-[state=checked]:text-white"
                />
                <div className="grid gap-1">
                  <p className="text-sm font-black text-[#14295F]">[필수] 개인정보 수집 및 이용에 동의합니다.</p>
                  <p className="text-[11px] font-semibold leading-5 text-[#14295F]/58">
                    {LEGAL_REQUIRED_PRIVACY_SUMMARY}
                  </p>
                  <Link
                    href={PRIVACY_ROUTE}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-black text-[#FF7A16] underline underline-offset-4"
                  >
                    개인정보처리방침 전문 보기
                  </Link>
                </div>
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-[#14295F]/10 bg-white px-4 py-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={legalConsentForm.age14Consent}
                  onCheckedChange={(checked) =>
                    setLegalConsentForm((prev) => ({ ...prev, age14Consent: Boolean(checked) }))
                  }
                  disabled={isLegalConsentSaving}
                  className="mt-1 h-5 w-5 rounded-md border-[#14295F]/20 data-[state=checked]:border-[#14295F] data-[state=checked]:bg-[#14295F] data-[state=checked]:text-white"
                />
                <div className="grid gap-1">
                  <p className="text-sm font-black text-[#14295F]">[필수] 만 14세 이상입니다.</p>
                  <p className="text-[11px] font-semibold leading-5 text-[#14295F]/58">
                    현재는 별도 법정대리인 동의 절차 없이 만 14세 이상 사용자만 계정을 이용할 수 있습니다.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 rounded-[1.6rem] border border-[#FF7A16]/12 bg-[#fff7ef] p-4">
            <div className="grid gap-1">
              <p className="text-sm font-black text-[#14295F]">선택 동의</p>
              <p className="text-[11px] font-semibold leading-5 text-[#14295F]/58">
                아래 항목은 선택이며, 동의하지 않아도 서비스 이용은 가능합니다.
              </p>
            </div>

            <div className="rounded-[1.25rem] border border-[#FF7A16]/15 bg-white px-4 py-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={legalConsentForm.marketingEmailConsent}
                  onCheckedChange={(checked) =>
                    setLegalConsentForm((prev) => ({ ...prev, marketingEmailConsent: Boolean(checked) }))
                  }
                  disabled={isLegalConsentSaving}
                  className="mt-1 h-5 w-5 rounded-md border-[#FF7A16]/28 data-[state=checked]:border-[#FF7A16] data-[state=checked]:bg-[#FF7A16] data-[state=checked]:text-white"
                />
                <div className="grid gap-1">
                  <p className="text-sm font-black text-[#14295F]">[선택] 전화·문자(필요 시 이메일)로 혜택·이벤트·신규 프로그램 안내를 받겠습니다.</p>
                  <p className="text-[11px] font-semibold leading-5 text-[#14295F]/58">
                    운영 연락과 별도로, 혜택·이벤트·신규 프로그램 안내를 전화번호 중심으로 드리며 필요 시 이메일로도 안내드립니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-[#14295F]/8 bg-[#f8fbff] px-6 py-5 sm:px-7">
          <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {!needsLegalConsentPrompt && (
              <Button
                type="button"
                variant="outline"
                className="h-12 rounded-2xl border-[#14295F]/12 font-black text-[#14295F]"
                onClick={() => setIsLegalConsentDialogOpen(false)}
                disabled={isLegalConsentSaving}
              >
                나중에 볼게요
              </Button>
            )}
            <Button
              type="button"
              className="h-12 rounded-2xl bg-[#FF7A16] font-black text-white hover:bg-[#e86d11]"
              onClick={() => void handleSaveLegalConsents()}
              disabled={isLegalConsentSaving || !requiredLegalConsentsAccepted}
            >
              {isLegalConsentSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  동의 저장 중...
                </>
              ) : (
                '동의하고 계속하기'
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ) : null;

  if (membershipsLoading) {
    return (
      <div className="flex h-[70vh] w-full flex-col items-center justify-center gap-6">
        <div className="relative">
          <Loader2 className="absolute inset-0 h-12 w-12 animate-spin text-primary opacity-20" />
          <Compass className="h-12 w-12 animate-pulse text-primary" />
        </div>
        <div className="space-y-2 text-center">
          <p className="text-xl font-black tracking-tighter text-primary">{'\uC13C\uD130 \uC815\uBCF4\uB97C \uD655\uC778\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4'}</p>
          <p className="text-sm font-bold italic text-muted-foreground">{'\uAC00\uC785 \uC9C1\uD6C4\uC5D0\uB294 \uC5F0\uB3D9\uC5D0 \uBA87 \uCD08 \uC815\uB3C4 \uC9C0\uC5F0\uB420 \uC218 \uC788\uC2B5\uB2C8\uB2E4.'}</p>
        </div>
      </div>
    );
  }

  if (activeMembership) {
    const userRole = activeMembership.role;

    if (userRole === 'kiosk') {
      return (
        <div className="flex h-[70vh] w-full flex-col items-center justify-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
          <p className="font-black tracking-tighter text-primary">키오스크 전용 모드로 전환 중...</p>
        </div>
      );
    }

    if (userRole === 'centerAdmin' || userRole === 'owner') {
      return (
        <>
          <AdminDashboard isActive={true} />
          {legalConsentDialog}
        </>
      );
    }

    if (userRole === 'teacher') {
      return (
        <>
          <AdminDashboard isActive={true} />
          {legalConsentDialog}
        </>
      );
    }

    if (userRole === 'parent') {
      return (
        <>
          <div className="flex flex-col gap-3">
            <ParentDashboard isActive={true} />
          </div>
          {legalConsentDialog}
          <Dialog open={isPhoneCaptureOpen} onOpenChange={(open) => { if (effectiveSelfPhone) setIsPhoneCaptureOpen(open); }}>
            <DialogContent className="rounded-[2.5rem] border-none p-0 shadow-2xl sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
              <div className="bg-primary px-6 py-6 text-white">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black tracking-tight">본인 전화번호 확인</DialogTitle>
                  <DialogDescription className="text-white/75 font-bold">학부모 계정은 본인 수신 번호가 필요합니다. 지금 바로 등록해 주세요.</DialogDescription>
                </DialogHeader>
              </div>
              <div className="space-y-4 p-6">
                <div className="space-y-2">
                  <Label className="text-[11px] font-black uppercase text-muted-foreground">학부모 본인 전화번호</Label>
                  <Input
                    value={phoneCaptureValue}
                    onChange={(e) => setPhoneCaptureValue(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    placeholder="01012345678"
                    className="h-12 rounded-xl border-2 font-black tracking-tight"
                    maxLength={11}
                  />
                </div>
              </div>
              <DialogFooter className="border-t bg-muted/10 p-6">
                <Button onClick={handleSavePhoneCapture} disabled={isPhoneCaptureSaving} className="h-12 w-full rounded-2xl font-black">
                  {isPhoneCaptureSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Phone className="mr-2 h-4 w-4" />}
                  전화번호 저장
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      );
    }

    return (
      <>
        <div className={cn('flex flex-col', isMobile ? 'gap-4' : 'gap-8')}>
          <StudentDashboard isActive={true} />
        </div>
        {legalConsentDialog}
        <Dialog open={isPhoneCaptureOpen} onOpenChange={(open) => { if (effectiveSelfPhone) setIsPhoneCaptureOpen(open); }}>
          <DialogContent className="rounded-[2.5rem] border-none p-0 shadow-2xl sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
            <div className="bg-primary px-6 py-6 text-white">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black tracking-tight">본인 전화번호 등록</DialogTitle>
                <DialogDescription className="text-white/75 font-bold">학생 계정은 본인 번호가 필요합니다. 누락된 번호를 지금 바로 추가해 주세요.</DialogDescription>
              </DialogHeader>
            </div>
            <div className="space-y-4 p-6">
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase text-muted-foreground">학생 본인 전화번호</Label>
                <Input
                  value={phoneCaptureValue}
                  onChange={(e) => setPhoneCaptureValue(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="01012345678"
                  className="h-12 rounded-xl border-2 font-black tracking-tight"
                  maxLength={11}
                />
              </div>
            </div>
            <DialogFooter className="border-t bg-muted/10 p-6">
              <Button onClick={handleSavePhoneCapture} disabled={isPhoneCaptureSaving} className="h-12 w-full rounded-2xl font-black">
                {isPhoneCaptureSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Phone className="mr-2 h-4 w-4" />}
                전화번호 저장
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      {legalConsentDialog}
      <div className="flex min-h-[70vh] flex-col items-center justify-center space-y-10 px-4 text-center">
        <div className="space-y-4">
          <div className="mx-auto w-fit rounded-[2.5rem] bg-primary/10 p-6 shadow-inner">
            <Sparkles className="h-12 w-12 animate-bounce text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-black tracking-tighter">{'\uC544\uC9C1 \uC18C\uC18D\uB41C \uC13C\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4'}</h1>
            <p className="mx-auto max-w-sm font-bold leading-relaxed text-muted-foreground">
              {'\uAC00\uC785 \uC9C1\uD6C4\uC5D0\uB294 \uC815\uBCF4 \uB3D9\uAE30\uD654\uAC00 \uB2A6\uC5B4\uC9C8 \uC218 \uC788\uC2B5\uB2C8\uB2E4.'}
              <br />
              {'\uB2E4\uC2DC \uD655\uC778\uC744 \uB204\uB974\uAC70\uB098 \uCF54\uB4DC\uB97C \uB2E4\uC2DC \uC785\uB825\uD574 \uC8FC\uC138\uC694.'}
            </p>
          </div>
        </div>

        <div className="grid w-full max-w-xl gap-3 sm:grid-cols-3">
          <Button
            variant="outline"
            size="lg"
            className="h-14 rounded-2xl border-2 text-base font-black shadow-sm"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="mr-2 h-5 w-5" /> {'\uB2E4\uC2DC \uD655\uC778'}
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button size="lg" className="h-14 rounded-2xl text-base font-black shadow-xl">
                {'\uCD08\uB300 \uCF54\uB4DC\uB85C \uAC00\uC785'}
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[2.5rem] border-none p-8 shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-3xl font-black tracking-tighter">{'\uCD08\uB300 \uCF54\uB4DC \uC785\uB825'}</DialogTitle>
                <DialogDescription className="pt-2 font-bold">
                  {'\uC13C\uD130\uC5D0\uC11C \uBC1B\uC740 \uCD08\uB300 \uCF54\uB4DC\uB85C \uAC00\uC785\uC744 \uC644\uB8CC\uD569\uB2C8\uB2E4.'}
                </DialogDescription>
              </DialogHeader>
              <Form {...inviteForm}>
                <form onSubmit={inviteForm.handleSubmit(onInviteSubmit)} className="space-y-6 pt-4">
                <FormField
                  control={inviteForm.control}
                  name="inviteCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-black uppercase tracking-widest text-primary/70">
                         {'\uCD08\uB300 \uCF54\uB4DC'}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={'\uC608: 0313'}
                          {...field}
                          className="h-14 rounded-xl border-2 text-xl font-black tracking-widest"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={isInviteSubmitting} className="h-14 w-full rounded-2xl text-lg font-black shadow-lg">
                    {isInviteSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : '\uC13C\uD130 \uAC00\uC785 \uC644\uB8CC'}
                  </Button>
                </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

        <Dialog>
          <DialogTrigger asChild>
            <Button size="lg" variant="secondary" className="h-14 rounded-2xl text-base font-black shadow-xl">
              <Link2 className="mr-2 h-5 w-5" /> 학부모 코드 연동
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[2.5rem] border-none p-8 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-3xl font-black tracking-tighter">학부모 자녀코드 연동</DialogTitle>
              <DialogDescription className="pt-2 font-bold">
                학생 계정의 6자리 코드를 입력하면 학부모 계정과 즉시 연결됩니다.
              </DialogDescription>
            </DialogHeader>
            <Form {...parentLinkForm}>
              <form onSubmit={parentLinkForm.handleSubmit(onParentLinkSubmit)} className="space-y-6 pt-4">
                <FormField
                  control={parentLinkForm.control}
                  name="studentLinkCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-black uppercase tracking-widest text-primary/70">
                        학생 코드(6자리)
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="123456"
                          maxLength={6}
                          {...field}
                          className="h-14 rounded-xl border-2 text-center text-xl font-black tracking-[0.4em]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={parentLinkForm.control}
                  name="parentPhoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-black uppercase tracking-widest text-primary/70">
                        학부모 본인 전화번호
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Phone className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/40" />
                          <Input
                            placeholder="01012345678"
                            maxLength={11}
                            {...field}
                            className="h-14 rounded-xl border-2 pl-11 text-base font-black"
                          />
                        </div>
                      </FormControl>
                      <p className="text-[10px] font-bold text-muted-foreground">
                        학생 연동과 문자 수신을 위해 필수 입력입니다.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="submit" disabled={isParentLinkSubmitting} className="h-14 w-full rounded-2xl text-lg font-black shadow-lg">
                    {isParentLinkSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : '학생과 연동하기'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        </div>
      </div>
    </>
  );
}

