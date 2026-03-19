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

// ?????? Types ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

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
  marketingChannel: string;
  referralRoute?: ReferralRoute;
  referrerName?: string;
  consultationDate: string;
  status: LeadStatus;
  serviceType?: ServiceType;
  memo?: string;
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
  consultPhone: string;
  consultationDate?: string;
  status: LeadStatus;
  source?: string;
  sourceLabel?: string;
  serviceType?: ServiceType;
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
  memo?: string;
  waitlistDate: string;
  sourceLeadId?: string;
  createdAt?: any;
  updatedAt?: any;
}

interface WaitlistModal {
  open: boolean;
  sourceLeadId: string;
  studentName: string;
  parentPhone: string;
  studentPhone: string;
  referralRoute: ReferralRoute;
  referrerName: string;
  serviceTypes: ServiceType[];
  memo: string;
}

// ?????? Constants ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

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
  referralRoute: '기타',
  referrerName: '',
  serviceTypes: ['korean_academy'],
  memo: '',
});

// ?????? Helpers ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

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

// ?????? Component ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

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

  // ???? Firestore queries ??????????????????????????????????????????????????????????????????????????????????????????????????????????

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

  // ???? Derived data ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

  const leads = useMemo(
    () => [...(leadsRaw || [])].sort((a, b) => toDateMs(b.createdAt) - toDateMs(a.createdAt)),
    [leadsRaw]
  );

  const websiteRequests = useMemo(
    () => [...(websiteRequestsRaw || [])].sort((a, b) => toDateMs(b.createdAt) - toDateMs(a.createdAt)),
    [websiteRequestsRaw]
  );

  const waitlist = useMemo(
    () => [...(waitlistRaw || [])].sort((a, b) => toDateMs(b.createdAt) - toDateMs(a.createdAt)),
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

  const LEADS_PER_PAGE = 5;

  const filteredLeads = useMemo(() => {
    setLeadsPage(0);
    const keyword = searchTerm.trim().toLowerCase();
    return leads.filter((lead) => {
      if (statusFilter !== 'all' && lead.status !== statusFilter) return false;
      if (!keyword) return true;
      return [lead.studentName, lead.parentName, lead.parentPhone, lead.studentPhone, lead.referralRoute, lead.referrerName, lead.memo]
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
      if (req.linkedLeadId) return false; // ?귐됰굡 DB嚥???猷??椰꾨똻? ???
      if (statusFilter !== 'all' && req.status !== statusFilter) return false;
      if (!keyword) return true;
      return [req.studentName, req.school, req.consultPhone, req.sourceLabel]
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
      const key = lead.referralRoute || lead.marketingChannel || '疫꿸퀬?';
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

  // ???? Handlers ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

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
      referralRoute: (lead.referralRoute as ReferralRoute) || '疫꿸퀬?',
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
      toast({ variant: 'destructive', title: '??낆젾 ?袁⑹뒄', description: '??덇문 ??已??癒?뮉 ???筌???已????낆젾??雅뚯눘苑??' });
      return;
    }
    if (!form.parentPhone.trim()) {
      toast({ variant: 'destructive', title: '??낆젾 ?袁⑹뒄', description: '???筌??袁れ넅甕곕뜇?뉒몴???낆젾??雅뚯눘苑??' });
      return;
    }
    setIsSaving(true);
    try {
      const payload: any = {
        studentName: form.studentName.trim(),
        parentName: form.parentName.trim(),
        parentPhone: form.parentPhone.trim(),
        studentPhone: form.studentPhone.trim(),
        marketingChannel: form.referralRoute,
        referralRoute: form.referralRoute,
        referrerName: form.referralRoute === '?곕뗄荑? ? form.referrerName.trim() : '',
        consultationDate: form.consultationDate,
        status: form.status,
        serviceType: form.serviceType || null,
        memo: form.memo.trim(),
        updatedAt: serverTimestamp(),
      };
      if (editingId) {
        await updateDoc(doc(firestore, 'centers', centerId, 'consultingLeads', editingId), payload);
        toast({ title: '?怨룸뼖 ?귐됰굡揶쎛 ??륁젟??뤿???щ빍??' });
      } else {
        await addDoc(collection(firestore, 'centers', centerId, 'consultingLeads'), {
          ...payload,
          createdAt: serverTimestamp(),
          createdByUid: user?.uid || null,
        });
        toast({ title: '?怨룸뼖 ?귐됰굡揶쎛 ?源낆쨯??뤿???щ빍??' });
      }
      resetForm();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: '??????쎈솭', description: '?怨룸뼖 ?귐됰굡 ????餓???살첒揶쎛 獄쏆뮇源??됰뮸??덈뼄.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (leadId: string) => {
    if (!firestore || !centerId) return;
    try {
      await deleteDoc(doc(firestore, 'centers', centerId, 'consultingLeads', leadId));
      if (editingId === leadId) resetForm();
      toast({ title: '?귐됰굡揶쎛 ?????뤿???щ빍??' });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: '??????쎈솭', description: '?귐됰굡 ????餓???살첒揶쎛 獄쏆뮇源??됰뮸??덈뼄.' });
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
      toast({ variant: 'destructive', title: '?怨밴묶 癰궰野???쎈솭', description: '?怨밴묶 癰궰野?餓???살첒揶쎛 獄쏆뮇源??됰뮸??덈뼄.' });
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
      toast({ variant: 'destructive', title: '???怨룸뼖 ?怨밴묶 癰궰野???쎈솭', description: '?諭沅??꾨뱜 ?怨룸뼖???怨밴묶??獄쏅떽???餓???살첒揶쎛 獄쏆뮇源??됰뮸??덈뼄.' });
    }
  };

  const handlePromoteWebsiteRequest = async (request: WebsiteConsultRequest) => {
    if (!firestore || !centerId) return;
    setPromotingWebsiteId(request.id);
    try {
      const leadRef = await addDoc(collection(firestore, 'centers', centerId, 'consultingLeads'), {
        studentName: request.studentName?.trim() || '',
        parentName: '?諭沅??꾨뱜 ?얜챷??,
        parentPhone: request.consultPhone?.trim() || '',
        studentPhone: '',
        marketingChannel: request.sourceLabel || '?諭沅??꾨뱜 ?怨룸뼖??,
        referralRoute: '疫꿸퀬?',
        consultationDate: request.consultationDate || format(new Date(), 'yyyy-MM-dd'),
        status: request.status || 'new',
        memo: [`??놃꺍: ${request.school || '-'}`, `???臾믩땾: ${formatDateTimeLabel(request.createdAt)}`].join('\n'),
        source: 'website',
        sourceRequestId: request.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdByUid: user?.uid || null,
      });
      await updateDoc(doc(firestore, 'centers', centerId, 'websiteConsultRequests', request.id), {
        linkedLeadId: leadRef.id,
        updatedAt: serverTimestamp(),
      });
      toast({ title: '???怨룸뼖????곷열???귐됰굡 DB嚥???瑗??щ빍??', description: '??녠숲 ??얜궖 DB?癒?퐣 ?袁⑸꺗 ?怨룸뼖 ?怨밴묶????곷선???온?귐뗫막 ????됰뮸??덈뼄.' });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: '?귐됰굡 ??猷???쎈솭', description: '?諭沅??꾨뱜 ?怨룸뼖????곷열????곗뺘 ?귐됰굡 DB嚥???由??餓???살첒揶쎛 獄쏆뮇源??됰뮸??덈뼄.' });
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
        title: '??? ?袁⑷퍥 ??疫??源낆쨯??,
        description: '?????귐됰굡????덉뜚/?온?귐뗭굨 ??녠숲 筌뤴뫀紐???疫??源낆쨯???袁⑥┷??뤿선 ??됰뮸??덈뼄.',
      });
      return;
    }
    setWaitlistModal({
      open: true,
      sourceLeadId: lead.id,
      studentName: lead.studentName || '',
      parentPhone: lead.parentPhone || '',
      studentPhone: lead.studentPhone || '',
      referralRoute: (lead.referralRoute as ReferralRoute) || '疫꿸퀬?',
      referrerName: lead.referrerName || '',
      serviceTypes,
      memo: '',
    });
  };

  const handleSaveWaitlist = async () => {
    if (!firestore || !centerId) return;
    if (!waitlistModal.studentName.trim()) {
      toast({ variant: 'destructive', title: '??낆젾 ?袁⑹뒄', description: '??덇문 ??已????낆젾??雅뚯눘苑??' });
      return;
    }
    setIsSavingWaitlist(true);
    try {
      const selectedServiceTypes = Array.from(new Set(waitlistModal.serviceTypes));
      if (selectedServiceTypes.length === 0) {
        toast({ variant: 'destructive', title: '?源낆쨯 ??쎈솭', description: '??뺥돩???醫륁굨??筌ㅼ뮇??1揶??醫뤾문??곻폒?紐꾩뒄.' });
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
          title: '??? ?源낆쨯??,
          description: '?醫뤾문????뺥돩???醫륁굨?? ??? ??疫??源낆쨯??뤿선 ??됰뮸??덈뼄.',
        });
        return;
      }

      const createdWaitlistRefs = await Promise.all(
        serviceTypesToCreate.map((serviceType) =>
          addDoc(collection(firestore, 'centers', centerId, 'admissionWaitlist'), {
        studentName: waitlistModal.studentName.trim(),
        parentPhone: waitlistModal.parentPhone.trim(),
        studentPhone: waitlistModal.studentPhone.trim(),
        serviceType,
        referralRoute: waitlistModal.referralRoute,
        referrerName: waitlistModal.referralRoute === '?곕뗄荑? ? waitlistModal.referrerName.trim() : '',
        status: 'waiting' as WaitlistStatus,
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
        title: '??뉖린 ??疫??源낆쨯 ?袁⑥┷',
        description: serviceTypesToCreate.map((type) => SERVICE_TYPE_META[type].label).join(', ') + ' ??疫?筌뤿굝????곕떽???됰뮸??덈뼄.',
      });
      setWaitlistModal(INITIAL_WAITLIST_MODAL());
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: '?源낆쨯 ??쎈솭', description: '??뉖린 ??疫??源낆쨯 餓???살첒揶쎛 獄쏆뮇源??됰뮸??덈뼄.' });
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
      toast({ variant: 'destructive', title: '?怨밴묶 癰궰野???쎈솭', description: '??疫??怨밴묶 癰궰野?餓???살첒揶쎛 獄쏆뮇源??됰뮸??덈뼄.' });
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
      toast({ title: '??疫???????????뤿???щ빍??' });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: '??????쎈솭', description: '??疫?????????餓???살첒揶쎛 獄쏆뮇源??됰뮸??덈뼄.' });
    }
  };

  const exportToCsv = () => {
    const headers = ['?怨룸뼖??, '?怨밴묶', '?醫롮뿯野껋럥以?, '?곕뗄荑??, '??덇문筌?, '??덇문?袁れ넅甕곕뜇??, '???筌뤴뫀梨?, '???筌뤴뫁??遺얠쓰??, '筌롫뗀??];
    const rows = filteredLeads.map((lead) => [
      lead.consultationDate || '',
      STATUS_META[lead.status || 'new']?.label || '',
      lead.referralRoute || lead.marketingChannel || '',
      lead.referrerName || '',
      lead.studentName || '',
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
    a.download = `?怨룸뼖DB_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!centerId) {
    return (
      <Card className="rounded-2xl border-none shadow-sm ring-1 ring-border/50">
        <CardContent className="p-6 text-sm font-semibold text-muted-foreground">
          ??녠숲 ?類ｋ궖揶쎛 ??곷선 ?怨룸뼖 DB???븍뜄???????곷뮸??덈뼄.
        </CardContent>
      </Card>
    );
  }

  // ???? Render ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

  return (
    <section className="space-y-4">
      {/* ???? Tab navigation ???? */}
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
          ??얜궖/?怨룸뼖 ?귐됰굡 DB
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
          ??뉖린 ??疫?DB
          {waitlistSummary.waiting > 0 && (
            <Badge className="border-none bg-orange-500 text-[10px] font-black text-white">
              {waitlistSummary.waiting}
            </Badge>
          )}
        </button>
      </div>

      {/* ?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름
          TAB 1 ????얜궖/?怨룸뼖 ?귐됰굡 DB
      ?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름 */}
      {activeTab === 'leads' && (
        <Card className="rounded-2xl border-none shadow-sm ring-1 ring-border/50">
          <CardHeader className={cn(isMobile ? 'p-5' : 'p-6')}>
            <div className={cn('flex items-start justify-between gap-3', isMobile ? 'flex-col' : 'flex-row')}>
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-lg font-black">
                  <Megaphone className="h-5 w-5 text-primary" />
                  ??얜궖/?怨룸뼖 ?귐됰굡 DB
                </CardTitle>
                <CardDescription className="font-semibold">
                  ?怨룸뼖 ????덇문/???筌??怨뺤뵭筌ｌ꼶? ??낆젾??랁??怨밴묶???곕뗄???롫뮉 CRM??낅빍??
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
                ?臾? ??쇱뒲嚥≪뮆諭?
              </Button>
            </div>
          </CardHeader>

          <CardContent className={cn('space-y-4', isMobile ? 'p-5 pt-0' : 'p-6 pt-0')}>
            {/* ???? ?諭沅??꾨뱜 ?怨룸뼖???臾믩땾 ???? */}
            <div className="rounded-xl border border-orange-100 bg-orange-50/60 p-4">
              <div className={cn('flex gap-3', isMobile ? 'flex-col' : 'items-start justify-between')}>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Globe2 className="h-4 w-4 text-[#FF7A16]" />
                    <p className="text-sm font-black text-slate-900">?諭沅??꾨뱜 ?怨룸뼖???臾믩땾</p>
                  </div>
                  <p className="text-xs font-semibold text-slate-600">
                    ??뺣뎃??륁뵠筌왖 獄쎻뫖揆 ?怨룸뼖夷??뉖린 ?얜챷?썲첎? ???怨몃열???怨뺤쨮 ?蹂?뿯??덈뼄. ?袁⑹뒄??롢늺 ??곗뺘 ?귐됰굡 DB嚥???爰??袁⑸꺗 ?怨룸뼖????곷선揶?????됰뮸??덈뼄.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="border-none bg-transparent text-[#C25A00] shadow-none">?袁⑷퍥 {websiteSummary.total}椰?/Badge>
                  <Badge className="border-none bg-transparent text-blue-700 shadow-none">?醫됲뇣 {websiteSummary.newCount}椰?/Badge>
                  <Badge className="border-none bg-transparent text-amber-700 shadow-none">?怨뺤뵭餓?{websiteSummary.contactedCount}椰?/Badge>
                </div>
              </div>

              <div className={cn('mt-3 grid gap-2', isMobile ? 'grid-cols-2' : 'grid-cols-4')}>
                <div className="rounded-lg bg-white px-3 py-2 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">??뺣뎃 獄쎻뫖揆</p>
                  <p className="mt-0.5 text-xl font-black text-slate-800">{visitSummary.landingViews}</p>
                  <p className="text-[10px] font-semibold text-slate-400">筌ｋ똾肉?{visitSummary.experienceViews}????釉?/p>
                </div>
                <div className="rounded-lg bg-white px-3 py-2 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">?⑥쥙? 獄쎻뫖揆??/p>
                  <p className="mt-0.5 text-xl font-black text-slate-800">{visitSummary.uniqueVisitors}</p>
                  <p className="text-[10px] font-semibold text-slate-400">餓λ쵎????볤탢</p>
                </div>
                <div className="rounded-lg bg-white px-3 py-2 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">甕곌쑵??????/p>
                  <p className="mt-0.5 text-xl font-black text-slate-800">{visitSummary.entryClicks}</p>
                  <p className="text-[10px] font-semibold text-slate-400">嚥≪뮄????源껊궗 {visitSummary.loginSuccesses}??/p>
                </div>
                <div className="rounded-lg bg-white px-3 py-2 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">?怨룸뼖???袁れ넎??/p>
                  <p className="mt-0.5 text-xl font-black text-slate-800">
                    {visitSummary.formConversionRate !== null ? `${visitSummary.formConversionRate}%` : '-'}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-400">獄쎻뫖揆 ?????얜챷??/p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {websiteRequestsLoading ? (
                  <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-orange-200 bg-white/80">
                    <Loader2 className="h-5 w-5 animate-spin text-[#FF7A16]" />
                  </div>
                ) : filteredWebsiteRequests.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-orange-200 bg-white/80 px-4 py-6 text-center text-sm font-semibold text-slate-500">
                    ?袁⑹춦 ?諭沅??꾨뱜 ?怨룸뼖??깆몵嚥??臾믩땾????곷열????곷뮸??덈뼄.
                  </div>
                ) : (
                  filteredWebsiteRequests.slice(0, 8).map((request) => (
                    <div key={request.id} className="rounded-xl border border-orange-100 bg-white px-4 py-3 shadow-sm">
                      <div className={cn('flex gap-3', isMobile ? 'flex-col' : 'items-start justify-between')}>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-black text-slate-900">{request.studentName || '(??덇문筌?沃섎챷???'}</p>
                            <Badge className={cn('border text-[10px] font-black', STATUS_META[request.status || 'new'].className)}>
                              {STATUS_META[request.status || 'new'].label}
                            </Badge>
                            {request.serviceType && (
                              <Badge className={cn('border text-[10px] font-black', SERVICE_TYPE_META[request.serviceType].color)}>
                                {request.requestTypeLabel || SERVICE_TYPE_META[request.serviceType].label}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[10px] font-black">
                              {request.sourceLabel || '?諭沅??꾨뱜'}
                            </Badge>
                          </div>
                          <p className="text-xs font-semibold text-slate-600">
                            ??놃꺍: {request.school || '-'} 夷??怨뺤뵭筌? {request.consultPhone || '-'}
                          </p>
                          <p className="text-[11px] font-semibold text-slate-500">
                            ?臾믩땾?? {request.consultationDate || '-'} 夷??臾믩땾??볦퍟: {formatDateTimeLabel(request.createdAt)}
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
                            {request.linkedLeadId ? '?귐됰굡 ??猷?? : '?귐됰굡 DB嚥???猷?}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ???? Summary cards ???? */}
            <div className={cn('grid gap-3', isMobile ? 'grid-cols-2' : 'md:grid-cols-4')}>
              <Card className="rounded-xl border-none bg-primary shadow-sm">
                <CardContent className="p-4">
                  <p className="text-[11px] font-bold text-black">?袁⑷퍥 ?귐됰굡</p>
                  <p className="mt-1 text-2xl font-black text-black">{summary.total}</p>
                </CardContent>
              </Card>
              <Card className="rounded-xl border-none shadow-sm ring-1 ring-border/50">
                <CardContent className="p-4">
                  <p className="text-[11px] font-bold text-muted-foreground">?怨룸뼖?袁⑥┷</p>
                  <p className="mt-1 text-2xl font-black text-indigo-600">{summary.consulted}</p>
                </CardContent>
              </Card>
              <Card className="rounded-xl border-none shadow-sm ring-1 ring-border/50">
                <CardContent className="p-4">
                  <p className="text-[11px] font-bold text-muted-foreground">?源낆쨯?袁⑥┷</p>
                  <p className="mt-1 text-2xl font-black text-emerald-600">{summary.enrolled}</p>
                </CardContent>
              </Card>
              <Card className="rounded-xl border-none shadow-sm ring-1 ring-border/50">
                <CardContent className="p-4">
                  <p className="text-[11px] font-bold text-muted-foreground">?袁れ넎??/p>
                  <p className="mt-1 text-2xl font-black">{summary.conversionRate.toFixed(1)}%</p>
                </CardContent>
              </Card>
            </div>

            {/* ???? ?醫롮뿯 野껋럥以??怨몄맄 ???? */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
              <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">?醫롮뿯 野껋럥以??怨몄맄</p>
              <div className="flex flex-wrap gap-2">
                {summary.routes.length === 0 ? (
                  <span className="text-xs font-semibold text-slate-400">?袁⑹춦 ??낆젾???귐됰굡揶쎛 ??곷뮸??덈뼄.</span>
                ) : (
                  summary.routes.map((item) => (
                    <Badge key={item.route} variant="outline" className="rounded-full px-3 py-1 text-[11px] font-black">
                      {item.route} {item.count}椰?
                    </Badge>
                  ))
                )}
              </div>
            </div>

            {/* ???? ?怨룸뼖 ?귐됰굡 ?源낆쨯 ?????? */}
            <div className="rounded-xl border border-slate-100 p-4">
              <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'md:grid-cols-2')}>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-black">??덇문 ??已?/Label>
                  <Input
                    value={form.studentName}
                    onChange={(e) => setForm((p) => ({ ...p, studentName: e.target.value }))}
                    placeholder="?? 繹먃????
                    className="h-10 rounded-lg"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-black">???筌???已?/Label>
                  <Input
                    value={form.parentName}
                    onChange={(e) => setForm((p) => ({ ...p, parentName: e.target.value }))}
                    placeholder="?? 繹먃OO"
                    className="h-10 rounded-lg"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-black">???筌??袁れ넅甕곕뜇??/Label>
                  <Input
                    value={form.parentPhone}
                    onChange={(e) => setForm((p) => ({ ...p, parentPhone: e.target.value }))}
                    placeholder="010-1234-5678"
                    className="h-10 rounded-lg"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-black">??덇문 ?袁れ넅甕곕뜇??(?醫뤾문)</Label>
                  <Input
                    value={form.studentPhone}
                    onChange={(e) => setForm((p) => ({ ...p, studentPhone: e.target.value }))}
                    placeholder="010-0000-0000"
                    className="h-10 rounded-lg"
                  />
                </div>

                {/* ???? ?醫롮뿯 野껋럥以????? */}
                <div className="grid gap-1.5">
                  <Label className="text-xs font-black">?醫롮뿯 野껋럥以?/Label>
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

                {/* ???? ?곕뗄荑??(?곕뗄荑??醫뤾문 ??뺤춸) ???? */}
                {form.referralRoute === '?곕뗄荑? && (
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-black">?곕뗄荑????已?/Label>
                    <Input
                      value={form.referrerName}
                      onChange={(e) => setForm((p) => ({ ...p, referrerName: e.target.value }))}
                      placeholder="?? ??삳쭔?????筌뤴뫀??
                      className="h-10 rounded-lg"
                    />
                  </div>
                )}

                <div className="grid gap-1.5">
                  <Label className="text-xs font-black">?怨룸뼖??/Label>
                  <Input
                    type="date"
                    value={form.consultationDate}
                    onChange={(e) => setForm((p) => ({ ...p, consultationDate: e.target.value }))}
                    className="h-10 rounded-lg"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-black">?怨밴묶</Label>
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
                  <Label className="text-xs font-black">?怨룸뼖 ?醫륁굨</Label>
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
                      <SelectValue placeholder="?醫뤾문 ??딅맙" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SERVICE_TYPE_NONE} className="font-semibold text-slate-400">?醫뤾문 ??딅맙</SelectItem>
                      {(Object.entries(SERVICE_TYPE_META) as [ServiceType, { label: string; color: string }][]).map(([value, meta]) => (
                        <SelectItem key={value} value={value} className="font-semibold">{meta.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5 md:col-span-2">
                  <Label className="text-xs font-black">筌롫뗀??/Label>
                  <Textarea
                    value={form.memo}
                    onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))}
                    placeholder="?怨룸뼖 ??곸뒠, ?온???⑥눖?? ?袁⑸꺗 ?怨뺤뵭 ??깆젟 ?源놁뱽 疫꿸퀡以??뤾쉭??"
                    className="min-h-[92px] rounded-lg"
                  />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" className="h-10 rounded-lg font-black" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingId ? <Save className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                  {editingId ? '?귐됰굡 ??륁젟 ???? : '?怨룸뼖 ?귐됰굡 ?源낆쨯'}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" className="h-10 rounded-lg font-black" onClick={resetForm}>
                    ?紐꾩춿 ?띯뫁??
                  </Button>
                )}
              </div>
            </div>

            {/* ???? 野꺜??/ ?袁り숲 ???? */}
            <div className={cn('flex gap-2', isMobile ? 'flex-col' : 'items-center justify-between')}>
              <div className="relative w-full md:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="??已??袁れ넅甕곕뜇???醫롮뿯野껋럥以?野꺜??
                  className="h-10 rounded-lg pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | LeadStatus)}>
                <SelectTrigger className="h-10 w-full rounded-lg font-bold md:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">?袁⑷퍥 ?怨밴묶</SelectItem>
                  {Object.entries(STATUS_META).map(([value, meta]) => (
                    <SelectItem key={value} value={value}>{meta.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ???? ?귐됰굡 筌뤴뫖以????? */}
            <div className="space-y-2">
              {isLoading ? (
                <div className="flex h-28 items-center justify-center rounded-xl border border-dashed">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : filteredLeads.length === 0 ? (
                <div className="rounded-xl border border-dashed py-8 text-center text-sm font-semibold text-muted-foreground">
                  鈺곌퀗援??筌띿쉶???怨룸뼖 ?귐됰굡揶쎛 ??곷뮸??덈뼄.
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
                    ? '??덉뜚/??녠숲 ??疫꿸퀡踰묉에?몃쭡'
                    : leadActiveServiceTypes.length > 0
                      ? '?곕떽? ??疫??源낆쨯'
                      : '??뉖린 ??疫??源낆쨯';

                  return (
                  <Card key={lead.id} className="rounded-xl border-none shadow-sm ring-1 ring-border/60">
                    <CardContent className={cn('space-y-3', isMobile ? 'p-4' : 'p-5')}>
                      <div className={cn('flex gap-2', isMobile ? 'flex-col' : 'items-start justify-between')}>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-black text-slate-800">{lead.studentName || '(??덇문筌?沃섎챷???'}</p>
                            <Badge className={cn('border text-[10px] font-black', STATUS_META[lead.status || 'new'].className)}>
                              {STATUS_META[lead.status || 'new'].label}
                            </Badge>
                            {lead.serviceType && (
                              <Badge className={cn('border text-[10px] font-black', SERVICE_TYPE_META[lead.serviceType].color)}>
                                {SERVICE_TYPE_META[lead.serviceType].label}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[10px] font-black">
                              {lead.referralRoute || lead.marketingChannel || '疫꿸퀬?'}
                              {lead.referrerName ? ` 夷?${lead.referrerName}` : ''}
                            </Badge>
                            {leadWaitlistEntries.length > 0 && (
                              <Badge className="border-none bg-orange-100 text-[10px] font-black text-orange-700">
                                ??疫??源낆쨯??
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
                            <span className="inline-flex items-center gap-1.5">
                              <UserRoundPlus className="h-3.5 w-3.5 text-slate-400" />
                              {lead.parentName || '???筌뤴뫀梨?沃섎챷???}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5 text-slate-400" />
                              {lead.parentPhone || '-'}
                            </span>
                            {lead.studentPhone && <span>??덇문 ?怨뺤뵭筌? {lead.studentPhone}</span>}
                            <span>?怨룸뼖?? {lead.consultationDate || '-'}</span>
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
                            ??륁젟
                          </Button>
                          {/* ???? ??뉖린 ??疫??源낆쨯 甕곌쑵??(?怨룸뼖?袁⑥┷夷?源낆쨯?袁⑥┷) ???? */}
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
                            ????
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  );
                })
              )}
            </div>

            {/* ???? ??륁뵠筌왖??쇱뵠?????? */}
            {totalLeadsPages > 1 && (
              <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3">
                <p className="text-xs font-bold text-slate-500">
                  {leadsPage * LEADS_PER_PAGE + 1}??Math.min((leadsPage + 1) * LEADS_PER_PAGE, filteredLeads.length)} / ?袁⑷퍥 {filteredLeads.length}椰?
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
                    ??곸읈
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
                    ??쇱벉
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름
          TAB 2 ????뉖린 ??疫?DB
      ?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름 */}
      {activeTab === 'waitlist' && (
        <Card className="rounded-2xl border-none shadow-sm ring-1 ring-border/50">
          <CardHeader className={cn(isMobile ? 'p-5' : 'p-6')}>
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg font-black">
                <ListChecks className="h-5 w-5 text-orange-500" />
                ??뉖린 ??疫?DB
              </CardTitle>
              <CardDescription className="font-semibold">
                ??堉???덉뜚 / ?온?귐뗭굨 ??쎄숲?遺욧쉽????뉖린 ??疫?筌뤿굝??????? ?온?귐뗫???덈뼄.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className={cn('space-y-4', isMobile ? 'p-5 pt-0' : 'p-6 pt-0')}>
            {/* ???? 疫뀀떯????疫?獄쏄퀡瑗????? */}
            {waitlistSummary.waiting > 0 && (
              <div className="flex items-center gap-3 rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500 shadow-md shadow-orange-200">
                  <Flame className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-orange-800">
                    ?袁⑹삺 <span className="text-lg text-orange-600">{waitlistSummary.waiting}筌?/span> ??疫?餓?
                  </p>
                  <p className="text-xs font-semibold text-orange-600">
                    ?癒?봺揶쎛 ??뽰젟??뤿선 ??됰뮸??덈뼄 ????쥓???類ㅼ뵥 ????덇땀??雅뚯눘苑??
                  </p>
                </div>
              </div>
            )}

            {/* ???? Summary cards ???? */}
            <div className={cn('grid gap-3', isMobile ? 'grid-cols-2' : 'grid-cols-4')}>
              <Card className="rounded-xl border-none shadow-sm ring-1 ring-border/50">
                <CardContent className="p-4">
                  <p className="text-[11px] font-bold text-[#14295F]">?袁⑷퍥 ??疫?/p>
                  <p className="mt-1 text-2xl font-black text-[#14295F]">{waitlistSummary.waiting}</p>
                </CardContent>
              </Card>
              <Card className="rounded-xl border-none shadow-sm ring-1 ring-border/50">
                <CardContent className="p-4">
                  <p className="text-[11px] font-bold text-muted-foreground">??堉???덉뜚</p>
                  <p className="mt-1 text-2xl font-black text-violet-600">{waitlistSummary.waitingAcademy}</p>
                </CardContent>
              </Card>
              <Card className="rounded-xl border-none shadow-sm ring-1 ring-border/50">
                <CardContent className="p-4">
                  <p className="text-[11px] font-bold text-muted-foreground">??쎄숲?遺욧쉽??/p>
                  <p className="mt-1 text-2xl font-black text-sky-600">{waitlistSummary.waitingStudy}</p>
                </CardContent>
              </Card>
              <Card className="rounded-xl border-none shadow-sm ring-1 ring-border/50">
                <CardContent className="p-4">
                  <p className="text-[11px] font-bold text-muted-foreground">??뉖린?袁⑥┷</p>
                  <p className="mt-1 text-2xl font-black text-emerald-600">{waitlistSummary.admitted}</p>
                </CardContent>
              </Card>
            </div>

            {/* ???? ??뺥돩???醫륁굨 ?袁り숲 ?????? */}
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
              {(
                [
                  { value: 'all', label: '?袁⑷퍥' },
                  { value: 'korean_academy', label: '??堉???덉뜚' },
                  { value: 'study_center', label: '?온?귐뗭굨 ??쎄숲?遺욧쉽?? },
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

            {/* ???? 野꺜??+ ?怨밴묶 ?袁り숲 ???? */}
            <div className={cn('flex gap-2', isMobile ? 'flex-col' : 'items-center')}>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={waitlistSearch}
                  onChange={(e) => setWaitlistSearch(e.target.value)}
                  placeholder="??已??袁れ넅甕곕뜇????놃꺍 野꺜??
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
                  <SelectItem value="all">?袁⑷퍥 ?怨밴묶</SelectItem>
                  {Object.entries(WAITLIST_STATUS_META).map(([value, meta]) => (
                    <SelectItem key={value} value={value}>{meta.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ???? ??疫?筌뤴뫖以????? */}
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
                      ? '?袁⑹춦 ??뉖린 ??疫??源낆쨯????덇문????곷뮸??덈뼄.'
                      : '鈺곌퀗援??筌띿쉶????疫????????곷뮸??덈뼄.'}
                  </p>
                  {waitlistSummary.total === 0 && (
                    <p className="mt-1 text-xs font-medium text-slate-400">
                      ??얜궖/?怨룸뼖 ?귐됰굡 ??肉???怨룸뼖?袁⑥┷ ??덇문??"??뉖린 ??疫??源낆쨯" 甕곌쑵????袁ⓥ뀮?紐꾩뒄.
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
                            <Badge className={cn('border text-[10px] font-black', WAITLIST_STATUS_META[entry.status || 'waiting'].className)}>
                              {WAITLIST_STATUS_META[entry.status || 'waiting'].label}
                            </Badge>
                            <Badge className={cn('border text-[10px] font-black', SERVICE_TYPE_META[entry.serviceType].color)}>
                              {SERVICE_TYPE_META[entry.serviceType].label}
                            </Badge>
                            {entry.referralRoute && (
                              <Badge variant="outline" className="text-[10px] font-black">
                                {entry.referralRoute}
                                {entry.referrerName ? ` 夷?${entry.referrerName}` : ''}
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
                            <span className="inline-flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5 text-slate-400" />
                              {entry.parentPhone || '-'}
                            </span>
                            {entry.studentPhone && <span>??덇문: {entry.studentPhone}</span>}
                            {entry.school && <span>??놃꺍: {entry.school}</span>}
                            {entry.grade && <span>{entry.grade}</span>}
                            <span>??疫??源낆쨯?? {entry.waitlistDate || '-'}</span>
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
                            ????
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

      {/* ?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름
          ??뉖린 ??疫??源낆쨯 Dialog
      ?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름?癒λ름 */}
      <Dialog
        open={waitlistModal.open}
        onOpenChange={(open) => !open && setWaitlistModal(INITIAL_WAITLIST_MODAL())}
      >
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black">
              <ListChecks className="h-5 w-5 text-orange-500" />
              ??뉖린 ??疫??源낆쨯
            </DialogTitle>
            <DialogDescription className="font-semibold">
              ?袁⑥삋 ?類ｋ궖???類ㅼ뵥??랁???疫?筌뤿굝????곕떽???몃빍??
            </DialogDescription>
          </DialogHeader>

          {/* ???? ?袁⑹삺 ??疫??紐꾩뜚 揶쏅벡??獄쏄퀡瑗????? */}
          <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 p-3 text-white shadow-md shadow-orange-100">
            <Flame className="h-8 w-8 shrink-0" />
            <div>
              <p className="text-base font-black">
                ?袁⑹삺{' '}
                <span className="text-xl">
                  {waitlistServiceFilter === 'korean_academy'
                    ? waitlistSummary.waitingAcademy
                    : waitlistServiceFilter === 'study_center'
                      ? waitlistSummary.waitingStudy
                      : waitlistSummary.waiting}
                </span>
                筌???疫?餓?
              </p>
              <p className="text-xs font-semibold opacity-90">?癒?봺揶쎛 ??뽰젟??뤿선 ??됱몵????뺣ぎ???源낆쨯??뤾쉭??</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label className="text-xs font-black">??덇문 ??已?/Label>
              <Input
                value={waitlistModal.studentName}
                onChange={(e) => setWaitlistModal((p) => ({ ...p, studentName: e.target.value }))}
                className="h-10 rounded-lg"
              />
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs font-black">???筌??袁れ넅甕곕뜇??/Label>
              <Input
                value={waitlistModal.parentPhone}
                onChange={(e) => setWaitlistModal((p) => ({ ...p, parentPhone: e.target.value }))}
                className="h-10 rounded-lg"
              />
            </div>

            {/* ???? ??뺥돩???醫륁굨 ???? */}
            <div className="grid gap-1.5">
              <Label className="text-xs font-black">??뺥돩???醫륁굨</Label>
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

            {/* ???? ?醫롮뿯 野껋럥以????? */}
            <div className="grid gap-1.5">
              <Label className="text-xs font-black">?醫롮뿯 野껋럥以?/Label>
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

            {/* ???? ?곕뗄荑??(?곕뗄荑??醫뤾문?? ???? */}
            {waitlistModal.referralRoute === '?곕뗄荑? && (
              <div className="grid gap-1.5">
                <Label className="text-xs font-black">?곕뗄荑????已?/Label>
                <Input
                  value={waitlistModal.referrerName}
                  onChange={(e) => setWaitlistModal((p) => ({ ...p, referrerName: e.target.value }))}
                  placeholder="?? ??삳쭔?????筌뤴뫀??
                  className="h-10 rounded-lg"
                />
              </div>
            )}

            <div className="grid gap-1.5">
              <Label className="text-xs font-black">筌롫뗀??(?醫뤾문)</Label>
              <Textarea
                value={waitlistModal.memo}
                onChange={(e) => setWaitlistModal((p) => ({ ...p, memo: e.target.value }))}
                placeholder="?諭???鍮? ??彛?獄? ??뽰삂 ??됱젟???源놁뱽 疫꿸퀡以??뤾쉭??"
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
              ?띯뫁??
            </Button>
            <Button
              type="button"
              className="rounded-lg font-black"
              onClick={handleSaveWaitlist}
              disabled={isSavingWaitlist}
            >
              {isSavingWaitlist && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              ??疫??源낆쨯 ?袁⑥┷
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

