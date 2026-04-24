'use client';

import type { ChangeEvent } from 'react';
import { AlertCircle, Loader2, Upload, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ATTENDANCE_REQUEST_PROOF_LIMIT,
  SCHEDULE_CHANGE_REASON_OPTIONS,
  shouldWaiveScheduleChangePenalty,
} from '@/lib/attendance-request';
import type { AttendanceRequestReasonCategory } from '@/lib/types';
import { cn } from '@/lib/utils';

type ProofDraft = {
  id: string;
  name: string;
  previewUrl: string;
};

type SameDayScheduleChangeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  selectedDateLabel: string;
  scheduleSummary: string;
  actionLabel: string;
  penaltyPoints: number;
  reasonCategory: AttendanceRequestReasonCategory;
  onReasonCategoryChange: (value: AttendanceRequestReasonCategory) => void;
  reason: string;
  onReasonChange: (value: string) => void;
  proofDrafts: ProofDraft[];
  onProofInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveProof: (proofId: string) => void;
  onConfirm: () => void;
};

export function SameDayScheduleChangeDialog({
  open,
  onOpenChange,
  isSubmitting,
  selectedDateLabel,
  scheduleSummary,
  actionLabel,
  penaltyPoints,
  reasonCategory,
  onReasonCategoryChange,
  reason,
  onReasonChange,
  proofDrafts,
  onProofInputChange,
  onRemoveProof,
  onConfirm,
}: SameDayScheduleChangeDialogProps) {
  const proofRequired = reasonCategory === 'hospital';
  const penaltyWaived = shouldWaiveScheduleChangePenalty(reasonCategory, proofDrafts.length);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !isSubmitting && onOpenChange(nextOpen)}>
      <DialogContent className="w-[min(92vw,34rem)] rounded-[1.8rem] border border-[#E5ECF7] bg-white p-0 shadow-[0_24px_60px_-30px_rgba(20,41,95,0.32)]">
        <div className="rounded-t-[1.8rem] bg-[linear-gradient(180deg,#17326B_0%,#21448D_100%)] px-6 py-5 text-white">
          <DialogHeader className="text-left">
            <DialogTitle className="text-xl font-black tracking-tight text-white">당일 등하원 변경 사유 확인</DialogTitle>
            <DialogDescription className="mt-1 break-keep text-[12px] font-semibold leading-5 text-white/72">
              {selectedDateLabel} 일정은 당일 변경 정책에 따라 사유와 증빙을 함께 남겨야 해요.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-[1.2rem] border border-[#E6EDF8] bg-[#F8FBFF] px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F739F]">변경 예정</p>
                <p className="mt-1 text-sm font-black text-[#17326B]">{actionLabel}</p>
              </div>
              <Badge
                className={cn(
                  'rounded-full border px-3 py-1 text-[10px] font-black shadow-none',
                  penaltyWaived
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-[#FFD1A1] bg-[#FFF0DD] text-[#FF8A1F]'
                )}
              >
                {penaltyWaived ? '벌점 면제 조건 충족' : `벌점 +${penaltyPoints}`}
              </Badge>
            </div>
            <p className="mt-2 text-[12px] font-semibold leading-5 text-[#17326B]">{scheduleSummary}</p>
          </div>

          <div className="space-y-1.5">
            <Label className="ml-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#5F739F]">변경 사유 유형</Label>
            <Select value={reasonCategory} onValueChange={(value) => onReasonCategoryChange(value as AttendanceRequestReasonCategory)}>
              <SelectTrigger className="h-12 rounded-xl border-[#D6E1F6] bg-white font-black text-[#17326B]">
                <SelectValue placeholder="사유를 선택해 주세요" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {SCHEDULE_CHANGE_REASON_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="ml-1 text-[11px] font-semibold leading-5 text-[#5F739F]">
              {SCHEDULE_CHANGE_REASON_OPTIONS.find((option) => option.value === reasonCategory)?.description}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="ml-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#5F739F]">상세 사유</Label>
            <textarea
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              disabled={isSubmitting}
              placeholder="왜 당일 변경이 필요한지 간단히 적어주세요."
              className="min-h-[110px] w-full rounded-[1rem] border border-[#D6E1F6] bg-white px-4 py-3 text-sm font-semibold text-[#17326B] outline-none placeholder:text-[#8C9BBC]"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <Label className="ml-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#5F739F]">병원 증빙 사진</Label>
                <p className="ml-1 mt-1 text-[11px] font-semibold leading-5 text-[#5F739F]">
                  병원 사유는 약봉지, 처방전, 진료 확인 자료가 있어야 벌점이 면제돼요.
                </p>
              </div>
              <Badge variant="outline" className="rounded-full border-[#D8E4FB] bg-[#F8FBFF] text-[10px] font-black text-[#5F739F]">
                {proofDrafts.length}/{ATTENDANCE_REQUEST_PROOF_LIMIT}
              </Badge>
            </div>

            <label className={cn(
              'flex cursor-pointer items-center justify-center gap-2 rounded-[1rem] border border-dashed px-4 py-4 text-sm font-black transition-colors',
              proofRequired ? 'border-[#FFB168] bg-[#FFF8EF] text-[#D86A11]' : 'border-[#D8E4FB] bg-[#F8FBFF] text-[#17326B]'
            )}>
              <Upload className="h-4 w-4" />
              사진 올리기
              <Input
                type="file"
                accept="image/*"
                multiple
                onChange={onProofInputChange}
                disabled={isSubmitting || proofDrafts.length >= ATTENDANCE_REQUEST_PROOF_LIMIT}
                className="hidden"
              />
            </label>

            {proofRequired && proofDrafts.length === 0 ? (
              <div className="rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <p className="text-[11px] font-semibold leading-5 text-amber-700">
                    병원 사유인데 증빙이 아직 없어요. 지금 제출하면 변경은 저장되지만 벌점은 면제되지 않습니다.
                  </p>
                </div>
              </div>
            ) : null}

            {proofDrafts.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {proofDrafts.map((proof) => (
                  <div key={proof.id} className="overflow-hidden rounded-[1rem] border border-[#D8E4FB] bg-white">
                    <img src={proof.previewUrl} alt={proof.name} className="h-28 w-full object-cover" />
                    <div className="flex items-center justify-between gap-2 px-3 py-2">
                      <p className="min-w-0 truncate text-[11px] font-black text-[#17326B]">{proof.name}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onRemoveProof(proof.id)}
                        disabled={isSubmitting}
                        className="h-7 w-7 rounded-full text-[#8C9BBC] hover:bg-rose-50 hover:text-rose-500"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 border-t border-[#EEF3FB] bg-[#FCFDFF] px-6 py-4 sm:flex-col">
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="h-12 w-full rounded-[1rem] bg-[linear-gradient(135deg,#FF9A2B_0%,#FF7A16_100%)] font-black text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                저장 중
              </>
            ) : (
              '사유와 함께 저장'
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
            className="h-11 w-full rounded-[1rem] border-[#D6E1F3] font-black text-[#17326B]"
          >
            나중에 수정할게요
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
