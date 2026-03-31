'use client';

import { useEffect, useMemo, useState } from 'react';
import { Lock, ShieldCheck, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  buildRoutineVisibilityPreview,
  MOCK_STUDY_GROUPS,
  ROUTINE_VISIBILITY_DESCRIPTIONS,
  ROUTINE_VISIBILITY_LABELS,
} from '@/lib/routine-social';
import { type RoutineSocialProfile, type RoutineVisibility, type UserStudyProfile } from '@/lib/types';
import { cn } from '@/lib/utils';

type RoutinePrivacySheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  socialProfile: RoutineSocialProfile;
  studyProfile?: UserStudyProfile | null;
  studentName?: string | null;
  schoolName?: string | null;
  gradeLabel?: string | null;
  onSave: (nextProfile: RoutineSocialProfile) => void;
};

const visibilityOrder: RoutineVisibility[] = ['private', 'friends', 'group', 'anonymous', 'profile'];

export function RoutinePrivacySheet({
  open,
  onOpenChange,
  socialProfile,
  studyProfile,
  studentName,
  schoolName,
  gradeLabel,
  onSave,
}: RoutinePrivacySheetProps) {
  const [draft, setDraft] = useState<RoutineSocialProfile>(socialProfile);

  useEffect(() => {
    if (open) setDraft(socialProfile);
  }, [open, socialProfile]);

  const preview = useMemo(
    () =>
      buildRoutineVisibilityPreview({
        socialProfile: draft,
        studyProfile,
        studentName,
        schoolName,
        gradeLabel,
      }),
    [draft, gradeLabel, schoolName, studentName, studyProfile]
  );
  const isSaveDisabled = draft.visibility === 'group' && draft.selectedGroupIds.length === 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92svh] rounded-t-[2rem] border-x-0 border-b-0 px-5 pb-6 pt-10 sm:max-w-none">
        <SheetHeader className="space-y-2">
          <SheetTitle className="text-[1.4rem] font-black tracking-[-0.04em] text-[#17326B]">공유 설정</SheetTitle>
          <SheetDescription className="text-[13px] font-semibold leading-6 text-[#64779D]">
            기본값은 나만 보기입니다. 원할 때만 친구, 그룹, 익명 공개를 선택하고,
            공개 전에 어떤 정보가 보이는지 미리 확인할 수 있어요.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4 overflow-y-auto pb-2">
          <div className="space-y-2">
            <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#17326B]">공개 범위</p>
            <div className="space-y-3">
              {visibilityOrder.map((visibility) => (
                <button
                  key={visibility}
                  type="button"
                  onClick={() => setDraft((current) => ({ ...current, visibility }))}
                  className={cn(
                    'w-full rounded-[1.2rem] border px-4 py-4 text-left transition-all',
                    draft.visibility === visibility
                      ? 'border-[rgba(255,138,31,0.35)] bg-[linear-gradient(180deg,rgba(255,245,232,0.98)_0%,rgba(255,234,210,0.92)_100%)] shadow-[0_18px_36px_-28px_rgba(255,138,31,0.5)]'
                      : 'border-[rgba(20,41,95,0.08)] bg-white'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[14px] font-black text-[#17326B]">{ROUTINE_VISIBILITY_LABELS[visibility]}</p>
                      <p className="mt-2 text-[12px] font-semibold leading-5 text-[#5F7597]">{ROUTINE_VISIBILITY_DESCRIPTIONS[visibility]}</p>
                    </div>
                    {draft.visibility === visibility ? (
                      <ShieldCheck className="mt-0.5 h-4 w-4 text-[#FF8A1F]" />
                    ) : (
                      <Lock className="mt-0.5 h-4 w-4 text-[#8EA2C0]" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {(draft.visibility === 'anonymous' || draft.visibility === 'group' || draft.visibility === 'friends') ? (
            <div className="space-y-2">
              <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#17326B]">표시될 별칭</p>
              <Input
                value={draft.previewAlias}
                onChange={(event) => setDraft((current) => ({ ...current, previewAlias: event.target.value }))}
                placeholder="예: 저녁몰입 고2"
              />
            </div>
          ) : null}

          {draft.visibility === 'group' ? (
            <div className="space-y-2">
              <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#17326B]">공개할 그룹 선택</p>
              <div className="space-y-3">
                {MOCK_STUDY_GROUPS.map((group) => {
                  const isSelected = draft.selectedGroupIds.includes(group.id);
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          selectedGroupIds: isSelected
                            ? current.selectedGroupIds.filter((id) => id !== group.id)
                            : [...current.selectedGroupIds, group.id],
                        }))
                      }
                      className={cn(
                        'w-full rounded-[1.2rem] border px-4 py-4 text-left transition-all',
                        isSelected
                          ? 'border-[rgba(20,41,95,0.18)] bg-[#17326B] text-white'
                          : 'border-[rgba(20,41,95,0.08)] bg-white text-[#17326B]'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[14px] font-black">{group.name}</p>
                          <p className={cn('mt-2 text-[12px] font-semibold leading-5', isSelected ? 'text-white/80' : 'text-[#5F7597]')}>
                            {group.description}
                          </p>
                        </div>
                        <div className={cn('rounded-full px-3 py-1 text-[11px] font-black', isSelected ? 'bg-white/12 text-white' : 'bg-[#F5F8FF] text-[#17326B]')}>
                          {group.memberCount}명
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="rounded-[1.4rem] border border-[rgba(20,41,95,0.08)] bg-[#F8FBFF] px-4 py-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[#FF8A1F]" />
              <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#17326B]">공개 미리보기</p>
            </div>
            <div className="mt-4 rounded-[1.2rem] border border-[rgba(20,41,95,0.08)] bg-white px-4 py-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8EA2C0]">{preview.title}</p>
              <p className="mt-2 text-[1.05rem] font-black text-[#17326B]">{preview.authorLabel}</p>
              <p className="mt-2 text-[12px] font-semibold leading-5 text-[#5F7597]">{preview.metaLabel}</p>
              <p className="mt-3 text-[13px] font-semibold leading-6 text-[#17326B]">{preview.subtitle}</p>
            </div>
          </div>

          <div className="rounded-[1.2rem] border border-[rgba(255,138,31,0.16)] bg-[linear-gradient(180deg,rgba(255,251,246,0.98)_0%,rgba(255,245,232,0.94)_100%)] px-4 py-4">
            <p className="text-[12px] font-bold leading-6 text-[#17326B]">
              안전장치: 전교 랭킹, 성적 비교, 실패 노출 UI는 제공하지 않습니다. 공개해도 루틴 구조와 회고 팁 중심으로만 보입니다.
            </p>
          </div>
        </div>

        <SheetFooter className="mt-6 flex-col gap-3 sm:flex-col sm:space-x-0">
          <Button
            variant="secondary"
            size="lg"
            className="h-12 rounded-[1rem]"
            onClick={() => onSave(draft)}
            disabled={isSaveDisabled}
          >
            공유 설정 저장
          </Button>
          <Button variant="default" size="lg" className="h-12 rounded-[1rem]" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
