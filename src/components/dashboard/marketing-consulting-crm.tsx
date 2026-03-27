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
  Flame,
  Globe2,
  ListChecks,
  Loader2,
  Megaphone,
  Phone,
  PlusCircle,
  Save,
  Search,
  Trash2,
  UserRoundPlus,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';

import { useCollection, useFirestore, useUser } from '@/firebase';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

// ─── Types ────────────────────────────────────────────────────────────────────

type LeadStatus = 'new' | 'contacted' | 'consulted' | 'enrolled' | 'closed';
type WaitlistStatus = 'waiting' | 'admitted' | 'cancelled';
type ServiceType = 'korean_academy' | 'study_center';
type ReferralRoute = '추천' | '네이버' | '카페' | '광고' | '기타';

interface ConsultingLead {
  id: string;
  studentName: string;
  parentName: string;
  parentPhone: string;
  studentPhone?: string;
  school?: string;
  grade?: string;
  marketingChannel: string;
  referralRoute?: ReferralRoute;
  referrerName?: string;
  consultationDate: string;
  status: LeadStatus;
  serviceType?: ServiceType;
  requestType?: string;
  requestTypeLabel?: string;
  memo?: string;
  source?: string;
  sourceRequestId?: string;
  createdAt?: any;
  updatedAt?: any;
  createdByUid?: string;
  addedToWaitlistId?: string;
  addedToWaitlistIds?: string[];
}

interface LeadFormState {
  studentName: string;
  parentName: string;
  parentPhone: string;
  studentPhone: string;
  school: string;
  grade: string;
  referralRoute: ReferralRoute;
  referrerName: string;
  consultationDate: string;
  status: LeadStatus;
  serviceType: ServiceType | '';
  memo: string;
}

interface WebsiteConsultRequest {
  id: string;
  studentName: string;
  school: string;
  grade?: string;
  consultPhone: string;
  consultationDate?: string;
  status: LeadStatus;
  source?: string;
  sourceLabel?: string;
  serviceType?: ServiceType;
  requestType?: string;
  requestTypeLabel?: string;
  createdAt?: any;
  updatedAt?: any;
  linkedLeadId?: string;
}

interface WebsiteEntryEvent {
  id: string;
  eventType?: 'entry_click' | 'page_view' | 'login_success';
  pageType?: 'landing' | 'experience' | 'login';
  target?: 'login' | 'experience';
  placement?: string | null;
  sessionId?: string | null;
  visitorId?: string | null;
  createdAt?: any;
}

interface WaitlistEntry {
  id: string;
  studentName: string;
  parentPhone: string;
  studentPhone?: string;
  school?: string;
  grade?: string;
  serviceType: ServiceType;
  referralRoute?: ReferralRoute;
  referrerName?: string;
  status: WaitlistStatus;
  queueNumber?: number;
  memo?: string;
  waitlistDate: string;
  sourceLeadId?: string;
  sourceWebsiteRequestId?: string;
  createdAt?: any;
  updatedAt?: any;
}

interface WaitlistModal {
  open: boolean;
  sourceLeadId: string;
  studentName: string;
  parentPhone: string;
  studentPhone: string;
  school: string;
  grade: string;
  referralRoute: ReferralRoute;
  referrerName: string;
  serviceTypes: ServiceType[];
  memo: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_META: Record<LeadStatus, { label: string; className: string }> = {
  new: { label: '신규', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  contacted: { label: '연락완료', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  consulted: { label: '상담완료', className: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  enrolled: { label: '등록완료', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  closed: { label: '보류/종결', className: 'bg-slate-100 text-slate-700 border-slate-200' },
};

const WAITLIST_STATUS_META: Record<WaitlistStatus, { label: string; className: string }> = {
  waiting: { label: '대기중', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  admitted: { label: '입학완료', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  cancelled: { label: '취소', className: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const SERVICE_TYPE_META: Record<ServiceType, { label: string; color: string }> = {
  korean_academy: { label: '국어 학원', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  study_center: { label: '관리형 스터디센터', color: 'bg-sky-100 text-sky-700 border-sky-200' },
};

const SERVICE_TYPE_NONE = '__none__';
const ALL_SERVICE_TYPES: ServiceType[] = ['korean_academy', 'study_center'];

const REFERRAL_ROUTES: ReferralRoute[] = ['추천', '네이버', '카페', '광고', '기타'];

const INITIAL_FORM = (): LeadFormState => ({
  studentName: '',
  parentName: '',
  parentPhone: '',
  studentPhone: '',
  school: '',
  grade: '',
  referralRoute: '기타',
  referrerName: '',
  consultationDate: format(new Date(), 'yyyy-MM-dd'),
  status: 'new',
  serviceType: '',
  memo: '',
});

const INITIAL_WAITLIST_MODAL = (): WaitlistModal => ({
  open: false,
  sourceLeadId: '',
  studentName: '',
  parentPhone: '',
  studentPhone: '',
  school: '',
  grade: '',
  referralRoute: '기타',
  referrerName: '',
  serviceTypes: ['korean_academy'],
  memo: '',
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function formatDateTimeLabel(value: any): string {
  const ms = toDateMs(value);
  if (!ms) return '-';
  return format(new Date(ms), 'yyyy.MM.dd HH:mm');
}

function getNextWaitlistQueueNumber(entries: WaitlistEntry[]) {
  const maxAssigned = entries.reduce((best, entry) => {
    if (typeof entry.queueNumber !== 'number' || !Number.isFinite(entry.queueNumber)) return best;
    return Math.max(best, entry.queueNumber);
  }, 0);

  return Math.max(entries.length, maxAssigned) + 1;
}

// ─── Component ────────────────────────────────────────────────────────────────

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

  const [activeTab, setActiveTab] = useState<'leads' | 'waitlist'>('leads');
  const [form, setForm] = useState<LeadFormState>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [promotingWebsiteId, setPromotingWebsiteId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | LeadStatus>('all');
  const [leadsPage, setLeadsPage] = useState(0);

  // Waitlist states
  const [waitlistModal, setWaitlistModal] = useState<WaitlistModal>(INITIAL_WAITLIST_MODAL);
  const [isSavingWaitlist, setIsSavingWaitlist] = useState(false);
  const [waitlistServiceFilter, setWaitlistServiceFilter] = useState<'all' | ServiceType>('all');
  const [waitlistStatusFilter, setWaitlistStatusFilter] = useState<'all' | WaitlistStatus>('all');
  const [waitlistSearch, setWaitlistSearch] = useState('');

  // ── Firestore queries ─────────────────────────────────────────────────────

  const leadsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'consultingLeads'),
      orderBy('createdAt', 'desc'),
      limit(1000)
    );
  }, [firestore, centerId]);
  const { data: leadsRaw, isLoading } = useCollection<ConsultingLead>(leadsQuery, { enabled: !!centerId });

  const websiteRequestsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'websiteConsultRequests'),
      orderBy('createdAt', 'desc'),
      limit(500)
    );
  }, [firestore, centerId]);
  const { data: websiteRequestsRaw, isLoading: websiteRequestsLoading } = useCollection<WebsiteConsultRequest>(
    websiteRequestsQuery,
    { enabled: !!centerId }
  );

  const entryEventsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'websiteEntryEvents'),
      orderBy('createdAt', 'desc'),
      limit(300)
    );
  }, [firestore, centerId]);
  const { data: entryEventsRaw } = useCollection<WebsiteEntryEvent>(entryEventsQuery, { enabled: !!centerId });

  const waitlistQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'admissionWaitlist'),
      orderBy('createdAt', 'desc'),
      limit(500)
    );
  }, [firestore, centerId]);
  const { data: waitlistRaw, isLoading: waitlistLoading } = useCollection<WaitlistEntry>(waitlistQuery, {
    enabled: !!centerId,
  });

  // ── Derived data ──────────────────────────────────────────────────────────

  const leads = useMemo(
    () => [...(leadsRaw || [])].sort((a, b) => toDateMs(b.createdAt) - toDateMs(a.createdAt)),
    [leadsRaw]
  );

  const websiteRequests = useMemo(
    () => [...(websiteRequestsRaw || [])].sort((a, b) => toDateMs(b.createdAt) - toDateMs(a.createdAt)),
    [websiteRequestsRaw]
  );

  const waitlist = useMemo(
    () =>
      [...(waitlistRaw || [])].sort((a, b) => {
        const statusOrder = { waiting: 0, admitted: 1, cancelled: 2 } as const;
        const statusGap = statusOrder[a.status || 'waiting'] - statusOrder[b.status || 'waiting'];
        if (statusGap !== 0) return statusGap;

        const aQueue = typeof a.queueNumber === 'number' ? a.queueNumber : Number.MAX_SAFE_INTEGER;
        const bQueue = typeof b.queueNumber === 'number' ? b.queueNumber : Number.MAX_SAFE_INTEGER;
        if (aQueue !== bQueue) return aQueue - bQueue;

        return toDateMs(a.createdAt) - toDateMs(b.createdAt);
      }),
    [waitlistRaw]
  );

  const waitlistBySourceLeadId = useMemo(() => {
    const grouped = new Map<string, WaitlistEntry[]>();
    for (const entry of waitlist) {
      if (!entry.sourceLeadId) continue;
      const current = grouped.get(entry.sourceLeadId) || [];
      current.push(entry);
      grouped.set(entry.sourceLeadId, current);
    }
    return grouped;
  }, [waitlist]);

  const waitlistBySourceWebsiteRequestId = useMemo(() => {
    const grouped = new Map<string, WaitlistEntry[]>();
    for (const entry of waitlist) {
      if (!entry.sourceWebsiteRequestId) continue;
      const current = grouped.get(entry.sourceWebsiteRequestId) || [];
      current.push(entry);
      grouped.set(entry.sourceWebsiteRequestId, current);
    }
    return grouped;
  }, [waitlist]);

  const LEADS_PER_PAGE = 5;

  const filteredLeads = useMemo(() => {
    setLeadsPage(0);
    const keyword = searchTerm.trim().toLowerCase();
    return leads.filter((lead) => {
      if (statusFilter !== 'all' && lead.status !== statusFilter) return false;
      if (!keyword) return true;
      return [
        lead.studentName,
        lead.parentName,
        lead.parentPhone,
        lead.studentPhone,
        lead.school,
        lead.grade,
        lead.referralRoute,
        lead.referrerName,
        lead.requestTypeLabel,
        lead.memo,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    });
  }, [leads, searchTerm, statusFilter]);

  const pagedLeads = useMemo(
    () => filteredLeads.slice(leadsPage * LEADS_PER_PAGE, (leadsPage + 1) * LEADS_PER_PAGE),
    [filteredLeads, leadsPage]
  );
  const totalLeadsPages = Math.ceil(filteredLeads.length / LEADS_PER_PAGE);

  const filteredWebsiteRequests = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return websiteRequests.filter((req) => {
      if (req.linkedLeadId) return false; // 리드 DB로 이동된 건은 숨김
      if (statusFilter !== 'all' && req.status !== statusFilter) return false;
      if (!keyword) return true;
      return [req.studentName, req.school, req.grade, req.consultPhone, req.sourceLabel, req.requestTypeLabel]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    });
  }, [searchTerm, statusFilter, websiteRequests]);

  const filteredWaitlist = useMemo(() => {
    const keyword = waitlistSearch.trim().toLowerCase();
    return waitlist.filter((entry) => {
      if (waitlistServiceFilter !== 'all' && entry.serviceType !== waitlistServiceFilter) return false;
      if (waitlistStatusFilter !== 'all' && entry.status !== waitlistStatusFilter) return false;
      if (!keyword) return true;
      return [entry.studentName, entry.parentPhone, entry.studentPhone, entry.school, entry.grade, entry.referralRoute, entry.referrerName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    });
  }, [waitlist, waitlistServiceFilter, waitlistStatusFilter, waitlistSearch]);

  const summary = useMemo(() => {
    const total = leads.length;
    const enrolled = leads.filter((l) => l.status === 'enrolled').length;
    const consulted = leads.filter((l) => l.status === 'consulted').length;
    const conversionRate = total > 0 ? (enrolled / total) * 100 : 0;
    const routeCount = new Map<string, number>();
    for (const lead of leads) {
      const key = lead.referralRoute || lead.marketingChannel || '기타';
      routeCount.set(key, (routeCount.get(key) || 0) + 1);
    }
    const routes = Array.from(routeCount.entries())
      .map(([route, count]) => ({ route, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
    return { total, enrolled, consulted, conversionRate, routes };
  }, [leads]);

  const websiteSummary = useMemo(() => {
    const total = websiteRequests.length;
    const newCount = websiteRequests.filter((r) => r.status === 'new').length;
    const contactedCount = websiteRequests.filter((r) => r.status === 'contacted').length;
    return { total, newCount, contactedCount };
  }, [websiteRequests]);

  const visitSummary = useMemo(() => {
    const events = entryEventsRaw || [];
    const landingViews = events.filter((e) => e.eventType === 'page_view' && e.pageType === 'landing').length;
    const experienceViews = events.filter((e) => e.eventType === 'page_view' && e.pageType === 'experience').length;
    const entryClicks = events.filter((e) => e.eventType === 'entry_click').length;
    const loginSuccesses = events.filter((e) => e.eventType === 'login_success').length;
    const uniqueVisitors = new Set(events.map((e) => e.visitorId).filter((v): v is string => !!v)).size;
    const formConversionRate =
      landingViews > 0 ? ((websiteRequests.length / landingViews) * 100).toFixed(1) : null;
    return { landingViews, experienceViews, entryClicks, loginSuccesses, uniqueVisitors, formConversionRate };
  }, [entryEventsRaw, websiteRequests]);

  const waitlistSummary = useMemo(() => {
    const total = waitlist.length;
    const waiting = waitlist.filter((e) => e.status === 'waiting').length;
    const waitingAcademy = waitlist.filter((e) => e.status === 'waiting' && e.serviceType === 'korean_academy').length;
    const waitingStudy = waitlist.filter((e) => e.status === 'waiting' && e.serviceType === 'study_center').length;
    const admitted = waitlist.filter((e) => e.status === 'admitted').length;
    return { total, waiting, waitingAcademy, waitingStudy, admitted };
  }, [waitlist]);

  // ── Handlers ─────────────────────────────────────────────────────────────

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
      school: lead.school || '',
      grade: lead.grade || '',
      referralRoute: (lead.referralRoute as ReferralRoute) || '기타',
      referrerName: lead.referrerName || '',
      consultationDate: lead.consultationDate || format(new Date(), 'yyyy-MM-dd'),
      status: lead.status || 'new',
      serviceType: lead.serviceType || '',
      memo: lead.memo || '',
    });
  };

  const handleSave = async () => {
    if (!firestore || !centerId) return;
    if (!form.studentName.trim() && !form.parentName.trim()) {
      toast({ variant: 'destructive', title: '입력 필요', description: '학생 이름 또는 학부모 이름을 입력해 주세요.' });
      return;
    }
    if (!form.parentPhone.trim()) {
      toast({ variant: 'destructive', title: '입력 필요', description: '학부모 전화번호를 입력해 주세요.' });
      return;
    }
    setIsSaving(true);
    try {
      const payload: any = {
        studentName: form.studentName.trim(),
        parentName: form.parentName.trim(),
        parentPhone: form.parentPhone.trim(),
        studentPhone: form.studentPhone.trim(),
        school: form.school.trim(),
        grade: form.grade.trim(),
        marketingChannel: form.referralRoute,
        referralRoute: form.referralRoute,
        referrerName: form.referralRoute === '추천' ? form.referrerName.trim() : '',
        consultationDate: form.consultationDate,
        status: form.status,
        serviceType: form.serviceType || null,
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
      toast({ variant: 'destructive', title: '저장 실패', description: '상담 리드 저장 중 오류가 발생했습니다.' });
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
      toast({ variant: 'destructive', title: '삭제 실패', description: '리드 삭제 중 오류가 발생했습니다.' });
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
      toast({ variant: 'destructive', title: '상태 변경 실패', description: '상태 변경 중 오류가 발생했습니다.' });
    }
  };

  const handleWebsiteStatusUpdate = async (requestId: string, nextStatus: LeadStatus) => {
    if (!firestore || !centerId) return;
    try {
      await updateDoc(doc(firestore, 'centers', centerId, 'websiteConsultRequests', requestId), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: '웹 상담 상태 변경 실패', description: '웹사이트 상담폼 상태를 바꾸는 중 오류가 발생했습니다.' });
    }
  };

  const handleWebsiteDelete = async (requestId: string) => {
    if (!firestore || !centerId) return;
    try {
      await deleteDoc(doc(firestore, 'centers', centerId, 'websiteConsultRequests', requestId));
      toast({ title: '웹 상담 접수가 삭제되었습니다.' });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: '삭제 실패', description: '웹 상담 접수 삭제 중 오류가 발생했습니다.' });
    }
  };

  const handlePromoteWebsiteRequest = async (request: WebsiteConsultRequest) => {
    if (!firestore || !centerId) return;
    setPromotingWebsiteId(request.id);
    try {
      const linkedWaitlistEntries = waitlistBySourceWebsiteRequestId.get(request.id) || [];
      const waitlistIds = linkedWaitlistEntries.map((entry) => entry.id);
      const memoLines = [
        `학교: ${request.school || '-'}`,
        `학년: ${request.grade || '-'}`,
        `웹 접수: ${formatDateTimeLabel(request.createdAt)}`,
      ];
      const leadRef = await addDoc(collection(firestore, 'centers', centerId, 'consultingLeads'), {
        studentName: request.studentName?.trim() || '',
        parentName: '웹사이트 문의',
        parentPhone: request.consultPhone?.trim() || '',
        studentPhone: '',
        school: request.school?.trim() || '',
        grade: request.grade?.trim() || '',
        marketingChannel: request.sourceLabel || '웹사이트 상담폼',
        referralRoute: '기타',
        consultationDate: request.consultationDate || format(new Date(), 'yyyy-MM-dd'),
        status: request.status || 'new',
        serviceType: request.serviceType || null,
        requestType: request.requestType || null,
        requestTypeLabel: request.requestTypeLabel || null,
        memo: memoLines.join('\n'),
        source: 'website',
        sourceRequestId: request.id,
        addedToWaitlistId: waitlistIds[0] || null,
        addedToWaitlistIds: waitlistIds,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdByUid: user?.uid || null,
      });

      if (linkedWaitlistEntries.length > 0) {
        await Promise.all(
          linkedWaitlistEntries.map((entry) =>
            updateDoc(doc(firestore, 'centers', centerId, 'admissionWaitlist', entry.id), {
              sourceLeadId: leadRef.id,
              studentName: request.studentName?.trim() || entry.studentName || '',
              parentPhone: request.consultPhone?.trim() || entry.parentPhone || '',
              school: request.school?.trim() || entry.school || '',
              grade: request.grade?.trim() || entry.grade || '',
              updatedAt: serverTimestamp(),
            })
          )
        );
      }

      await updateDoc(doc(firestore, 'centers', centerId, 'websiteConsultRequests', request.id), {
        linkedLeadId: leadRef.id,
        updatedAt: serverTimestamp(),
      });
      toast({ title: '웹 상담폼 내역을 리드 DB로 옮겼습니다.', description: '센터 홍보 DB에서 후속 상담 상태를 이어서 관리할 수 있습니다.' });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: '리드 이동 실패', description: '웹사이트 상담폼 내역을 일반 리드 DB로 옮기는 중 오류가 발생했습니다.' });
    } finally {
      setPromotingWebsiteId(null);
    }
  };

  const openWaitlistModal = (lead: ConsultingLead) => {
    const existingEntries = waitlistBySourceLeadId.get(lead.id) || [];
    const existingActiveServiceTypes = new Set<ServiceType>(
      existingEntries.filter((entry) => entry.status !== 'cancelled').map((entry) => entry.serviceType)
    );
    const availableServiceTypes = ALL_SERVICE_TYPES.filter((serviceType) => !existingActiveServiceTypes.has(serviceType));
    const preferredServiceTypes = lead.serviceType ? [lead.serviceType] : ALL_SERVICE_TYPES;
    const preselectedServiceTypes = preferredServiceTypes.filter((serviceType) => availableServiceTypes.includes(serviceType));
    const serviceTypes = (preselectedServiceTypes.length > 0 ? preselectedServiceTypes : availableServiceTypes).slice(
      0,
      ALL_SERVICE_TYPES.length
    );

    if (serviceTypes.length === 0) {
      toast({
        title: '이미 전체 대기 등록됨',
        description: '해당 리드는 학원/관리형 센터 모두 대기 등록이 완료되어 있습니다.',
      });
      return;
    }
    setWaitlistModal({
      open: true,
      sourceLeadId: lead.id,
      studentName: lead.studentName || '',
      parentPhone: lead.parentPhone || '',
      studentPhone: lead.studentPhone || '',
      school: lead.school || '',
      grade: lead.grade || '',
      referralRoute: (lead.referralRoute as ReferralRoute) || '기타',
      referrerName: lead.referrerName || '',
      serviceTypes,
      memo: '',
    });
  };

  const handleSaveWaitlist = async () => {
    if (!firestore || !centerId) return;
    if (!waitlistModal.studentName.trim()) {
      toast({ variant: 'destructive', title: '입력 필요', description: '학생 이름을 입력해 주세요.' });
      return;
    }
    setIsSavingWaitlist(true);
    try {
      const selectedServiceTypes = Array.from(new Set(waitlistModal.serviceTypes));
      if (selectedServiceTypes.length === 0) {
        toast({ variant: 'destructive', title: '등록 실패', description: '서비스 유형을 최소 1개 선택해주세요.' });
        return;
      }

      const existingEntries = waitlistModal.sourceLeadId
        ? waitlistBySourceLeadId.get(waitlistModal.sourceLeadId) || []
        : [];
      const existingActiveServiceTypes = new Set<ServiceType>(
        existingEntries.filter((entry) => entry.status !== 'cancelled').map((entry) => entry.serviceType)
      );
      const serviceTypesToCreate = selectedServiceTypes.filter(
        (serviceType) => !existingActiveServiceTypes.has(serviceType)
      );

      if (serviceTypesToCreate.length === 0) {
        toast({
          title: '이미 등록됨',
          description: '선택한 서비스 유형은 이미 대기 등록되어 있습니다.',
        });
        return;
      }

      const createdWaitlistRefs = await Promise.all(
        serviceTypesToCreate.map((serviceType, index) =>
          addDoc(collection(firestore, 'centers', centerId, 'admissionWaitlist'), {
        studentName: waitlistModal.studentName.trim(),
        parentPhone: waitlistModal.parentPhone.trim(),
        studentPhone: waitlistModal.studentPhone.trim(),
        school: waitlistModal.school.trim(),
        grade: waitlistModal.grade.trim(),
        serviceType,
        referralRoute: waitlistModal.referralRoute,
        referrerName: waitlistModal.referralRoute === '추천' ? waitlistModal.referrerName.trim() : '',
        status: 'waiting' as WaitlistStatus,
        queueNumber: getNextWaitlistQueueNumber(waitlist) + index,
        memo: waitlistModal.memo.trim(),
        waitlistDate: format(new Date(), 'yyyy-MM-dd'),
        sourceLeadId: waitlistModal.sourceLeadId || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
          })
        )
      );

      if (waitlistModal.sourceLeadId) {
        const mergedWaitlistIds = Array.from(
          new Set([...existingEntries.map((entry) => entry.id), ...createdWaitlistRefs.map((ref) => ref.id)])
        );
        await updateDoc(doc(firestore, 'centers', centerId, 'consultingLeads', waitlistModal.sourceLeadId), {
          addedToWaitlistId: mergedWaitlistIds[0] || null,
          addedToWaitlistIds: mergedWaitlistIds,
          updatedAt: serverTimestamp(),
        });
      }

      toast({
        title: '입학 대기 등록 완료',
        description: serviceTypesToCreate.map((type) => SERVICE_TYPE_META[type].label).join(', ') + ' 대기 명단에 추가했습니다.',
      });
      setWaitlistModal(INITIAL_WAITLIST_MODAL());
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: '등록 실패', description: '입학 대기 등록 중 오류가 발생했습니다.' });
    } finally {
      setIsSavingWaitlist(false);
    }
  };

  const handleWaitlistStatusUpdate = async (entryId: string, nextStatus: WaitlistStatus) => {
    if (!firestore || !centerId) return;
    try {
      await updateDoc(doc(firestore, 'centers', centerId, 'admissionWaitlist', entryId), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: '상태 변경 실패', description: '대기 상태 변경 중 오류가 발생했습니다.' });
    }
  };

  const handleWaitlistDelete = async (entryId: string, sourceLeadId?: string) => {
    if (!firestore || !centerId) return;
    try {
      await deleteDoc(doc(firestore, 'centers', centerId, 'admissionWaitlist', entryId));
      if (sourceLeadId) {
        const remainingEntries = waitlist.filter(
          (entry) => entry.sourceLeadId === sourceLeadId && entry.id !== entryId
        );
        await updateDoc(doc(firestore, 'centers', centerId, 'consultingLeads', sourceLeadId), {
          addedToWaitlistId: remainingEntries[0]?.id || null,
          addedToWaitlistIds: remainingEntries.map((entry) => entry.id),
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      }
      toast({ title: '대기 항목이 삭제되었습니다.' });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: '삭제 실패', description: '대기 항목 삭제 중 오류가 발생했습니다.' });
    }
  };

  const exportToCsv = () => {
    const headers = ['상담일', '상태', '유입경로', '추천인', '학생명', '학교', '학년', '학생전화번호', '학부모명', '학부모전화번호', '메모'];
    const rows = filteredLeads.map((lead) => [
      lead.consultationDate || '',
      STATUS_META[lead.status || 'new']?.label || '',
      lead.referralRoute || lead.marketingChannel || '',
      lead.referrerName || '',
      lead.studentName || '',
      lead.school || '',
      lead.grade || '',
      lead.studentPhone || '',
      lead.parentName || '',
      lead.parentPhone || '',
      lead.memo || '',
    ]);
    const csvContent =
      '\uFEFF' + [headers, ...rows].map((row) => row.map((cell) => csvEscape(cell)).join(',')).join('\r\n');
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section className="space-y-4">
      {/* ── Tab navigation ── */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('leads')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-black transition-all',
            activeTab === 'leads'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          )}
        >
          <Megaphone className="h-4 w-4" />
          홍보/상담 리드 DB
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('waitlist')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-black transition-all',
            activeTab === 'waitlist'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          )}
        >
          <ListChecks className="h-4 w-4" />
          입학 대기 DB
          {waitlistSummary.waiting > 0 && (
            <Badge className="border-none bg-orange-500 text-[10px] font-black text-white">
              {waitlistSummary.waiting}
            </Badge>
          )}
        </button>
      </div>

      {/* ════════════════════════════════════════════
          TAB 1 – 홍보/상담 리드 DB
      ════════════════════════════════════════════ */}
      {activeTab === 'leads' && (
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
                엑셀 다운로드
              </Button>
            </div>
          </CardHeader>

          <CardContent className={cn('space-y-4', isMobile ? 'p-5 pt-0' : 'p-6 pt-0')}>
            {/* ── 웹사이트 상담폼 접수 ── */}
            <div className="rounded-xl border border-orange-100 bg-orange-50/60 p-4">
              <div className={cn('flex gap-3', isMobile ? 'flex-col' : 'items-start justify-between')}>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Globe2 className="h-4 w-4 text-[#FF7A16]" />
                    <p className="text-sm font-black text-slate-900">웹사이트 상담폼 접수</p>
                  </div>
                  <p className="text-xs font-semibold text-slate-600">
                    랜딩페이지 상담 문의는 여기서 확인 후 리드 DB로 옮길 수 있고, 웹 입학 대기 신청은 리드 DB와 대기 DB에 동시에 바로 반영됩니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="border-none bg-transparent text-[#C25A00] shadow-none">전체 {websiteSummary.total}건</Badge>
                  <Badge className="border-none bg-transparent text-blue-700 shadow-none">신규 {websiteSummary.newCount}건</Badge>
                  <Badge className="border-none bg-transparent text-amber-700 shadow-none">연락중 {websiteSummary.contactedCount}건</Badge>
                </div>
              </div>

              <div className={cn('mt-3 grid gap-2', isMobile ? 'grid-cols-2' : 'grid-cols-4')}>
                <div className="rounded-lg bg-white px-3 py-2 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">랜딩 방문</p>
                  <p className="mt-0.5 text-xl font-black text-slate-800">{visitSummary.landingViews}</p>
                  <p className="text-[10px] font-semibold text-slate-400">체험 {visitSummary.experienceViews}회 포함</p>
                </div>
                <div className="rounded-lg bg-white px-3 py-2 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">고유 방문자</p>
                  <p className="mt-0.5 text-xl font-black text-slate-800">{visitSummary.uniqueVisitors}</p>
                  <p className="text-[10px] font-semibold text-slate-400">중복 제거</p>
                </div>
                <div className="rounded-lg bg-white px-3 py-2 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">버튼 클릭</p>
                  <p className="mt-0.5 text-xl font-black text-slate-800">{visitSummary.entryClicks}</p>
                  <p className="text-[10px] font-semibold text-slate-400">로그인 성공 {visitSummary.loginSuccesses}회</p>
                </div>
                <div className="rounded-lg bg-white px-3 py-2 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">상담폼 전환율</p>
                  <p className="mt-0.5 text-xl font-black text-slate-800">
                    {visitSummary.formConversionRate !== null ? `${visitSummary.formConversionRate}%` : '-'}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-400">방문 대비 문의</p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {websiteRequestsLoading ? (
                  <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-orange-200 bg-white/80">
                    <Loader2 className="h-5 w-5 animate-spin text-[#FF7A16]" />
                  </div>
                ) : filteredWebsiteRequests.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-orange-200 bg-white/80 px-4 py-6 text-center text-sm font-semibold text-slate-500">
                    아직 웹사이트 상담폼으로 접수된 내역이 없습니다.
                  </div>
                ) : (
                  filteredWebsiteRequests.slice(0, 8).map((request) => (
                    <div key={request.id} className="rounded-xl border border-orange-100 bg-white px-4 py-3 shadow-sm">
                      <div className={cn('flex gap-3', isMobile ? 'flex-col' : 'items-start justify-between')}>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-black text-slate-900">{request.studentName || '(학생명 미입력)'}</p>
                            <Badge className={cn('border text-[10px] font-black', STATUS_META[request.status || 'new'].className)}>
                              {STATUS_META[request.status || 'new'].label}
                            </Badge>
                            {request.school && (
                              <Badge variant="outline" className="max-w-[180px] truncate text-[10px] font-black text-slate-700">
                                {request.school}
                              </Badge>
                            )}
                            {request.grade && (
                              <Badge variant="outline" className="text-[10px] font-black text-slate-700">
                                {request.grade}
                              </Badge>
                            )}
                            {request.serviceType && (
                              <Badge className={cn('border text-[10px] font-black', SERVICE_TYPE_META[request.serviceType].color)}>
                                {request.requestTypeLabel || SERVICE_TYPE_META[request.serviceType].label}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[10px] font-black">
                              {request.sourceLabel || '웹사이트'}
                            </Badge>
                          </div>
                          <p className="text-xs font-semibold text-slate-600">
                            학교: {request.school || '-'} {request.grade ? `· ${request.grade}` : ''} · 연락처: {request.consultPhone || '-'}
                          </p>
                          <p className="text-[11px] font-semibold text-slate-500">
                            접수일: {request.consultationDate || '-'} · 접수시각: {formatDateTimeLabel(request.createdAt)}
                          </p>
                        </div>
                        <div className={cn('flex gap-2', isMobile ? 'w-full flex-wrap' : 'items-center')}>
                          <Select
                            value={request.status || 'new'}
                            onValueChange={(value) => handleWebsiteStatusUpdate(request.id, value as LeadStatus)}
                          >
                            <SelectTrigger className="h-9 min-w-[120px] rounded-lg text-xs font-black">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(STATUS_META).map(([value, meta]) => (
                                <SelectItem key={value} value={value}>{meta.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-9 rounded-lg px-3 text-xs font-black"
                            onClick={() => void handlePromoteWebsiteRequest(request)}
                            disabled={promotingWebsiteId === request.id || !!request.linkedLeadId}
                          >
                            {promotingWebsiteId === request.id && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                            {request.linkedLeadId ? '리드 이동됨' : '리드 DB로 이동'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-9 rounded-lg border-rose-200 px-3 text-xs font-black text-rose-600 hover:bg-rose-50"
                            onClick={() => void handleWebsiteDelete(request.id)}
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                            삭제
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ── Summary cards ── */}
            <div className={cn('grid gap-3', isMobile ? 'grid-cols-2' : 'md:grid-cols-4')}>
              <Card className="rounded-xl border-none bg-primary shadow-sm">
                <CardContent className="p-4">
                  <p className="text-[11px] font-bold text-black">전체 리드</p>
                  <p className="mt-1 text-2xl font-black text-black">{summary.total}</p>
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

            {/* ── 유입 경로 상위 ── */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
              <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">유입 경로 상위</p>
              <div className="flex flex-wrap gap-2">
                {summary.routes.length === 0 ? (
                  <span className="text-xs font-semibold text-slate-400">아직 입력된 리드가 없습니다.</span>
                ) : (
                  summary.routes.map((item) => (
                    <Badge key={item.route} variant="outline" className="rounded-full px-3 py-1 text-[11px] font-black">
                      {item.route} {item.count}건
                    </Badge>
                  ))
                )}
              </div>
            </div>

            {/* ── 상담 리드 등록 폼 ── */}
            <div className="rounded-xl border border-slate-100 p-4">
              <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'md:grid-cols-2')}>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-black">학생 이름</Label>
                  <Input
                    value={form.studentName}
                    onChange={(e) => setForm((p) => ({ ...p, studentName: e.target.value }))}
                    placeholder="예: 김재윤"
                    className="h-10 rounded-lg"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-black">학부모 이름</Label>
                  <Input
                    value={form.parentName}
                    onChange={(e) => setForm((p) => ({ ...p, parentName: e.target.value }))}
                    placeholder="예: 김OO"
                    className="h-10 rounded-lg"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-black">학부모 전화번호</Label>
                  <Input
                    value={form.parentPhone}
                    onChange={(e) => setForm((p) => ({ ...p, parentPhone: e.target.value }))}
                    placeholder="010-1234-5678"
                    className="h-10 rounded-lg"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-black">학생 전화번호 (선택)</Label>
                  <Input
                    value={form.studentPhone}
                    onChange={(e) => setForm((p) => ({ ...p, studentPhone: e.target.value }))}
                    placeholder="010-0000-0000"
                    className="h-10 rounded-lg"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-black">학교 (선택)</Label>
                  <Input
                    value={form.school}
                    onChange={(e) => setForm((p) => ({ ...p, school: e.target.value }))}
                    placeholder="예: 대치중"
                    className="h-10 rounded-lg"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-black">학년 (선택)</Label>
                  <Input
                    value={form.grade}
                    onChange={(e) => setForm((p) => ({ ...p, grade: e.target.value }))}
                    placeholder="예: 중2"
                    className="h-10 rounded-lg"
                  />
                </div>

                {/* ── 유입 경로 ── */}
                <div className="grid gap-1.5">
                  <Label className="text-xs font-black">유입 경로</Label>
                  <Select
                    value={form.referralRoute}
                    onValueChange={(value) => setForm((p) => ({ ...p, referralRoute: value as ReferralRoute, referrerName: '' }))}
                  >
                    <SelectTrigger className="h-10 rounded-lg font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REFERRAL_ROUTES.map((route) => (
                        <SelectItem key={route} value={route} className="font-semibold">{route}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* ── 추천인 (추천 선택 시만) ── */}
                {form.referralRoute === '추천' && (
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-black">추천인 이름</Label>
                    <Input
                      value={form.referrerName}
                      onChange={(e) => setForm((p) => ({ ...p, referrerName: e.target.value }))}
                      placeholder="예: 홍길동 학부모님"
                      className="h-10 rounded-lg"
                    />
                  </div>
                )}

                <div className="grid gap-1.5">
                  <Label className="text-xs font-black">상담일</Label>
                  <Input
                    type="date"
                    value={form.consultationDate}
                    onChange={(e) => setForm((p) => ({ ...p, consultationDate: e.target.value }))}
                    className="h-10 rounded-lg"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-black">상태</Label>
                  <Select
                    value={form.status}
                    onValueChange={(value) => setForm((p) => ({ ...p, status: value as LeadStatus }))}
                  >
                    <SelectTrigger className="h-10 rounded-lg font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_META).map(([value, meta]) => (
                        <SelectItem key={value} value={value} className="font-semibold">{meta.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-black">상담 유형</Label>
                  <Select
                    value={form.serviceType}
                    onValueChange={(value) =>
                      setForm((p) => ({
                        ...p,
                        serviceType: value === SERVICE_TYPE_NONE ? '' : (value as ServiceType),
                      }))
                    }
                  >
                    <SelectTrigger className="h-10 rounded-lg font-bold">
                      <SelectValue placeholder="선택 안함" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SERVICE_TYPE_NONE} className="font-semibold text-slate-400">선택 안함</SelectItem>
                      {(Object.entries(SERVICE_TYPE_META) as [ServiceType, { label: string; color: string }][]).map(([value, meta]) => (
                        <SelectItem key={value} value={value} className="font-semibold">{meta.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5 md:col-span-2">
                  <Label className="text-xs font-black">메모</Label>
                  <Textarea
                    value={form.memo}
                    onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))}
                    placeholder="상담 내용, 관심 과목, 후속 연락 일정 등을 기록하세요."
                    className="min-h-[92px] rounded-lg"
                  />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" className="h-10 rounded-lg font-black" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingId ? <Save className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                  {editingId ? '리드 수정 저장' : '상담 리드 등록'}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" className="h-10 rounded-lg font-black" onClick={resetForm}>
                    편집 취소
                  </Button>
                )}
              </div>
            </div>

            {/* ── 검색 / 필터 ── */}
            <div className={cn('flex gap-2', isMobile ? 'flex-col' : 'items-center justify-between')}>
              <div className="relative w-full md:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="이름/전화번호/유입경로 검색"
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
                    <SelectItem key={value} value={value}>{meta.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ── 리드 목록 ── */}
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
                pagedLeads.map((lead) => {
                  const leadWaitlistEntries = waitlistBySourceLeadId.get(lead.id) || [];
                  const leadActiveServiceTypes = Array.from(
                    new Set(
                      leadWaitlistEntries
                        .filter((entry) => entry.status !== 'cancelled')
                        .map((entry) => entry.serviceType)
                    )
                  );
                  const isLeadFullyWaitlisted = leadActiveServiceTypes.length >= ALL_SERVICE_TYPES.length;
                  const waitlistButtonLabel = isLeadFullyWaitlisted
                    ? '학원/센터 대기등록됨'
                    : leadActiveServiceTypes.length > 0
                      ? '추가 대기 등록'
                      : '입학 대기 등록';

                  const leadServiceLabel = lead.serviceType
                    ? lead.requestTypeLabel || SERVICE_TYPE_META[lead.serviceType].label
                    : lead.requestTypeLabel;

                  return (
                  <Card key={lead.id} className="rounded-xl border-none shadow-sm ring-1 ring-border/60">
                    <CardContent className={cn('space-y-3', isMobile ? 'p-4' : 'p-5')}>
                      <div className={cn('flex gap-2', isMobile ? 'flex-col' : 'items-start justify-between')}>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-black text-slate-800">{lead.studentName || '(학생명 미입력)'}</p>
                            <Badge className={cn('border text-[10px] font-black', STATUS_META[lead.status || 'new'].className)}>
                              {STATUS_META[lead.status || 'new'].label}
                            </Badge>
                            {lead.school && (
                              <Badge variant="outline" className="max-w-[180px] truncate text-[10px] font-black text-slate-700">
                                {lead.school}
                              </Badge>
                            )}
                            {lead.grade && (
                              <Badge variant="outline" className="text-[10px] font-black text-slate-700">
                                {lead.grade}
                              </Badge>
                            )}
                            {lead.serviceType && leadServiceLabel && (
                              <Badge className={cn('border text-[10px] font-black', SERVICE_TYPE_META[lead.serviceType].color)}>
                                {leadServiceLabel}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[10px] font-black">
                              {lead.referralRoute || lead.marketingChannel || '기타'}
                              {lead.referrerName ? ` · ${lead.referrerName}` : ''}
                            </Badge>
                            {leadActiveServiceTypes.map((serviceType) => (
                              <Badge
                                key={`${lead.id}-${serviceType}`}
                                className={cn('border text-[10px] font-black', SERVICE_TYPE_META[serviceType].color)}
                              >
                                {SERVICE_TYPE_META[serviceType].label} 대기
                              </Badge>
                            ))}
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
                            {lead.school && <span>학교: {lead.school}</span>}
                            {lead.grade && <span>학년: {lead.grade}</span>}
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
                                <SelectItem key={value} value={value}>{meta.label}</SelectItem>
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
                          {/* ── 입학 대기 등록 버튼 (상담완료·등록완료) ── */}
                          {(lead.status === 'consulted' || lead.status === 'enrolled') && (
                            <Button
                              type="button"
                              variant="outline"
                              className={cn(
                                'h-9 rounded-lg px-3 text-xs font-black',
                                isLeadFullyWaitlisted
                                  ? 'border-orange-200 text-orange-500'
                                  : 'border-orange-300 text-orange-600 hover:bg-orange-50'
                              )}
                              onClick={() => !isLeadFullyWaitlisted && openWaitlistModal(lead)}
                              disabled={isLeadFullyWaitlisted}
                            >
                              <ListChecks className="mr-1 h-3.5 w-3.5" />
                              {waitlistButtonLabel}
                            </Button>
                          )}
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
                  );
                })
              )}
            </div>

            {/* ── 페이지네이션 ── */}
            {totalLeadsPages > 1 && (
              <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3">
                <p className="text-xs font-bold text-slate-500">
                  {leadsPage * LEADS_PER_PAGE + 1}–{Math.min((leadsPage + 1) * LEADS_PER_PAGE, filteredLeads.length)} / 전체 {filteredLeads.length}건
                </p>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg px-3 text-xs font-black"
                    disabled={leadsPage === 0}
                    onClick={() => setLeadsPage((p) => p - 1)}
                  >
                    이전
                  </Button>
                  {Array.from({ length: totalLeadsPages }, (_, i) => (
                    <Button
                      key={i}
                      type="button"
                      variant={leadsPage === i ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 w-8 rounded-lg p-0 text-xs font-black"
                      onClick={() => setLeadsPage(i)}
                    >
                      {i + 1}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg px-3 text-xs font-black"
                    disabled={leadsPage >= totalLeadsPages - 1}
                    onClick={() => setLeadsPage((p) => p + 1)}
                  >
                    다음
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ════════════════════════════════════════════
          TAB 2 – 입학 대기 DB
      ════════════════════════════════════════════ */}
      {activeTab === 'waitlist' && (
        <Card className="rounded-2xl border-none shadow-sm ring-1 ring-border/50">
          <CardHeader className={cn(isMobile ? 'p-5' : 'p-6')}>
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg font-black">
                <ListChecks className="h-5 w-5 text-orange-500" />
                입학 대기 DB
              </CardTitle>
              <CardDescription className="font-semibold">
                국어 학원 / 관리형 스터디센터 입학 대기 명단을 통합 관리합니다.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className={cn('space-y-4', isMobile ? 'p-5 pt-0' : 'p-6 pt-0')}>
            {/* ── 긴급 대기 배너 ── */}
            {waitlistSummary.waiting > 0 && (
              <div className="flex items-center gap-3 rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500 shadow-md shadow-orange-200">
                  <Flame className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-orange-800">
                    현재 <span className="text-lg text-orange-600">{waitlistSummary.waiting}명</span> 대기 중!
                  </p>
                  <p className="text-xs font-semibold text-orange-600">
                    자리가 한정되어 있습니다 — 빠른 확인 후 안내해 주세요.
                  </p>
                </div>
              </div>
            )}

            {/* ── Summary cards ── */}
            <div className={cn('grid gap-3', isMobile ? 'grid-cols-2' : 'grid-cols-4')}>
              <Card className="rounded-xl border-none shadow-sm ring-1 ring-border/50">
                <CardContent className="p-4">
                  <p className="text-[11px] font-bold text-[#14295F]">전체 대기</p>
                  <p className="mt-1 text-2xl font-black text-[#14295F]">{waitlistSummary.waiting}</p>
                </CardContent>
              </Card>
              <Card className="rounded-xl border-none shadow-sm ring-1 ring-border/50">
                <CardContent className="p-4">
                  <p className="text-[11px] font-bold text-muted-foreground">국어 학원</p>
                  <p className="mt-1 text-2xl font-black text-violet-600">{waitlistSummary.waitingAcademy}</p>
                </CardContent>
              </Card>
              <Card className="rounded-xl border-none shadow-sm ring-1 ring-border/50">
                <CardContent className="p-4">
                  <p className="text-[11px] font-bold text-muted-foreground">스터디센터</p>
                  <p className="mt-1 text-2xl font-black text-sky-600">{waitlistSummary.waitingStudy}</p>
                </CardContent>
              </Card>
              <Card className="rounded-xl border-none shadow-sm ring-1 ring-border/50">
                <CardContent className="p-4">
                  <p className="text-[11px] font-bold text-muted-foreground">입학완료</p>
                  <p className="mt-1 text-2xl font-black text-emerald-600">{waitlistSummary.admitted}</p>
                </CardContent>
              </Card>
            </div>

            {/* ── 서비스 유형 필터 탭 ── */}
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
              {(
                [
                  { value: 'all', label: '전체' },
                  { value: 'korean_academy', label: '국어 학원' },
                  { value: 'study_center', label: '관리형 스터디센터' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setWaitlistServiceFilter(tab.value)}
                  className={cn(
                    'flex-1 rounded-md px-3 py-1.5 text-xs font-black transition-all',
                    waitlistServiceFilter === tab.value
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── 검색 + 상태 필터 ── */}
            <div className={cn('flex gap-2', isMobile ? 'flex-col' : 'items-center')}>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={waitlistSearch}
                  onChange={(e) => setWaitlistSearch(e.target.value)}
                  placeholder="이름/전화번호/학교 검색"
                  className="h-10 rounded-lg pl-9"
                />
              </div>
              <Select
                value={waitlistStatusFilter}
                onValueChange={(value) => setWaitlistStatusFilter(value as 'all' | WaitlistStatus)}
              >
                <SelectTrigger className="h-10 w-full rounded-lg font-bold md:w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 상태</SelectItem>
                  {Object.entries(WAITLIST_STATUS_META).map(([value, meta]) => (
                    <SelectItem key={value} value={value}>{meta.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ── 대기 목록 ── */}
            <div className="space-y-2">
              {waitlistLoading ? (
                <div className="flex h-28 items-center justify-center rounded-xl border border-dashed">
                  <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
                </div>
              ) : filteredWaitlist.length === 0 ? (
                <div className="rounded-xl border border-dashed py-10 text-center">
                  <Users className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                  <p className="text-sm font-semibold text-muted-foreground">
                    {waitlistSummary.total === 0
                      ? '아직 입학 대기 등록된 학생이 없습니다.'
                      : '조건에 맞는 대기 항목이 없습니다.'}
                  </p>
                  {waitlistSummary.total === 0 && (
                    <p className="mt-1 text-xs font-medium text-slate-400">
                      홍보/상담 리드 탭에서 상담완료 학생의 "입학 대기 등록" 버튼을 누르세요.
                    </p>
                  )}
                </div>
              ) : (
                filteredWaitlist.map((entry) => (
                  <Card key={entry.id} className="rounded-xl border-none shadow-sm ring-1 ring-border/60">
                    <CardContent className={cn('space-y-2', isMobile ? 'p-4' : 'p-5')}>
                      <div className={cn('flex gap-2', isMobile ? 'flex-col' : 'items-start justify-between')}>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-black text-slate-800">{entry.studentName}</p>
                            {typeof entry.queueNumber === 'number' && (
                              <Badge variant="outline" className="text-[10px] font-black text-[#14295F]">
                                대기번호 {entry.queueNumber}
                              </Badge>
                            )}
                            <Badge className={cn('border text-[10px] font-black', WAITLIST_STATUS_META[entry.status || 'waiting'].className)}>
                              {WAITLIST_STATUS_META[entry.status || 'waiting'].label}
                            </Badge>
                            {entry.school && (
                              <Badge variant="outline" className="max-w-[180px] truncate text-[10px] font-black text-slate-700">
                                {entry.school}
                              </Badge>
                            )}
                            <Badge className={cn('border text-[10px] font-black', SERVICE_TYPE_META[entry.serviceType].color)}>
                              {SERVICE_TYPE_META[entry.serviceType].label}
                            </Badge>
                            {entry.sourceWebsiteRequestId && (
                              <Badge variant="outline" className="text-[10px] font-black text-orange-600">
                                웹 접수
                              </Badge>
                            )}
                            {entry.referralRoute && (
                              <Badge variant="outline" className="text-[10px] font-black">
                                {entry.referralRoute}
                                {entry.referrerName ? ` · ${entry.referrerName}` : ''}
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
                            <span className="inline-flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5 text-slate-400" />
                              {entry.parentPhone || '-'}
                            </span>
                            {entry.studentPhone && <span>학생: {entry.studentPhone}</span>}
                            {entry.school && <span>학교: {entry.school}</span>}
                            {entry.grade && <span>{entry.grade}</span>}
                            <span>대기 등록일: {entry.waitlistDate || '-'}</span>
                          </div>
                          {entry.memo && <p className="text-xs font-medium text-slate-500">{entry.memo}</p>}
                        </div>

                        <div className={cn('flex gap-2', isMobile ? 'w-full flex-wrap' : 'items-center')}>
                          <Select
                            value={entry.status || 'waiting'}
                            onValueChange={(value) => handleWaitlistStatusUpdate(entry.id, value as WaitlistStatus)}
                          >
                            <SelectTrigger className="h-9 min-w-[110px] rounded-lg text-xs font-black">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(WAITLIST_STATUS_META).map(([value, meta]) => (
                                <SelectItem key={value} value={value}>{meta.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-9 rounded-lg border-rose-200 px-3 text-xs font-black text-rose-600 hover:bg-rose-50"
                            onClick={() => handleWaitlistDelete(entry.id, entry.sourceLeadId)}
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
      )}

      {/* ════════════════════════════════════════════
          입학 대기 등록 Dialog
      ════════════════════════════════════════════ */}
      <Dialog
        open={waitlistModal.open}
        onOpenChange={(open) => !open && setWaitlistModal(INITIAL_WAITLIST_MODAL())}
      >
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black">
              <ListChecks className="h-5 w-5 text-orange-500" />
              입학 대기 등록
            </DialogTitle>
            <DialogDescription className="font-semibold">
              아래 정보를 확인하고 대기 명단에 추가합니다.
            </DialogDescription>
          </DialogHeader>

          {/* ── 현재 대기 인원 강조 배너 ── */}
          <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 p-3 text-white shadow-md shadow-orange-100">
            <Flame className="h-8 w-8 shrink-0" />
            <div>
              <p className="text-base font-black">
                현재{' '}
                <span className="text-xl">
                  {waitlistServiceFilter === 'korean_academy'
                    ? waitlistSummary.waitingAcademy
                    : waitlistServiceFilter === 'study_center'
                      ? waitlistSummary.waitingStudy
                      : waitlistSummary.waiting}
                </span>
                명 대기 중!
              </p>
              <p className="text-xs font-semibold opacity-90">자리가 한정되어 있으니 서둘러 등록하세요.</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label className="text-xs font-black">학생 이름</Label>
              <Input
                value={waitlistModal.studentName}
                onChange={(e) => setWaitlistModal((p) => ({ ...p, studentName: e.target.value }))}
                className="h-10 rounded-lg"
              />
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs font-black">학부모 전화번호</Label>
              <Input
                value={waitlistModal.parentPhone}
                onChange={(e) => setWaitlistModal((p) => ({ ...p, parentPhone: e.target.value }))}
                className="h-10 rounded-lg"
              />
            </div>

            {/* ── 서비스 유형 ── */}
            <div className="grid gap-1.5">
              <Label className="text-xs font-black">서비스 유형</Label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(SERVICE_TYPE_META) as [ServiceType, { label: string; color: string }][]).map(([key, meta]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      setWaitlistModal((p) => {
                        const alreadySelected = p.serviceTypes.includes(key);
                        if (alreadySelected && p.serviceTypes.length === 1) return p;
                        return {
                          ...p,
                          serviceTypes: alreadySelected
                            ? p.serviceTypes.filter((serviceType) => serviceType !== key)
                            : [...p.serviceTypes, key],
                        };
                      })
                    }
                    className={cn(
                      'rounded-lg border-2 px-3 py-2.5 text-xs font-black transition-all',
                      waitlistModal.serviceTypes.includes(key)
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    )}
                  >
                    {meta.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── 유입 경로 ── */}
            <div className="grid gap-1.5">
              <Label className="text-xs font-black">유입 경로</Label>
              <div className="flex flex-wrap gap-1.5">
                {REFERRAL_ROUTES.map((route) => (
                  <button
                    key={route}
                    type="button"
                    onClick={() => setWaitlistModal((p) => ({ ...p, referralRoute: route, referrerName: '' }))}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-black transition-all',
                      waitlistModal.referralRoute === route
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    )}
                  >
                    {route}
                  </button>
                ))}
              </div>
            </div>

            {/* ── 추천인 (추천 선택시) ── */}
            {waitlistModal.referralRoute === '추천' && (
              <div className="grid gap-1.5">
                <Label className="text-xs font-black">추천인 이름</Label>
                <Input
                  value={waitlistModal.referrerName}
                  onChange={(e) => setWaitlistModal((p) => ({ ...p, referrerName: e.target.value }))}
                  placeholder="예: 홍길동 학부모님"
                  className="h-10 rounded-lg"
                />
              </div>
            )}

            <div className="grid gap-1.5">
              <Label className="text-xs font-black">메모 (선택)</Label>
              <Textarea
                value={waitlistModal.memo}
                onChange={(e) => setWaitlistModal((p) => ({ ...p, memo: e.target.value }))}
                placeholder="특이사항, 희망 반, 시작 예정일 등을 기록하세요."
                className="min-h-[72px] rounded-lg"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-lg font-black"
              onClick={() => setWaitlistModal(INITIAL_WAITLIST_MODAL())}
            >
              취소
            </Button>
            <Button
              type="button"
              className="rounded-lg font-black"
              onClick={handleSaveWaitlist}
              disabled={isSavingWaitlist}
            >
              {isSavingWaitlist && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              대기 등록 완료
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
