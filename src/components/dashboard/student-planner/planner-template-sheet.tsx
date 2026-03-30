'use client';

import { BookmarkPlus, Copy, Loader2, Pencil, Sparkles, Trash2 } from 'lucide-react';

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
import { cn } from '@/lib/utils';
import type { PlannerTemplateRecord } from '@/lib/plan-track';

type PlannerTemplateSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMobile: boolean;
  currentTaskCount: number;
  templateName: string;
  onTemplateNameChange: (value: string) => void;
  onSaveCurrent: () => void;
  isSaving: boolean;
  editingTemplateId: string | null;
  onCancelEditing: () => void;
  recentTemplates: PlannerTemplateRecord[];
  builtinTemplates: PlannerTemplateRecord[];
  customTemplates: PlannerTemplateRecord[];
  onApplyTemplate: (template: PlannerTemplateRecord) => void;
  onStartEditing: (template: PlannerTemplateRecord) => void;
  onDeleteTemplate: (template: PlannerTemplateRecord) => void;
};

function TemplateItemCard({
  item,
  isMobile,
  onApply,
  onEdit,
  onDelete,
}: {
  item: PlannerTemplateRecord;
  isMobile: boolean;
  onApply: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="rounded-[1.35rem] border border-slate-200 bg-white/90 p-4 shadow-[0_18px_40px_-34px_rgba(20,41,95,0.16)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black tracking-tight text-slate-900">{item.name}</p>
            <Badge className={cn(
              'rounded-full px-2.5 py-0.5 text-[9px] font-black shadow-none',
              item.kind === 'builtin'
                ? 'border border-primary/10 bg-primary/5 text-primary'
                : 'border border-emerald-100 bg-emerald-50 text-emerald-700'
            )}>
              {item.kind === 'builtin' ? '기본' : '내 템플릿'}
            </Badge>
          </div>
          <p className="mt-1 break-keep text-[11px] font-semibold leading-5 text-slate-500">{item.description}</p>
          <p className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
            {item.tasks.length}개 항목
          </p>
        </div>
      </div>

      <div className={cn('mt-4 flex gap-2', isMobile ? 'flex-col' : 'flex-row')}>
        <Button
          type="button"
          onClick={onApply}
          className="h-10 flex-1 rounded-xl bg-primary font-black text-white hover:bg-primary/90"
        >
          <Copy className="mr-2 h-3.5 w-3.5" />
          오늘 계획에 적용
        </Button>
        {onEdit ? (
          <Button
            type="button"
            variant="outline"
            onClick={onEdit}
            className="h-10 rounded-xl border-slate-200 bg-white text-xs font-black text-slate-700"
          >
            <Pencil className="mr-2 h-3.5 w-3.5" />
            이름 수정
          </Button>
        ) : null}
        {onDelete ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onDelete}
            className="h-10 rounded-xl text-xs font-black text-slate-400 hover:text-destructive"
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            삭제
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function PlannerTemplateSheet({
  open,
  onOpenChange,
  isMobile,
  currentTaskCount,
  templateName,
  onTemplateNameChange,
  onSaveCurrent,
  isSaving,
  editingTemplateId,
  onCancelEditing,
  recentTemplates,
  builtinTemplates,
  customTemplates,
  onApplyTemplate,
  onStartEditing,
  onDeleteTemplate,
}: PlannerTemplateSheetProps) {
  const saveLabel = editingTemplateId ? '템플릿 수정' : '현재 계획 저장';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        motionPreset="dashboard-premium"
        className={cn(
          'overflow-hidden border-none bg-white p-0 shadow-2xl',
          isMobile
            ? 'w-[min(94vw,36rem)] max-h-[90dvh] rounded-[2rem]'
            : 'w-[min(92vw,48rem)] max-w-[48rem] max-h-[88dvh] rounded-[2rem]'
        )}
      >
        <div className="bg-[linear-gradient(135deg,#14295F_0%,#173A82_55%,#FF7A16_100%)] p-6 text-white">
          <DialogHeader className="text-left">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/12 p-2.5">
                <BookmarkPlus className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-xl font-black tracking-tight text-white">
                  템플릿 보관함
                </DialogTitle>
                <DialogDescription className="mt-1 text-[11px] font-semibold text-white/76">
                  자주 쓰는 계획을 저장해두고, 오늘 계획에 바로 불러와요.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className={cn('overflow-y-auto bg-white', isMobile ? 'max-h-[calc(90dvh-9rem)] p-4' : 'max-h-[calc(88dvh-9rem)] p-5')}>
          <div className="rounded-[1.45rem] border border-primary/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(247,250,255,0.94)_100%)] p-4 shadow-[0_18px_40px_-34px_rgba(20,41,95,0.18)]">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-primary/8 p-2 text-primary">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black tracking-tight text-slate-900">
                  오늘 계획을 템플릿으로 저장
                </p>
                <p className="mt-1 break-keep text-[11px] font-semibold leading-5 text-slate-500">
                  지금 만든 계획 {currentTaskCount}개를 다음에도 바로 불러올 수 있게 저장해요.
                </p>
              </div>
            </div>
            <div className={cn('mt-4 flex gap-2', isMobile ? 'flex-col' : 'items-center')}>
              <Input
                value={templateName}
                onChange={(event) => onTemplateNameChange(event.target.value)}
                placeholder="예: 학교 끝나고 기본 루틴"
                className="h-11 rounded-xl border-slate-200 font-bold"
              />
              <Button
                type="button"
                onClick={onSaveCurrent}
                disabled={isSaving || currentTaskCount === 0 || !templateName.trim()}
                className="h-11 rounded-xl bg-primary font-black text-white hover:bg-primary/90"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : saveLabel}
              </Button>
              {editingTemplateId ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancelEditing}
                  className="h-11 rounded-xl border-slate-200 font-black"
                >
                  취소
                </Button>
              ) : null}
            </div>
          </div>

          {recentTemplates.length > 0 ? (
            <section className="mt-5 space-y-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">최근 사용</p>
                <h3 className="mt-1 text-lg font-black tracking-tight text-slate-900">다시 불러오기</h3>
              </div>
              <div className="space-y-3">
                {recentTemplates.map((template) => (
                  <TemplateItemCard
                    key={template.id}
                    item={template}
                    isMobile={isMobile}
                    onApply={() => onApplyTemplate(template)}
                    onEdit={template.kind === 'custom' ? () => onStartEditing(template) : undefined}
                    onDelete={template.kind === 'custom' ? () => onDeleteTemplate(template) : undefined}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-5 space-y-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">기본 템플릿</p>
              <h3 className="mt-1 text-lg font-black tracking-tight text-slate-900">바로 시작</h3>
            </div>
            <div className="space-y-3">
              {builtinTemplates.map((template) => (
                <TemplateItemCard
                  key={template.id}
                  item={template}
                  isMobile={isMobile}
                  onApply={() => onApplyTemplate(template)}
                />
              ))}
            </div>
          </section>

          <section className="mt-5 space-y-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">내 템플릿</p>
              <h3 className="mt-1 text-lg font-black tracking-tight text-slate-900">반복해서 쓰는 계획</h3>
            </div>
            {customTemplates.length === 0 ? (
              <div className="rounded-[1.35rem] border border-dashed border-slate-200 bg-slate-50/70 p-5 text-center">
                <p className="text-sm font-black text-slate-700">아직 저장한 템플릿이 없어요</p>
                <p className="mt-2 text-[11px] font-semibold leading-5 text-slate-500">
                  오늘 계획을 한 번 저장해두면 다음부터는 복사만으로 시작할 수 있어요.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {customTemplates.map((template) => (
                  <TemplateItemCard
                    key={template.id}
                    item={template}
                    isMobile={isMobile}
                    onApply={() => onApplyTemplate(template)}
                    onEdit={() => onStartEditing(template)}
                    onDelete={() => onDeleteTemplate(template)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        <DialogFooter className="border-t bg-slate-50/60 p-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-11 w-full rounded-xl border-2 font-black"
          >
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
