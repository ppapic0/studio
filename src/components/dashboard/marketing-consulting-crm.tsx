'use client';

import { useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  Download,
  Loader2,
  Megaphone,
  Phone,
  PlusCircle,
  Save,
  Search,
  Trash2,
  UserRoundPlus,
} from 'lucide-react';
import { format } from 'date-fns';

import { useCollection, useFirestore, useUser } from '@/firebase';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type LeadStatus = 'new' | 'contacted' | 'consulted' | 'enrolled' | 'closed';

interface ConsultingLead {
  id: string;
  studentName: string;
  parentName: string;
  parentPhone: string;
  studentPhone?: string;
  marketingChannel: string;
  consultationDate: string;
  status: LeadStatus;
  memo?: string;
  createdAt?: any;
  updatedAt?: any;
  createdByUid?: string;
}

interface LeadFormState {
  studentName: string;
  parentName: string;
  parentPhone: string;
  studentPhone: string;
  marketingChannel: string;
  consultationDate: string;
  status: LeadStatus;
  memo: string;
}

const STATUS_META: Record<LeadStatus, { label: string; className: string }> = {
  new: { label: '신규', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  contacted: { label: '연락완료', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  consulted: { label: '상담완료', className: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  enrolled: { label: '등록완료', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  closed: { label: '보류/종결', className: 'bg-slate-100 text-slate-700 border-slate-200' },
};

const CHANNEL_OPTIONS = [
  '온라인 광고',
  '블로그/인스타',
  '지인 소개',
  '전단지',
  '오프라인 배너',
  '기타',
];

const INITIAL_FORM = (): LeadFormState => ({
  studentName: '',
  parentName: '',
  parentPhone: '',
  studentPhone: '',
  marketingChannel: '온라인 광고',
  consultationDate: format(new Date(), 'yyyy-MM-dd'),
  status: 'new',
  memo: '',
});

function toDateMs(value: any): number {
  if (!value) return 0;
  if (typeof value?.toDate === 'function') {
    const parsed = value.toDate();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : 0;
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? 0 : value.getTime();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function csvEscape(value: unknown): string {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function MarketingConsultingCRM({
  centerId,
  isMobile,
}: {
  centerId?: string;
  isMobile?: boolean;
}) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [form, setForm] = useState<LeadFormState>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | LeadStatus>('all');

  const leadsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'consultingLeads'),
      orderBy('createdAt', 'desc'),
      limit(500)
    );
  }, [firestore, centerId]);
  const { data: leadsRaw, isLoading } = useCollection<ConsultingLead>(leadsQuery, {
    enabled: !!centerId,
  });

  const leads = useMemo(() => {
    return [...(leadsRaw || [])].sort((a, b) => toDateMs(b.createdAt) - toDateMs(a.createdAt));
  }, [leadsRaw]);

  const filteredLeads = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesStatus = statusFilter === 'all' ? true : lead.status === statusFilter;
      if (!matchesStatus) return false;
      if (!keyword) return true;

      const haystack = [
        lead.studentName,
        lead.parentName,
        lead.parentPhone,
        lead.studentPhone,
        lead.marketingChannel,
        lead.memo,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [leads, searchTerm, statusFilter]);

  const summary = useMemo(() => {
    const total = leads.length;
    const enrolled = leads.filter((lead) => lead.status === 'enrolled').length;
    const consulted = leads.filter((lead) => lead.status === 'consulted').length;
    const conversionRate = total > 0 ? (enrolled / total) * 100 : 0;

    const channelCount = new Map<string, number>();
    for (const lead of leads) {
      const key = lead.marketingChannel || '기타';
      channelCount.set(key, (channelCount.get(key) || 0) + 1);
    }
    const channels = Array.from(channelCount.entries())
      .map(([channel, count]) => ({ channel, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return { total, enrolled, consulted, conversionRate, channels };
  }, [leads]);

  const resetForm = () => {
    setForm(INITIAL_FORM());
    setEditingId(null);
  };

  const handleEdit = (lead: ConsultingLead) => {
    setEditingId(lead.id);
    setForm({
      studentName: lead.studentName || '',
      parentName: lead.parentName || '',
      parentPhone: lead.parentPhone || '',
      studentPhone: lead.studentPhone || '',
      marketingChannel: lead.marketingChannel || '온라인 광고',
      consultationDate: lead.consultationDate || format(new Date(), 'yyyy-MM-dd'),
      status: lead.status || 'new',
      memo: lead.memo || '',
    });
  };

  const handleSave = async () => {
    if (!firestore || !centerId) return;
    if (!form.studentName.trim() && !form.parentName.trim()) {
      toast({
        variant: 'destructive',
        title: '입력 필요',
        description: '학생 이름 또는 학부모 이름을 입력해 주세요.',
      });
      return;
    }
    if (!form.parentPhone.trim()) {
      toast({
        variant: 'destructive',
        title: '입력 필요',
        description: '학부모 전화번호를 입력해 주세요.',
      });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        studentName: form.studentName.trim(),
        parentName: form.parentName.trim(),
        parentPhone: form.parentPhone.trim(),
        studentPhone: form.studentPhone.trim(),
        marketingChannel: form.marketingChannel,
        consultationDate: form.consultationDate,
        status: form.status,
        memo: form.memo.trim(),
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(firestore, 'centers', centerId, 'consultingLeads', editingId), payload);
        toast({ title: '상담 리드가 수정되었습니다.' });
      } else {
        await addDoc(collection(firestore, 'centers', centerId, 'consultingLeads'), {
          ...payload,
          createdAt: serverTimestamp(),
          createdByUid: user?.uid || null,
        });
        toast({ title: '상담 리드가 등록되었습니다.' });
      }

      resetForm();
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: '저장 실패',
        description: '상담 리드 저장 중 오류가 발생했습니다.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (leadId: string) => {
    if (!firestore || !centerId) return;
    try {
      await deleteDoc(doc(firestore, 'centers', centerId, 'consultingLeads', leadId));
      if (editingId === leadId) resetForm();
      toast({ title: '리드가 삭제되었습니다.' });
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: '삭제 실패',
        description: '리드 삭제 중 오류가 발생했습니다.',
      });
    }
  };

  const handleQuickStatusUpdate = async (leadId: string, nextStatus: LeadStatus) => {
    if (!firestore || !centerId) return;
    try {
      await updateDoc(doc(firestore, 'centers', centerId, 'consultingLeads', leadId), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: '상태 변경 실패',
        description: '상태 변경 중 오류가 발생했습니다.',
      });
    }
  };

  const exportToCsv = () => {
    const headers = [
      '상담일',
      '상태',
      '홍보채널',
      '학생명',
      '학생전화번호',
      '학부모명',
      '학부모전화번호',
      '메모',
    ];

    const rows = filteredLeads.map((lead) => [
      lead.consultationDate || '',
      STATUS_META[lead.status || 'new']?.label || '',
      lead.marketingChannel || '',
      lead.studentName || '',
      lead.studentPhone || '',
      lead.parentName || '',
      lead.parentPhone || '',
      lead.memo || '',
    ]);

    const csvContent =
      '\uFEFF' +
      [headers, ...rows]
        .map((row) => row.map((cell) => csvEscape(cell)).join(','))
        .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `상담DB_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!centerId) {
    return (
      <Card className="rounded-2xl border-none shadow-sm ring-1 ring-border/50">
        <CardContent className="p-6 text-sm font-semibold text-muted-foreground">
          센터 정보가 없어 상담 DB를 불러올 수 없습니다.
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-4">
      <Card className="rounded-2xl border-none shadow-sm ring-1 ring-border/50">
        <CardHeader className={cn(isMobile ? 'p-5' : 'p-6')}>
          <div className={cn('flex items-start justify-between gap-3', isMobile ? 'flex-col' : 'flex-row')}>
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg font-black">
                <Megaphone className="h-5 w-5 text-primary" />
                홍보/상담 리드 DB
              </CardTitle>
              <CardDescription className="font-semibold">
                상담 온 학생/학부모 연락처를 입력하고 상태를 추적하는 CRM입니다.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl font-black"
              onClick={exportToCsv}
              disabled={filteredLeads.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              엑셀 다운로드 (CSV)
            </Button>
          </div>
        </CardHeader>
        <CardContent className={cn('space-y-4', isMobile ? 'p-5 pt-0' : 'p-6 pt-0')}>
          <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'md:grid-cols-4')}>
            <Card className="rounded-xl border-none bg-primary text-primary-foreground shadow-sm">
              <CardContent className="p-4">
                <p className="text-[11px] font-bold opacity-80">전체 리드</p>
                <p className="mt-1 text-2xl font-black">{summary.total}</p>
              </CardContent>
            </Card>
            <Card className="rounded-xl border-none shadow-sm ring-1 ring-border/50">
              <CardContent className="p-4">
                <p className="text-[11px] font-bold text-muted-foreground">상담완료</p>
                <p className="mt-1 text-2xl font-black text-indigo-600">{summary.consulted}</p>
              </CardContent>
            </Card>
            <Card className="rounded-xl border-none shadow-sm ring-1 ring-border/50">
              <CardContent className="p-4">
                <p className="text-[11px] font-bold text-muted-foreground">등록완료</p>
                <p className="mt-1 text-2xl font-black text-emerald-600">{summary.enrolled}</p>
              </CardContent>
            </Card>
            <Card className="rounded-xl border-none shadow-sm ring-1 ring-border/50">
              <CardContent className="p-4">
                <p className="text-[11px] font-bold text-muted-foreground">전환율</p>
                <p className="mt-1 text-2xl font-black">{summary.conversionRate.toFixed(1)}%</p>
              </CardContent>
            </Card>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
            <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-500">홍보 채널 TOP</p>
            <div className="flex flex-wrap gap-2">
              {summary.channels.length === 0 ? (
                <span className="text-xs font-semibold text-slate-400">아직 입력된 리드가 없습니다.</span>
              ) : (
                summary.channels.map((item) => (
                  <Badge key={item.channel} variant="outline" className="rounded-full px-3 py-1 text-[11px] font-black">
                    {item.channel} {item.count}건
                  </Badge>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 p-4">
            <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'md:grid-cols-2')}>
              <div className="grid gap-1.5">
                <Label className="text-xs font-black">학생 이름</Label>
                <Input
                  value={form.studentName}
                  onChange={(event) => setForm((prev) => ({ ...prev, studentName: event.target.value }))}
                  placeholder="예: 김재윤"
                  className="h-10 rounded-lg"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-black">학부모 이름</Label>
                <Input
                  value={form.parentName}
                  onChange={(event) => setForm((prev) => ({ ...prev, parentName: event.target.value }))}
                  placeholder="예: 김OO"
                  className="h-10 rounded-lg"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-black">학부모 전화번호</Label>
                <Input
                  value={form.parentPhone}
                  onChange={(event) => setForm((prev) => ({ ...prev, parentPhone: event.target.value }))}
                  placeholder="010-1234-5678"
                  className="h-10 rounded-lg"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-black">학생 전화번호 (선택)</Label>
                <Input
                  value={form.studentPhone}
                  onChange={(event) => setForm((prev) => ({ ...prev, studentPhone: event.target.value }))}
                  placeholder="010-0000-0000"
                  className="h-10 rounded-lg"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-black">홍보 채널</Label>
                <Select
                  value={form.marketingChannel}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, marketingChannel: value }))}
                >
                  <SelectTrigger className="h-10 rounded-lg font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNEL_OPTIONS.map((channel) => (
                      <SelectItem key={channel} value={channel} className="font-semibold">
                        {channel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-black">상담일</Label>
                <Input
                  type="date"
                  value={form.consultationDate}
                  onChange={(event) => setForm((prev) => ({ ...prev, consultationDate: event.target.value }))}
                  className="h-10 rounded-lg"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-black">상태</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, status: value as LeadStatus }))}
                >
                  <SelectTrigger className="h-10 rounded-lg font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_META).map(([value, meta]) => (
                      <SelectItem key={value} value={value} className="font-semibold">
                        {meta.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5 md:col-span-2">
                <Label className="text-xs font-black">메모</Label>
                <Textarea
                  value={form.memo}
                  onChange={(event) => setForm((prev) => ({ ...prev, memo: event.target.value }))}
                  placeholder="상담 내용, 관심 과목, 후속 연락 일정 등을 기록하세요."
                  className="min-h-[92px] rounded-lg"
                />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" className="h-10 rounded-lg font-black" onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : editingId ? (
                  <Save className="mr-2 h-4 w-4" />
                ) : (
                  <PlusCircle className="mr-2 h-4 w-4" />
                )}
                {editingId ? '리드 수정 저장' : '상담 리드 등록'}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" className="h-10 rounded-lg font-black" onClick={resetForm}>
                  편집 취소
                </Button>
              )}
            </div>
          </div>

          <div className={cn('flex gap-2', isMobile ? 'flex-col' : 'items-center justify-between')}>
            <div className="relative w-full md:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="이름/전화번호/채널 검색"
                className="h-10 rounded-lg pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | LeadStatus)}>
              <SelectTrigger className="h-10 w-full rounded-lg font-bold md:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 상태</SelectItem>
                {Object.entries(STATUS_META).map(([value, meta]) => (
                  <SelectItem key={value} value={value}>
                    {meta.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            {isLoading ? (
              <div className="flex h-28 items-center justify-center rounded-xl border border-dashed">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="rounded-xl border border-dashed py-8 text-center text-sm font-semibold text-muted-foreground">
                조건에 맞는 상담 리드가 없습니다.
              </div>
            ) : (
              filteredLeads.map((lead) => (
                <Card key={lead.id} className="rounded-xl border-none shadow-sm ring-1 ring-border/60">
                  <CardContent className={cn('space-y-3', isMobile ? 'p-4' : 'p-5')}>
                    <div className={cn('flex gap-2', isMobile ? 'flex-col' : 'items-start justify-between')}>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-black text-slate-800">
                            {lead.studentName || '(학생명 미입력)'}
                          </p>
                          <Badge className={cn('border text-[10px] font-black', STATUS_META[lead.status || 'new'].className)}>
                            {STATUS_META[lead.status || 'new'].label}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] font-black">
                            {lead.marketingChannel || '기타'}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
                          <span className="inline-flex items-center gap-1.5">
                            <UserRoundPlus className="h-3.5 w-3.5 text-slate-400" />
                            {lead.parentName || '학부모명 미입력'}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-slate-400" />
                            {lead.parentPhone || '-'}
                          </span>
                          {lead.studentPhone && <span>학생 연락처: {lead.studentPhone}</span>}
                          <span>상담일: {lead.consultationDate || '-'}</span>
                        </div>
                        {lead.memo && <p className="text-xs font-medium text-slate-500">{lead.memo}</p>}
                      </div>

                      <div className={cn('flex gap-2', isMobile ? 'w-full flex-wrap' : 'items-center')}>
                        <Select
                          value={lead.status || 'new'}
                          onValueChange={(value) => handleQuickStatusUpdate(lead.id, value as LeadStatus)}
                        >
                          <SelectTrigger className="h-9 min-w-[120px] rounded-lg text-xs font-black">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS_META).map(([value, meta]) => (
                              <SelectItem key={value} value={value}>
                                {meta.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 rounded-lg px-3 text-xs font-black"
                          onClick={() => handleEdit(lead)}
                        >
                          수정
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 rounded-lg border-rose-200 px-3 text-xs font-black text-rose-600 hover:bg-rose-50"
                          onClick={() => handleDelete(lead.id)}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          삭제
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

