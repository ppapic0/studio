'use client';

import { useEffect, useMemo, useState } from 'react';
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
  writeBatch,
} from 'firebase/firestore';
import {
  ArrowRightCircle,
  Download,
  Flame,
  Inbox,
  ListChecks,
  Loader2,
  Megaphone,
  Phone,
  PlusCircle,
  Save,
  TrendingUp,
  Trash2,
  UserRoundPlus,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';

import { useCollection, useFirestore, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { useToast } from '@/hooks/use-toast';
import { canManageLeadRecords, canReadFinance, canTransitionLeadPipeline, isAdminRole } from '@/lib/dashboard-access';
import type { WebsiteBookingAccess, WebsiteConsultReservation, WebsiteSeatHoldRequest } from '@/lib/types';
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
import { AdminWorkbenchCommandBar } from '@/components/dashboard/admin-workbench-command-bar';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

// ─── Types ────────────────────────────────────────────────────────────────────

type LeadStatus = 'new' | 'contacted' | 'consulted' | 'enrolled' | 'closed';
type WaitlistStatus = 'waiting' | 'admitted' | 'cancelled';
type ServiceType = 'korean_academy' | 'study_center';
type ReferralRoute = '추천' | '네이버' | '카페' | '광고' | '기타';
type LeadDbSegment = 'contacts' | 'enrolled';

interface ConsultingLead {
  id: string;
  receiptId?: string;
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
  receiptId?: string;
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
  linkedConsultReservationId?: string | null;
  linkedConsultReservationIds?: string[];
  linkedSeatHoldRequestId?: string | null;
  linkedSeatHoldRequestIds?: string[];
  bookingAccess?: WebsiteBookingAccess | null;
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
  sourceWebsiteRequestId?: string;
  createdAt?: any;
  updatedAt?: any;
}

type WaitlistEntryWithOrder = WaitlistEntry;

interface WaitlistModal {
  open: boolean;
  sourceLeadId: string;
  sourceWebsiteRequestId: string;
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

interface UnifiedLeadListItem {
  key: string;
  type: 'lead' | 'website';
  id: string;
  receiptId?: string;
  studentName: string;
  parentName?: string;
  parentPhone: string;
  studentPhone?: string;
  school?: string;
  grade?: string;
  status: LeadStatus;
  serviceType?: ServiceType;
  requestTypeLabel?: string;
  sourceLabel: string;
  routeLabel?: string;
  consultationDate?: string;
  memo?: string;
  createdAt?: any;
  lead?: ConsultingLead;
  websiteRequest?: WebsiteConsultRequest;
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

const WEBSITE_BOOKING_BADGE_META = {
  reservation_confirmed: { label: '예약접수', className: 'bg-[#eef4ff] text-[#17326B] border-[#dbe5ff]' },
  reservation_completed: { label: '예약확정', className: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  seat_hold_pending: { label: '입금 확인 대기', className: 'bg-[#fff3e9] text-[#c26a1c] border-[#ffd9bd]' },
  seat_hold_held: { label: '좌석예약 확정', className: 'bg-orange-100 text-orange-700 border-orange-200' },
} as const;

const SERVICE_TYPE_META: Record<ServiceType, { label: string; color: string }> = {
  korean_academy: { label: '국어 학원', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  study_center: { label: '관리형 스터디센터', color: 'bg-sky-100 text-sky-700 border-sky-200' },
};

const ALL_SERVICE_TYPES: ServiceType[] = ['korean_academy', 'study_center'];

const LEAD_DB_SEGMENT_META: Record<LeadDbSegment, { label: string; description: string }> = {
  contacts: { label: '연락처만 있는 DB', description: '등록 전 상담·문의 연락처' },
  enrolled: { label: '재원생 DB', description: '등록 완료된 학생 연락처' },
};

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
  serviceType: 'study_center',
  memo: '',
});

const INITIAL_WAITLIST_MODAL = (): WaitlistModal => ({
  open: false,
  sourceLeadId: '',
  sourceWebsiteRequestId: '',
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

function getWaitlistSortDate(entry: Pick<WaitlistEntry, 'waitlistDate' | 'createdAt'>) {
  const waitlistMs = toDateMs(entry.waitlistDate);
  if (waitlistMs) return waitlistMs;
  return toDateMs(entry.createdAt);
}

function getWebsiteRequestStatusBadge(
  reservation?: WebsiteConsultReservation | null,
  seatHold?: WebsiteSeatHoldRequest | null
) {
  if (seatHold?.status === 'pending_transfer') return WEBSITE_BOOKING_BADGE_META.seat_hold_pending;
  if (seatHold?.status === 'held') return WEBSITE_BOOKING_BADGE_META.seat_hold_held;
  if (reservation?.status === 'confirmed') return WEBSITE_BOOKING_BADGE_META.reservation_confirmed;
  if (reservation?.status === 'completed') return WEBSITE_BOOKING_BADGE_META.reservation_completed;
  return null;
}

function getServiceTypeBadgeMeta(serviceType?: ServiceType | null) {
  if (serviceType && SERVICE_TYPE_META[serviceType]) return SERVICE_TYPE_META[serviceType];
  return { label: '서비스 미분류', color: 'bg-slate-100 text-slate-600 border-slate-200' };
}

function resolveLeadServiceBucket(serviceType?: ServiceType | null): ServiceType {
  return serviceType === 'korean_academy' ? 'korean_academy' : 'study_center';
}

function resolveLeadDbSegment(status?: LeadStatus | null): LeadDbSegment {
  return status === 'enrolled' ? 'enrolled' : 'contacts';
}

function getUnifiedLeadSortMs(item: Pick<UnifiedLeadListItem, 'consultationDate' | 'createdAt'>) {
  return toDateMs(item.createdAt) || toDateMs(item.consultationDate);
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
  const { activeMembership } = useAppContext();
  const { toast } = useToast();
  const canOpenFinance = canReadFinance(activeMembership?.role);
  const canManageLeadData = canManageLeadRecords(activeMembership?.role);
  const canTransitionPipeline = canTransitionLeadPipeline(activeMembership?.role);
  const canDeleteLeadData = isAdminRole(activeMembership?.role);

  const [form, setForm] = useState<LeadFormState>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | LeadStatus>('all');
  const [leadServiceFilter, setLeadServiceFilter] = useState<ServiceType>('study_center');
  const [leadDbSegmentFilter, setLeadDbSegmentFilter] = useState<LeadDbSegment>('contacts');
  const [leadsPage, setLeadsPage] = useState(0);
  const [movingWebsiteRequestId, setMovingWebsiteRequestId] = useState<string | null>(null);

  // Waitlist states
  const [waitlistModal, setWaitlistModal] = useState<WaitlistModal>(INITIAL_WAITLIST_MODAL);
  const [isSavingWaitlist, setIsSavingWaitlist] = useState(false);
  const [waitlistServiceFilter, setWaitlistServiceFilter] = useState<ServiceType>('study_center');
  const [waitlistStatusFilter, setWaitlistStatusFilter] = useState<'all' | WaitlistStatus>('all');
  const [waitlistSearch, setWaitlistSearch] = useState('');
  const [selectedDrawer, setSelectedDrawer] = useState<{ type: 'lead' | 'website' | 'waitlist'; id: string } | null>(null);

  useEffect(() => {
    setLeadsPage(0);
  }, [leadDbSegmentFilter, leadServiceFilter, searchTerm, statusFilter]);

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

  const websiteReservationsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'websiteConsultReservations'),
      orderBy('createdAt', 'desc'),
      limit(500)
    );
  }, [firestore, centerId]);
  const { data: websiteReservationsRaw } = useCollection<WebsiteConsultReservation>(websiteReservationsQuery, {
    enabled: !!centerId,
  });

  const websiteSeatHoldsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'websiteSeatHoldRequests'),
      orderBy('createdAt', 'desc'),
      limit(500)
    );
  }, [firestore, centerId]);
  const { data: websiteSeatHoldsRaw } = useCollection<WebsiteSeatHoldRequest>(websiteSeatHoldsQuery, {
    enabled: !!centerId,
  });

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
  const leadById = useMemo(() => {
    return new Map(leads.map((lead) => [lead.id, lead] as const));
  }, [leads]);

  const websiteRequests = useMemo(
    () => [...(websiteRequestsRaw || [])].sort((a, b) => toDateMs(b.createdAt) - toDateMs(a.createdAt)),
    [websiteRequestsRaw]
  );
  const websiteRequestById = useMemo(() => {
    return new Map(websiteRequests.map((request) => [request.id, request] as const));
  }, [websiteRequests]);
  const visibleWebsiteRequests = useMemo(
    () => websiteRequests.filter((request) => !request.linkedLeadId),
    [websiteRequests]
  );
  const movedWebsiteRequestCount = websiteRequests.length - visibleWebsiteRequests.length;
  const websiteReservations = useMemo(
    () => [...(websiteReservationsRaw || [])].sort((a, b) => toDateMs(b.createdAt) - toDateMs(a.createdAt)),
    [websiteReservationsRaw]
  );
  const websiteSeatHolds = useMemo(
    () => [...(websiteSeatHoldsRaw || [])].sort((a, b) => toDateMs(b.createdAt) - toDateMs(a.createdAt)),
    [websiteSeatHoldsRaw]
  );
  const latestWebsiteReservationByLeadId = useMemo(() => {
    const grouped = new Map<string, WebsiteConsultReservation>();
    websiteReservations.forEach((reservation) => {
      if (!reservation.leadId || grouped.has(reservation.leadId)) return;
      grouped.set(reservation.leadId, reservation);
    });
    return grouped;
  }, [websiteReservations]);
  const latestWebsiteSeatHoldByLeadId = useMemo(() => {
    const grouped = new Map<string, WebsiteSeatHoldRequest>();
    websiteSeatHolds.forEach((seatHold) => {
      if (!seatHold.leadId || grouped.has(seatHold.leadId)) return;
      grouped.set(seatHold.leadId, seatHold);
    });
    return grouped;
  }, [websiteSeatHolds]);

  const waitlist = useMemo<WaitlistEntryWithOrder[]>(() => {
    return [...(waitlistRaw || [])].sort((a, b) => {
      const statusOrder = { waiting: 0, admitted: 1, cancelled: 2 } as const;
      const statusGap = statusOrder[a.status || 'waiting'] - statusOrder[b.status || 'waiting'];
      if (statusGap !== 0) return statusGap;

      const isWaiting = (a.status || 'waiting') === 'waiting' && (b.status || 'waiting') === 'waiting';
      if (isWaiting) {
        const dateGap = getWaitlistSortDate(a) - getWaitlistSortDate(b);
        if (dateGap !== 0) return dateGap;
      }

      return toDateMs(b.createdAt) - toDateMs(a.createdAt);
    });
  }, [waitlistRaw]);

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
  const waitlistWebsiteRequestByEntryId = useMemo(() => {
    const grouped = new Map<string, WebsiteConsultRequest>();

    waitlist.forEach((entry) => {
      if (entry.serviceType !== 'study_center') return;

      const directWebsiteRequestId =
        typeof entry.sourceWebsiteRequestId === 'string' ? entry.sourceWebsiteRequestId.trim() : '';
      const leadSourceWebsiteRequestId =
        entry.sourceLeadId && leadById.get(entry.sourceLeadId)?.sourceRequestId
          ? String(leadById.get(entry.sourceLeadId)?.sourceRequestId).trim()
          : '';
      const resolvedWebsiteRequestId = directWebsiteRequestId || leadSourceWebsiteRequestId;
      if (!resolvedWebsiteRequestId) return;

      const linkedRequest = websiteRequestById.get(resolvedWebsiteRequestId);
      if (!linkedRequest) return;
      grouped.set(entry.id, linkedRequest);
    });

    return grouped;
  }, [leadById, waitlist, websiteRequestById]);

  const unifiedLeadItems = useMemo<UnifiedLeadListItem[]>(() => {
    return leads.map((lead) => ({
      key: `lead-${lead.id}`,
      type: 'lead' as const,
      id: lead.id,
      receiptId: lead.receiptId,
      studentName: lead.studentName || '(학생명 미입력)',
      parentName: lead.parentName,
      parentPhone: lead.parentPhone || '',
      studentPhone: lead.studentPhone,
      school: lead.school,
      grade: lead.grade,
      status: lead.status || 'new',
      serviceType: lead.serviceType,
      requestTypeLabel: lead.requestTypeLabel,
      sourceLabel: lead.source === 'website' ? '웹 접수 DB 이동' : '수기 리드',
      routeLabel: lead.referralRoute || lead.marketingChannel || (lead.source === 'website' ? '웹사이트' : '기타'),
      consultationDate: lead.consultationDate,
      memo: lead.memo,
      createdAt: lead.createdAt,
      lead,
    })).sort(
      (left, right) => getUnifiedLeadSortMs(right) - getUnifiedLeadSortMs(left)
    );
  }, [leads]);

  const LEADS_PER_PAGE = 5;

  const filteredLeads = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return unifiedLeadItems.filter((item) => {
      if (resolveLeadServiceBucket(item.serviceType) !== leadServiceFilter) return false;
      if (resolveLeadDbSegment(item.status) !== leadDbSegmentFilter) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (!keyword) return true;
      return [
        item.receiptId,
        item.studentName,
        item.parentName,
        item.parentPhone,
        item.studentPhone,
        item.school,
        item.grade,
        item.routeLabel,
        item.sourceLabel,
        item.requestTypeLabel,
        item.serviceType ? SERVICE_TYPE_META[item.serviceType].label : '서비스 미분류',
        item.memo,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    });
  }, [leadDbSegmentFilter, leadServiceFilter, searchTerm, statusFilter, unifiedLeadItems]);

  const pagedLeads = useMemo(
    () => filteredLeads.slice(leadsPage * LEADS_PER_PAGE, (leadsPage + 1) * LEADS_PER_PAGE),
    [filteredLeads, leadsPage]
  );
  const totalLeadsPages = Math.ceil(filteredLeads.length / LEADS_PER_PAGE);

  const filteredWaitlist = useMemo(() => {
    const keyword = waitlistSearch.trim().toLowerCase();
    return waitlist.filter((entry) => {
      if (entry.serviceType !== waitlistServiceFilter) return false;
      if (waitlistStatusFilter !== 'all' && entry.status !== waitlistStatusFilter) return false;
      if (!keyword) return true;
      return [entry.studentName, entry.parentPhone, entry.studentPhone, entry.school, entry.grade, entry.referralRoute, entry.referrerName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    });
  }, [waitlist, waitlistServiceFilter, waitlistStatusFilter, waitlistSearch]);

  const selectedLead = useMemo(
    () => (selectedDrawer?.type === 'lead' ? leads.find((lead) => lead.id === selectedDrawer.id) || null : null),
    [leads, selectedDrawer]
  );

  const selectedWebsiteRequest = useMemo(
    () => (selectedDrawer?.type === 'website' ? websiteRequests.find((request) => request.id === selectedDrawer.id) || null : null),
    [selectedDrawer, websiteRequests]
  );
  const selectedWebsiteReservation = useMemo(
    () => (selectedWebsiteRequest ? latestWebsiteReservationByLeadId.get(selectedWebsiteRequest.id) || null : null),
    [latestWebsiteReservationByLeadId, selectedWebsiteRequest]
  );
  const selectedWebsiteSeatHold = useMemo(
    () => (selectedWebsiteRequest ? latestWebsiteSeatHoldByLeadId.get(selectedWebsiteRequest.id) || null : null),
    [latestWebsiteSeatHoldByLeadId, selectedWebsiteRequest]
  );

  const selectedWaitlistEntry = useMemo(
    () => (selectedDrawer?.type === 'waitlist' ? waitlist.find((entry) => entry.id === selectedDrawer.id) || null : null),
    [selectedDrawer, waitlist]
  );
  const selectedWaitlistWebsiteRequest = useMemo(
    () => (selectedWaitlistEntry ? waitlistWebsiteRequestByEntryId.get(selectedWaitlistEntry.id) || null : null),
    [selectedWaitlistEntry, waitlistWebsiteRequestByEntryId]
  );

  const summary = useMemo(() => {
    const total = unifiedLeadItems.length;
    const enrolled = unifiedLeadItems.filter((item) => item.status === 'enrolled').length;
    const consulted = unifiedLeadItems.filter((item) => item.status === 'consulted').length;
    const conversionRate = total > 0 ? (enrolled / total) * 100 : 0;
    const routeCount = new Map<string, number>();
    for (const lead of unifiedLeadItems) {
      const key = lead.routeLabel || lead.sourceLabel || '기타';
      routeCount.set(key, (routeCount.get(key) || 0) + 1);
    }
    const routes = Array.from(routeCount.entries())
      .map(([route, count]) => ({ route, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
    return { total, enrolled, consulted, conversionRate, routes };
  }, [unifiedLeadItems]);

  const waitlistSummary = useMemo(() => {
    const total = waitlist.length;
    const waiting = waitlist.filter((e) => e.status === 'waiting').length;
    const waitingAcademy = waitlist.filter((e) => e.status === 'waiting' && e.serviceType === 'korean_academy').length;
    const waitingStudy = waitlist.filter((e) => e.status === 'waiting' && e.serviceType === 'study_center').length;
    const admitted = waitlist.filter((e) => e.status === 'admitted').length;
    const admittedAcademy = waitlist.filter((e) => e.status === 'admitted' && e.serviceType === 'korean_academy').length;
    const admittedStudy = waitlist.filter((e) => e.status === 'admitted' && e.serviceType === 'study_center').length;
    return { total, waiting, waitingAcademy, waitingStudy, admitted, admittedAcademy, admittedStudy };
  }, [waitlist]);

  const unifiedSummary = useMemo(
    () => ({
      total: unifiedLeadItems.length,
      leadCount: leads.length,
      websiteCount: visibleWebsiteRequests.length,
      movedWebsiteCount: movedWebsiteRequestCount,
      waitlistCount: waitlist.length,
      activeLeadCount: filteredLeads.length,
      contactLeadCount: unifiedLeadItems.filter((item) => resolveLeadDbSegment(item.status) === 'contacts').length,
      enrolledLeadCount: unifiedLeadItems.filter((item) => resolveLeadDbSegment(item.status) === 'enrolled').length,
      koreanLeadCount: unifiedLeadItems.filter((item) => resolveLeadServiceBucket(item.serviceType) === 'korean_academy').length,
      studyCenterLeadCount: unifiedLeadItems.filter((item) => resolveLeadServiceBucket(item.serviceType) === 'study_center').length,
    }),
    [filteredLeads.length, leads.length, movedWebsiteRequestCount, unifiedLeadItems, visibleWebsiteRequests.length, waitlist.length]
  );

  // ── Handlers ─────────────────────────────────────────────────────────────

  const resetForm = () => {
    setForm(INITIAL_FORM());
    setEditingId(null);
  };

  const handleEdit = (lead: ConsultingLead) => {
    if (!canManageLeadData) return;
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
      serviceType: lead.serviceType || 'study_center',
      memo: lead.memo || '',
    });
  };

  const handleSave = async () => {
    if (!firestore || !centerId || !canManageLeadData) return;
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
        serviceType: form.serviceType || 'study_center',
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
    if (!firestore || !centerId || !canDeleteLeadData) return;
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
    if (!firestore || !centerId || !canManageLeadData) return;
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
    if (!firestore || !centerId || !canManageLeadData) return;
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
    if (!firestore || !centerId || !canDeleteLeadData) return;
    try {
      await deleteDoc(doc(firestore, 'centers', centerId, 'websiteConsultRequests', requestId));
      toast({ title: '웹 상담 접수가 삭제되었습니다.' });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: '삭제 실패', description: '웹 상담 접수 삭제 중 오류가 발생했습니다.' });
    }
  };

  const handleMoveWebsiteRequestToDb = async (request: WebsiteConsultRequest) => {
    if (!firestore || !centerId || !canManageLeadData) return;
    if (request.linkedLeadId) {
      toast({ title: '이미 DB로 이동된 접수입니다.' });
      return;
    }

    setMovingWebsiteRequestId(request.id);
    try {
      const batch = writeBatch(firestore);
      const leadRef = doc(collection(firestore, 'centers', centerId, 'consultingLeads'));
      const websiteRequestRef = doc(firestore, 'centers', centerId, 'websiteConsultRequests', request.id);
      const existingWaitlistEntries = waitlistBySourceWebsiteRequestId.get(request.id) || [];
      const shouldCreateWaitlist =
        request.requestType === 'study_center_waitlist' && existingWaitlistEntries.length === 0;

      batch.set(leadRef, {
        receiptId: request.receiptId || '',
        studentName: request.studentName || '',
        parentName: '',
        parentPhone: request.consultPhone || '',
        studentPhone: '',
        school: request.school || '',
        grade: request.grade || '',
        marketingChannel: request.sourceLabel || '웹사이트 상담폼',
        referralRoute: '기타',
        referrerName: '',
        consultationDate: request.consultationDate || format(new Date(), 'yyyy-MM-dd'),
        status: request.status || 'new',
        serviceType: request.serviceType || 'study_center',
        requestType: request.requestType || '',
        requestTypeLabel: request.requestTypeLabel || '',
        memo: request.requestTypeLabel
          ? `${request.requestTypeLabel} 접수에서 DB 이동`
          : '웹사이트 상담폼 접수에서 DB 이동',
        source: 'website',
        sourceRequestId: request.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdByUid: user?.uid || null,
      });

      batch.update(websiteRequestRef, {
        linkedLeadId: leadRef.id,
        updatedAt: serverTimestamp(),
      });

      existingWaitlistEntries.forEach((entry) => {
        batch.update(doc(firestore, 'centers', centerId, 'admissionWaitlist', entry.id), {
          sourceLeadId: leadRef.id,
          updatedAt: serverTimestamp(),
        });
      });

      if (shouldCreateWaitlist) {
        const waitlistRef = doc(collection(firestore, 'centers', centerId, 'admissionWaitlist'));
        batch.set(waitlistRef, {
          studentName: request.studentName || '',
          parentPhone: request.consultPhone || '',
          studentPhone: '',
          school: request.school || '',
          grade: request.grade || '',
          serviceType: 'study_center' as ServiceType,
          referralRoute: '기타',
          referrerName: '',
          status: 'waiting' as WaitlistStatus,
          memo: request.requestTypeLabel ? `${request.requestTypeLabel} 접수에서 DB 이동` : '웹사이트 입학 대기 접수',
          waitlistDate: request.consultationDate || format(new Date(), 'yyyy-MM-dd'),
          sourceLeadId: leadRef.id,
          sourceWebsiteRequestId: request.id,
          receiptId: request.receiptId || '',
          requestType: request.requestType || '',
          requestTypeLabel: request.requestTypeLabel || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();
      toast({
        title: 'DB로 이동 완료',
        description: shouldCreateWaitlist
          ? '리드 DB와 입학 대기 DB에 함께 반영했습니다.'
          : '새 상담 접수를 리드 DB로 이동했습니다.',
      });
      setLeadServiceFilter(resolveLeadServiceBucket(request.serviceType));
      setLeadDbSegmentFilter('contacts');
      setSelectedDrawer({ type: 'lead', id: leadRef.id });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'DB 이동 실패', description: '웹 상담 접수를 DB로 이동하는 중 오류가 발생했습니다.' });
    } finally {
      setMovingWebsiteRequestId(null);
    }
  };

  const openWaitlistModal = (lead: ConsultingLead) => {
    if (!canTransitionPipeline) return;
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
      sourceWebsiteRequestId: lead.source === 'website' ? lead.sourceRequestId || '' : '',
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

  const openWaitlistModalFromWebsiteRequest = (request: WebsiteConsultRequest) => {
    if (!canTransitionPipeline) return;
    const existingEntries = waitlistBySourceWebsiteRequestId.get(request.id) || [];
    const existingActiveServiceTypes = new Set<ServiceType>(
      existingEntries.filter((entry) => entry.status !== 'cancelled').map((entry) => entry.serviceType)
    );
    const availableServiceTypes = ALL_SERVICE_TYPES.filter((serviceType) => !existingActiveServiceTypes.has(serviceType));
    const preferredServiceTypes = request.serviceType ? [request.serviceType] : ALL_SERVICE_TYPES;
    const serviceTypes = preferredServiceTypes
      .filter((serviceType) => availableServiceTypes.includes(serviceType))
      .slice(0, ALL_SERVICE_TYPES.length);

    if (serviceTypes.length === 0) {
      toast({
        title: '이미 전체 대기 등록됨',
        description: '해당 웹 접수는 학원/관리형 센터 모두 대기 등록이 완료되어 있습니다.',
      });
      return;
    }

    setWaitlistModal({
      open: true,
      sourceLeadId: request.linkedLeadId || '',
      sourceWebsiteRequestId: request.id,
      studentName: request.studentName || '',
      parentPhone: request.consultPhone || '',
      studentPhone: '',
      school: request.school || '',
      grade: request.grade || '',
      referralRoute: '기타',
      referrerName: '',
      serviceTypes,
      memo: request.requestTypeLabel ? `${request.requestTypeLabel} 접수` : '',
    });
  };

  const handleSaveWaitlist = async () => {
    if (!firestore || !centerId || !canTransitionPipeline) return;
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
        : waitlistModal.sourceWebsiteRequestId
          ? waitlistBySourceWebsiteRequestId.get(waitlistModal.sourceWebsiteRequestId) || []
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
        serviceTypesToCreate.map((serviceType) =>
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
        memo: waitlistModal.memo.trim(),
        waitlistDate: format(new Date(), 'yyyy-MM-dd'),
        sourceLeadId: waitlistModal.sourceLeadId || null,
        sourceWebsiteRequestId: waitlistModal.sourceWebsiteRequestId || null,
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
    if (!firestore || !centerId || !canManageLeadData) return;
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
    if (!firestore || !centerId || !canDeleteLeadData) return;
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
    const headers = ['구분', '서비스', '접수확인번호', '상담일', '상태', '유입경로', '학생명', '학교', '학년', '학생전화번호', '학부모명', '학부모전화번호', '메모'];
    const rows = filteredLeads.map((lead) => [
      lead.type === 'website' ? '웹 상담폼' : '수기 리드',
      lead.serviceType ? SERVICE_TYPE_META[lead.serviceType].label : '서비스 미분류',
      lead.receiptId || '',
      lead.consultationDate || '',
      STATUS_META[lead.status || 'new']?.label || '',
      lead.routeLabel || '',
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

  const exportWaitlistToCsv = () => {
    const headers = ['대기등록일', '상태', '서비스', '학생명', '학교', '학년', '학생전화번호', '학부모전화번호', '추천경로', '추천인', '메모'];
    const rows = filteredWaitlist.map((entry) => [
      entry.waitlistDate || '',
      WAITLIST_STATUS_META[entry.status || 'waiting']?.label || '',
      SERVICE_TYPE_META[entry.serviceType]?.label || '',
      entry.studentName || '',
      entry.school || '',
      entry.grade || '',
      entry.studentPhone || '',
      entry.parentPhone || '',
      entry.referralRoute || '',
      entry.referrerName || '',
      entry.memo || '',
    ]);
    const csvContent =
      '\uFEFF' + [headers, ...rows].map((row) => row.map((cell) => csvEscape(cell)).join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `입학대기DB_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
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
      {/* ════════════════════════════════════════════
          새 상담 접수함
      ════════════════════════════════════════════ */}
      <Card className="rounded-2xl border-none shadow-sm ring-1 ring-orange-100/80">
        <CardHeader className={cn(isMobile ? 'p-5' : 'p-6')}>
          <div className={cn('flex items-start justify-between gap-3', isMobile ? 'flex-col' : 'flex-row')}>
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg font-black">
                <Inbox className="h-5 w-5 text-orange-500" />
                새 상담 접수함
              </CardTitle>
              <CardDescription className="font-semibold">
                웹사이트 상담폼 원본은 여기서 먼저 확인하고, 필요할 때만 DB로 이동합니다.
              </CardDescription>
            </div>
            <Badge className="border border-orange-200 bg-orange-50 px-3 py-1.5 font-black text-orange-700">
              새 접수 {visibleWebsiteRequests.length}건
            </Badge>
          </div>
        </CardHeader>
        <CardContent className={cn('space-y-4', isMobile ? 'p-5 pt-0' : 'p-6 pt-0')}>
          <div className={cn('grid gap-3', isMobile ? 'grid-cols-2' : 'grid-cols-4')}>
            <Card className="rounded-xl border-none bg-orange-50 shadow-sm ring-1 ring-orange-100">
              <CardContent className="p-4">
                <p className="text-[11px] font-bold text-orange-700">새 접수</p>
                <p className="mt-1 text-2xl font-black text-orange-700">{visibleWebsiteRequests.length}</p>
              </CardContent>
            </Card>
            <Card className="rounded-xl border-none shadow-sm ring-1 ring-border/50">
              <CardContent className="p-4">
                <p className="text-[11px] font-bold text-muted-foreground">DB 이동 완료</p>
                <p className="mt-1 text-2xl font-black text-[#14295F]">{movedWebsiteRequestCount}</p>
              </CardContent>
            </Card>
            <Card className="rounded-xl border-none shadow-sm ring-1 ring-border/50">
              <CardContent className="p-4">
                <p className="text-[11px] font-bold text-muted-foreground">센터 접수</p>
                <p className="mt-1 text-2xl font-black text-sky-600">
                  {visibleWebsiteRequests.filter((request) => resolveLeadServiceBucket(request.serviceType) === 'study_center').length}
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-xl border-none shadow-sm ring-1 ring-border/50">
              <CardContent className="p-4">
                <p className="text-[11px] font-bold text-muted-foreground">학원 접수</p>
                <p className="mt-1 text-2xl font-black text-violet-600">
                  {visibleWebsiteRequests.filter((request) => resolveLeadServiceBucket(request.serviceType) === 'korean_academy').length}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-2">
            {websiteRequestsLoading ? (
              <div className="flex h-28 items-center justify-center rounded-xl border border-dashed">
                <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
              </div>
            ) : visibleWebsiteRequests.length === 0 ? (
              <div className="rounded-xl border border-dashed border-orange-100 bg-orange-50/30 py-8 text-center text-sm font-semibold text-muted-foreground">
                새로 확인할 웹사이트 상담 접수가 없습니다.
              </div>
            ) : (
              visibleWebsiteRequests.map((request) => {
                const serviceMeta = getServiceTypeBadgeMeta(request.serviceType);
                const requestBadge = getWebsiteRequestStatusBadge(
                  latestWebsiteReservationByLeadId.get(request.id),
                  latestWebsiteSeatHoldByLeadId.get(request.id)
                );
                const isMoving = movingWebsiteRequestId === request.id;

                return (
                  <Card key={request.id} className="rounded-xl border-none shadow-sm ring-1 ring-orange-100">
                    <CardContent className={cn('space-y-3', isMobile ? 'p-4' : 'p-5')}>
                      <div className={cn('flex gap-2', isMobile ? 'flex-col' : 'items-start justify-between')}>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-black text-slate-800">{request.studentName || '(학생명 미입력)'}</p>
                            {request.receiptId ? (
                              <Badge variant="outline" className="text-[10px] font-black text-[#14295F]">
                                접수번호 {request.receiptId}
                              </Badge>
                            ) : null}
                            <Badge className={cn('border text-[10px] font-black', STATUS_META[request.status || 'new'].className)}>
                              {STATUS_META[request.status || 'new'].label}
                            </Badge>
                            <Badge className={cn('border text-[10px] font-black', serviceMeta.color)}>
                              {request.requestTypeLabel || serviceMeta.label}
                            </Badge>
                            {requestBadge ? (
                              <Badge className={cn('border text-[10px] font-black', requestBadge.className)}>
                                {requestBadge.label}
                              </Badge>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
                            <span className="inline-flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5 text-slate-400" />
                              {request.consultPhone || '-'}
                            </span>
                            {request.school && <span>학교: {request.school}</span>}
                            {request.grade && <span>{request.grade}</span>}
                            <span>접수일: {request.consultationDate || '-'}</span>
                            <span>접수시각: {formatDateTimeLabel(request.createdAt)}</span>
                          </div>
                        </div>

                        <div className={cn('flex gap-2', isMobile ? 'w-full flex-wrap' : 'items-center')}>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-9 rounded-lg px-3 text-xs font-black"
                            onClick={() => setSelectedDrawer({ type: 'website', id: request.id })}
                          >
                            상세 보기
                          </Button>
                          {canManageLeadData ? (
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
                          ) : null}
                          {canManageLeadData ? (
                            <Button
                              type="button"
                              className="h-9 rounded-lg bg-[#14295F] px-3 text-xs font-black text-white hover:bg-[#0f214d] hover:text-white disabled:text-white/80"
                              onClick={() => void handleMoveWebsiteRequestToDb(request)}
                              disabled={isMoving}
                            >
                              {isMoving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <ArrowRightCircle className="mr-1 h-3.5 w-3.5" />}
                              DB로 이동
                            </Button>
                          ) : null}
                          {canDeleteLeadData ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="h-9 rounded-lg border-rose-200 px-3 text-xs font-black text-rose-600 hover:bg-rose-50"
                              onClick={() => void handleWebsiteDelete(request.id)}
                            >
                              <Trash2 className="mr-1 h-3.5 w-3.5" />
                              삭제
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* ════════════════════════════════════════════
          리드 DB
      ════════════════════════════════════════════ */}
      <Card className="rounded-2xl border-none shadow-sm ring-1 ring-border/50">
          <CardHeader className={cn(isMobile ? 'p-5' : 'p-6')}>
            <div className={cn('flex items-start justify-between gap-3', isMobile ? 'flex-col' : 'flex-row')}>
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-lg font-black">
                  <Megaphone className="h-5 w-5 text-primary" />
                  리드 DB
                </CardTitle>
                <CardDescription className="font-semibold">
                  DB로 이동된 상담 연락처만 관리합니다. 센터/학원, 재원생/연락처 DB를 분리해서 봅니다.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-xl font-black"
                  onClick={exportToCsv}
                  disabled={filteredLeads.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  리드 CSV
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-xl font-black"
                  onClick={exportWaitlistToCsv}
                  disabled={filteredWaitlist.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  대기 CSV
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className={cn('space-y-4', isMobile ? 'p-5 pt-0' : 'p-6 pt-0')}>
            {/* ── Summary cards ── */}
            <div className={cn('grid gap-3', isMobile ? 'grid-cols-2' : 'md:grid-cols-5')}>
              <Card className="rounded-xl border-none bg-primary shadow-sm">
                <CardContent className="p-4">
                  <p className="text-[11px] font-bold text-black">현재 보기</p>
                  <p className="mt-1 text-2xl font-black text-black">{unifiedSummary.activeLeadCount}</p>
                </CardContent>
              </Card>
              <Card className="rounded-xl border-none shadow-sm ring-1 ring-border/50">
                <CardContent className="p-4">
                  <p className="text-[11px] font-bold text-muted-foreground">전체 DB</p>
                  <p className="mt-1 text-2xl font-black text-indigo-600">{unifiedSummary.leadCount}</p>
                </CardContent>
              </Card>
              <Card className="rounded-xl border-none shadow-sm ring-1 ring-border/50">
                <CardContent className="p-4">
                  <p className="text-[11px] font-bold text-muted-foreground">연락처 DB</p>
                  <p className="mt-1 text-2xl font-black text-emerald-600">{unifiedSummary.contactLeadCount}</p>
                </CardContent>
              </Card>
              <Card className="rounded-xl border-none shadow-sm ring-1 ring-border/50">
                <CardContent className="p-4">
                  <p className="text-[11px] font-bold text-muted-foreground">재원생 DB</p>
                  <p className="mt-1 text-2xl font-black text-violet-600">{unifiedSummary.enrolledLeadCount}</p>
                </CardContent>
              </Card>
              <Card className="rounded-xl border-none shadow-sm ring-1 ring-border/50">
                <CardContent className="p-4">
                  <p className="text-[11px] font-bold text-muted-foreground">새 접수함</p>
                  <p className="mt-1 text-2xl font-black text-sky-600">{unifiedSummary.websiteCount}</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
                {(
                  [
                    { value: 'study_center', label: '센터 DB', count: unifiedSummary.studyCenterLeadCount },
                    { value: 'korean_academy', label: '학원 DB', count: unifiedSummary.koreanLeadCount },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setLeadServiceFilter(tab.value)}
                    className={cn(
                      'flex-1 rounded-md px-3 py-2 text-xs font-black transition-all',
                      leadServiceFilter === tab.value
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    )}
                  >
                    {tab.label} {tab.count}건
                  </button>
                ))}
              </div>
              <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
                {(
                  [
                    { value: 'contacts', count: unifiedSummary.contactLeadCount },
                    { value: 'enrolled', count: unifiedSummary.enrolledLeadCount },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setLeadDbSegmentFilter(tab.value)}
                    className={cn(
                      'flex-1 rounded-md px-3 py-2 text-xs font-black transition-all',
                      leadDbSegmentFilter === tab.value
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    )}
                  >
                    {LEAD_DB_SEGMENT_META[tab.value].label} {tab.count}건
                  </button>
                ))}
              </div>
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
            {canManageLeadData ? (
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
                      value={form.serviceType || 'study_center'}
                      onValueChange={(value) => setForm((p) => ({ ...p, serviceType: value as ServiceType }))}
                    >
                      <SelectTrigger className="h-10 rounded-lg font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
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
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4">
                <p className="text-sm font-black text-slate-700">현재 계정에서는 리드 DB를 조회할 수 있어요.</p>
                <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                  수정 권한이 열려 있는 계정에서는 바로 등록, 상태 변경, 입학 대기 등록까지 이어서 처리할 수 있습니다.
                </p>
              </div>
            )}

            <AdminWorkbenchCommandBar
              eyebrow="홍보/상담 워크벤치"
              title={`${leadServiceFilter === 'study_center' ? '센터' : '학원'} ${LEAD_DB_SEGMENT_META[leadDbSegmentFilter].label}`}
              description={LEAD_DB_SEGMENT_META[leadDbSegmentFilter].description}
              searchValue={searchTerm}
              onSearchChange={setSearchTerm}
              searchPlaceholder="이름, 학교, 전화번호, 서비스, 유입경로 검색"
              selectValue={statusFilter}
              onSelectChange={(value) => setStatusFilter(value as 'all' | LeadStatus)}
              selectOptions={[
                { value: 'all', label: '전체 상태' },
                ...Object.entries(STATUS_META).map(([value, meta]) => ({ value, label: meta.label })),
              ]}
              selectLabel="리드 상태"
                quickActions={[
                  ...(canManageLeadData
                    ? [{ label: editingId ? '입력 초기화' : '상담 리드 등록', icon: <PlusCircle className="h-4 w-4" />, onClick: resetForm }]
                    : []),
                ...(canOpenFinance ? [{ label: '수익분석', icon: <TrendingUp className="h-4 w-4" />, href: '/dashboard/revenue' }] : []),
                { label: '리드 CSV', icon: <Download className="h-4 w-4" />, onClick: exportToCsv },
              ]}
            />

            {/* ── 리드 목록 ── */}
            <div className="space-y-2">
              {isLoading || websiteRequestsLoading ? (
                <div className="flex h-28 items-center justify-center rounded-xl border border-dashed">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : filteredLeads.length === 0 ? (
                <div className="rounded-xl border border-dashed py-8 text-center text-sm font-semibold text-muted-foreground">
                  조건에 맞는 상담 리드가 없습니다.
                </div>
              ) : (
                pagedLeads.map((lead) => {
                  const leadWaitlistEntries =
                    lead.type === 'website'
                      ? waitlistBySourceWebsiteRequestId.get(lead.id) || []
                      : waitlistBySourceLeadId.get(lead.id) || [];
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

                  const serviceMeta = getServiceTypeBadgeMeta(lead.serviceType);
                  const leadServiceLabel = lead.requestTypeLabel || serviceMeta.label;
                  const requestBadge =
                    lead.websiteRequest
                      ? getWebsiteRequestStatusBadge(
                          latestWebsiteReservationByLeadId.get(lead.id),
                          latestWebsiteSeatHoldByLeadId.get(lead.id)
                        )
                      : null;

                  return (
                    <Card key={lead.key} className="rounded-xl border-none shadow-sm ring-1 ring-border/60">
                      <CardContent className={cn('space-y-3', isMobile ? 'p-4' : 'p-5')}>
                        <div className={cn('flex gap-2', isMobile ? 'flex-col' : 'items-start justify-between')}>
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-base font-black text-slate-800">{lead.studentName || '(학생명 미입력)'}</p>
                              {lead.receiptId ? (
                                <Badge variant="outline" className="text-[10px] font-black text-[#14295F]">
                                  접수번호 {lead.receiptId}
                                </Badge>
                              ) : null}
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
                              <Badge className={cn('border text-[10px] font-black', serviceMeta.color)}>
                                {leadServiceLabel}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] font-black">
                                {lead.sourceLabel}
                              </Badge>
                              {lead.routeLabel ? (
                                <Badge variant="outline" className="text-[10px] font-black">
                                  {lead.routeLabel}
                                </Badge>
                              ) : null}
                              {requestBadge ? (
                                <Badge className={cn('border text-[10px] font-black', requestBadge.className)}>
                                  {requestBadge.label}
                                </Badge>
                              ) : null}
                              {lead.websiteRequest?.linkedLeadId ? (
                                <Badge variant="outline" className="text-[10px] font-black text-[#14295F]">
                                  리드 연결됨
                                </Badge>
                              ) : null}
                              {leadActiveServiceTypes.map((serviceType) => (
                                <Badge
                                  key={`${lead.key}-${serviceType}`}
                                  className={cn('border text-[10px] font-black', SERVICE_TYPE_META[serviceType].color)}
                                >
                                  {SERVICE_TYPE_META[serviceType].label} 대기
                                </Badge>
                              ))}
                            </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
                            {lead.parentName ? (
                              <span className="inline-flex items-center gap-1.5">
                                <UserRoundPlus className="h-3.5 w-3.5 text-slate-400" />
                                {lead.parentName}
                              </span>
                            ) : null}
                            <span className="inline-flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5 text-slate-400" />
                              {lead.parentPhone || '-'}
                            </span>
                            {lead.studentPhone && <span>학생 연락처: {lead.studentPhone}</span>}
                            {lead.school && <span>학교: {lead.school}</span>}
                            {lead.grade && <span>학년: {lead.grade}</span>}
                            <span>상담일: {lead.consultationDate || '-'}</span>
                            <span>접수시각: {formatDateTimeLabel(lead.createdAt)}</span>
                          </div>
                          {lead.memo && <p className="text-xs font-medium text-slate-500">{lead.memo}</p>}
                        </div>

                        <div className={cn('flex gap-2', isMobile ? 'w-full flex-wrap' : 'items-center')}>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-9 rounded-lg px-3 text-xs font-black"
                            onClick={() => setSelectedDrawer({ type: lead.type, id: lead.id })}
                          >
                            상세 보기
                          </Button>
                          {canManageLeadData ? (
                            <Select
                              value={lead.status || 'new'}
                              onValueChange={(value) =>
                                lead.type === 'website'
                                  ? handleWebsiteStatusUpdate(lead.id, value as LeadStatus)
                                  : handleQuickStatusUpdate(lead.id, value as LeadStatus)
                              }
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
                          ) : null}
                          {canManageLeadData ? (
                            lead.lead ? (
                              <Button
                                type="button"
                                variant="outline"
                                className="h-9 rounded-lg px-3 text-xs font-black"
                                onClick={() => handleEdit(lead.lead as ConsultingLead)}
                              >
                                수정
                              </Button>
                            ) : null
                          ) : null}
                          {canTransitionPipeline && (
                            <Button
                              type="button"
                              variant="outline"
                              className={cn(
                                'h-9 rounded-lg px-3 text-xs font-black',
                                isLeadFullyWaitlisted
                                  ? 'border-orange-200 text-orange-500'
                                  : 'border-orange-300 text-orange-600 hover:bg-orange-50'
                              )}
                              onClick={() => {
                                if (isLeadFullyWaitlisted) return;
                                if (lead.websiteRequest) {
                                  openWaitlistModalFromWebsiteRequest(lead.websiteRequest);
                                } else if (lead.lead) {
                                  openWaitlistModal(lead.lead);
                                }
                              }}
                              disabled={isLeadFullyWaitlisted}
                            >
                              <ListChecks className="mr-1 h-3.5 w-3.5" />
                              {waitlistButtonLabel}
                            </Button>
                          )}
                          {canDeleteLeadData ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="h-9 rounded-lg border-rose-200 px-3 text-xs font-black text-rose-600 hover:bg-rose-50"
                              onClick={() =>
                                lead.type === 'website'
                                  ? void handleWebsiteDelete(lead.id)
                                  : handleDelete(lead.id)
                              }
                            >
                              <Trash2 className="mr-1 h-3.5 w-3.5" />
                              삭제
                            </Button>
                          ) : null}
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

      {/* ════════════════════════════════════════════
          입학 대기 DB
      ════════════════════════════════════════════ */}
      <Card className="rounded-2xl border-none shadow-sm ring-1 ring-border/50">
          <CardHeader className={cn(isMobile ? 'p-5' : 'p-6')}>
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg font-black">
                <ListChecks className="h-5 w-5 text-orange-500" />
                입학 대기 DB
              </CardTitle>
              <CardDescription className="font-semibold">
                국어 학원과 관리형 스터디센터 대기 명단을 분리해서 관리합니다.
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
                  <p className="text-[11px] font-bold text-[#14295F]">현재 보기</p>
                  <p className="mt-1 text-2xl font-black text-[#14295F]">{filteredWaitlist.length}</p>
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
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-emerald-50 px-3 py-2">
                      <p className="text-[10px] font-bold text-emerald-700">국어</p>
                      <p className="mt-1 text-xl font-black text-emerald-600">{waitlistSummary.admittedAcademy}</p>
                    </div>
                    <div className="rounded-lg bg-sky-50 px-3 py-2">
                      <p className="text-[10px] font-bold text-sky-700">센터</p>
                      <p className="mt-1 text-xl font-black text-sky-600">{waitlistSummary.admittedStudy}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] font-semibold text-muted-foreground">
                    합계 <span className="font-black text-emerald-700">{waitlistSummary.admitted}</span>
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* ── 서비스 유형 필터 탭 ── */}
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
              {(
                [
                  { value: 'study_center', label: '관리형 스터디센터' },
                  { value: 'korean_academy', label: '국어 학원' },
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

            <AdminWorkbenchCommandBar
              eyebrow="입학 대기 워크벤치"
              title={`${waitlistServiceFilter === 'study_center' ? '스터디센터' : '국어 학원'} 입학 대기 DB`}
              description="선택한 DB 안에서만 대기 학생을 정렬하고 후속 조치를 이어갑니다."
              searchValue={waitlistSearch}
              onSearchChange={setWaitlistSearch}
              searchPlaceholder="이름, 학교, 전화번호 검색"
              selectValue={waitlistStatusFilter}
              onSelectChange={(value) => setWaitlistStatusFilter(value as 'all' | WaitlistStatus)}
              selectOptions={[
                { value: 'all', label: '전체 상태' },
                ...Object.entries(WAITLIST_STATUS_META).map(([value, meta]) => ({ value, label: meta.label })),
              ]}
              selectLabel="대기 상태"
              quickActions={[
                ...(canOpenFinance ? [{ label: '수익분석', icon: <TrendingUp className="h-4 w-4" />, href: '/dashboard/revenue' }] : []),
                { label: '대기 CSV', icon: <Download className="h-4 w-4" />, onClick: exportWaitlistToCsv },
              ]}
            >
              <div className="grid gap-1">
                <Label className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">서비스 필터</Label>
                <Select
                  value={waitlistServiceFilter}
                  onValueChange={(value) => setWaitlistServiceFilter(value as ServiceType)}
                >
                  <SelectTrigger className="h-11 min-w-[180px] rounded-xl border-2 font-black">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="study_center">관리형 스터디센터</SelectItem>
                    <SelectItem value="korean_academy">국어 학원</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </AdminWorkbenchCommandBar>

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
                      홍보/상담 리드 탭에서 "입학 대기 등록" 버튼으로 바로 넘길 수 있어요.
                    </p>
                  )}
                </div>
              ) : (
                filteredWaitlist.map((entry) => {
                  const linkedWebsiteRequest = waitlistWebsiteRequestByEntryId.get(entry.id) || null;

                  return (
                  <Card key={entry.id} className="rounded-xl border-none shadow-sm ring-1 ring-border/60">
                    <CardContent className={cn('space-y-2', isMobile ? 'p-4' : 'p-5')}>
                      <div className={cn('flex gap-2', isMobile ? 'flex-col' : 'items-start justify-between')}>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-black text-slate-800">{entry.studentName}</p>
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
                            {linkedWebsiteRequest && (
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
                          <Button
                            type="button"
                            variant="outline"
                            className="h-9 rounded-lg px-3 text-xs font-black"
                            onClick={() => setSelectedDrawer({ type: 'waitlist', id: entry.id })}
                          >
                            상세 보기
                          </Button>
                          {canManageLeadData ? (
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
                          ) : null}
                          {canDeleteLeadData ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="h-9 rounded-lg border-rose-200 px-3 text-xs font-black text-rose-600 hover:bg-rose-50"
                              onClick={() => void handleWaitlistDelete(entry.id, entry.sourceLeadId)}
                            >
                              <Trash2 className="mr-1 h-3.5 w-3.5" />
                              삭제
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
                })
              )}
            </div>
          </CardContent>
      </Card>

      <Sheet
        open={!!selectedDrawer}
        onOpenChange={(open) => {
          if (!open) setSelectedDrawer(null);
        }}
      >
      <SheetContent side="right" motionPreset="dashboard-premium" className="w-[96vw] max-w-2xl overflow-y-auto border-l-0 p-0 shadow-2xl">
          <div className="bg-gradient-to-br from-[#17306f] via-[#2046ab] to-[#2f66ff] px-6 py-6 text-white">
            <SheetHeader className="space-y-2 text-left">
              <SheetTitle className="text-2xl font-black tracking-tight text-white">
                {selectedLead?.studentName || selectedWebsiteRequest?.studentName || selectedWaitlistEntry?.studentName || '상세 보기'}
              </SheetTitle>
              <SheetDescription className="text-sm font-bold text-white/80">
                {selectedLead
                  ? '상담 리드의 기본 정보와 후속 조치, 입학 대기 연결 상태를 함께 봅니다.'
                  : selectedWebsiteRequest
                    ? '웹 상담 접수의 현재 상태와 리드 DB 연결 가능 여부를 바로 확인합니다.'
                    : selectedWaitlistEntry
                      ? '입학 대기 학생의 상태, 서비스, 연락처를 보고 바로 조치합니다.'
                      : '선택한 항목의 세부 정보를 확인합니다.'}
              </SheetDescription>
            </SheetHeader>
          </div>

          <div className="space-y-5 p-6">
            {selectedLead ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">기본 정보</p>
                    <div className="mt-3 space-y-2 text-sm font-bold text-slate-700">
                      <p>접수번호: {selectedLead.receiptId || '-'}</p>
                      <p>학부모: {selectedLead.parentName || '미입력'}</p>
                      <p>학부모 연락처: {selectedLead.parentPhone || '-'}</p>
                      <p>학생 연락처: {selectedLead.studentPhone || '-'}</p>
                      <p>학교/학년: {[selectedLead.school, selectedLead.grade].filter(Boolean).join(' · ') || '-'}</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">운영 상태</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge className={cn('border font-black', STATUS_META[selectedLead.status || 'new'].className)}>
                        {STATUS_META[selectedLead.status || 'new'].label}
                      </Badge>
                      {selectedLead.serviceType ? (
                        <Badge className={cn('border font-black', SERVICE_TYPE_META[selectedLead.serviceType].color)}>
                          {selectedLead.requestTypeLabel || SERVICE_TYPE_META[selectedLead.serviceType].label}
                        </Badge>
                      ) : null}
                      <Badge variant="outline" className="font-black">
                        {selectedLead.referralRoute || selectedLead.marketingChannel || '기타'}
                        {selectedLead.referrerName ? ` · ${selectedLead.referrerName}` : ''}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm font-bold text-slate-700">상담일: {selectedLead.consultationDate || '-'}</p>
                    <p className="mt-1 text-sm font-bold text-slate-500">{selectedLead.memo || '저장된 메모가 없습니다.'}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">바로 할 일</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {canManageLeadData ? (
                      <Button type="button" className="h-10 rounded-xl font-black" onClick={() => handleEdit(selectedLead)}>
                        수정 이어서 하기
                      </Button>
                    ) : null}
                    {canTransitionPipeline ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 rounded-xl font-black"
                        onClick={() => openWaitlistModal(selectedLead)}
                      >
                        입학 대기 등록
                      </Button>
                    ) : null}
                  </div>
                  {((waitlistBySourceLeadId.get(selectedLead.id) || []).length > 0) ? (
                    <div className="mt-4 rounded-xl border border-orange-100 bg-orange-50/70 p-3">
                      <p className="text-xs font-black text-orange-700">연결된 입학 대기</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(waitlistBySourceLeadId.get(selectedLead.id) || []).map((entry) => (
                          <Badge key={entry.id} className={cn('border font-black', SERVICE_TYPE_META[entry.serviceType].color)}>
                            {SERVICE_TYPE_META[entry.serviceType].label} · {WAITLIST_STATUS_META[entry.status || 'waiting'].label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}

            {selectedWebsiteRequest ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">웹 접수 정보</p>
                    <div className="mt-3 space-y-2 text-sm font-bold text-slate-700">
                      <p>접수번호: {selectedWebsiteRequest.receiptId || '-'}</p>
                      <p>연락처: {selectedWebsiteRequest.consultPhone || '-'}</p>
                      <p>학교/학년: {[selectedWebsiteRequest.school, selectedWebsiteRequest.grade].filter(Boolean).join(' · ') || '-'}</p>
                      <p>접수일: {selectedWebsiteRequest.consultationDate || '-'}</p>
                      <p>접수시각: {formatDateTimeLabel(selectedWebsiteRequest.createdAt)}</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">현재 상태</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge className={cn('border font-black', STATUS_META[selectedWebsiteRequest.status || 'new'].className)}>
                        {STATUS_META[selectedWebsiteRequest.status || 'new'].label}
                      </Badge>
                      {selectedWebsiteRequest.serviceType ? (
                        <Badge className={cn('border font-black', SERVICE_TYPE_META[selectedWebsiteRequest.serviceType].color)}>
                          {selectedWebsiteRequest.requestTypeLabel || SERVICE_TYPE_META[selectedWebsiteRequest.serviceType].label}
                        </Badge>
                      ) : null}
                      <Badge variant="outline" className="font-black">{selectedWebsiteRequest.sourceLabel || '웹사이트'}</Badge>
                      {(() => {
                        const requestBadge = getWebsiteRequestStatusBadge(
                          selectedWebsiteReservation,
                          selectedWebsiteSeatHold
                        );
                        return requestBadge ? (
                          <Badge className={cn('border font-black', requestBadge.className)}>
                            {requestBadge.label}
                          </Badge>
                        ) : null;
                      })()}
                    </div>
                    <p className="mt-3 text-sm font-bold text-slate-500">
                      {selectedWebsiteRequest.linkedLeadId
                        ? '이 접수는 이미 DB로 이동되어 원본 기록으로 보관 중입니다.'
                        : 'DB 이동 전 원본 접수함에 따로 보관 중입니다.'}
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#5c6e97]">웹 접수 데이터</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedWebsiteReservation ? (
                      <Badge variant="outline" className="font-black text-[#17326B]">
                        방문예약 {selectedWebsiteReservation.startsAt ? formatDateTimeLabel(selectedWebsiteReservation.startsAt) : '-'}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="font-black text-slate-600">방문예약 없음</Badge>
                    )}
                    {selectedWebsiteSeatHold ? (
                      <Badge variant="outline" className="font-black text-[#c26a1c]">
                        좌석예약 {selectedWebsiteSeatHold.seatLabel}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="font-black text-slate-600">좌석예약 없음</Badge>
                    )}
                    {selectedWebsiteRequest.linkedLeadId ? (
                      <Badge variant="outline" className="font-black text-[#14295F]">상담 리드 연결됨</Badge>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">바로 할 일</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {canManageLeadData && !selectedWebsiteRequest.linkedLeadId ? (
                      <Button
                        type="button"
                        className="h-10 rounded-xl bg-[#14295F] font-black text-white hover:bg-[#0f214d] hover:text-white disabled:text-white/80"
                        onClick={() => void handleMoveWebsiteRequestToDb(selectedWebsiteRequest)}
                        disabled={movingWebsiteRequestId === selectedWebsiteRequest.id}
                      >
                        {movingWebsiteRequestId === selectedWebsiteRequest.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowRightCircle className="mr-2 h-4 w-4" />
                        )}
                        DB로 이동
                      </Button>
                    ) : null}
                    {canManageLeadData ? (
                      <Select
                        value={selectedWebsiteRequest.status || 'new'}
                        onValueChange={(value) => handleWebsiteStatusUpdate(selectedWebsiteRequest.id, value as LeadStatus)}
                      >
                        <SelectTrigger className="h-10 min-w-[130px] rounded-xl text-xs font-black">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_META).map(([value, meta]) => (
                            <SelectItem key={value} value={value}>{meta.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null}
                    {canTransitionPipeline && selectedWebsiteRequest.linkedLeadId ? (
                      <Button
                        type="button"
                        className="h-10 rounded-xl font-black"
                        onClick={() => openWaitlistModalFromWebsiteRequest(selectedWebsiteRequest)}
                      >
                        입학 대기 등록
                      </Button>
                    ) : null}
                    {canDeleteLeadData ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 rounded-xl font-black text-rose-600"
                        onClick={() => void handleWebsiteDelete(selectedWebsiteRequest.id)}
                      >
                        삭제
                      </Button>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}

            {selectedWaitlistEntry ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">대기 정보</p>
                    <div className="mt-3 space-y-2 text-sm font-bold text-slate-700">
                      <p>학부모 연락처: {selectedWaitlistEntry.parentPhone || '-'}</p>
                      <p>학생 연락처: {selectedWaitlistEntry.studentPhone || '-'}</p>
                      <p>학교/학년: {[selectedWaitlistEntry.school, selectedWaitlistEntry.grade].filter(Boolean).join(' · ') || '-'}</p>
                      <p>대기 등록일: {selectedWaitlistEntry.waitlistDate || '-'}</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">현재 상태</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge className={cn('border font-black', WAITLIST_STATUS_META[selectedWaitlistEntry.status || 'waiting'].className)}>
                        {WAITLIST_STATUS_META[selectedWaitlistEntry.status || 'waiting'].label}
                      </Badge>
                      <Badge className={cn('border font-black', SERVICE_TYPE_META[selectedWaitlistEntry.serviceType].color)}>
                        {SERVICE_TYPE_META[selectedWaitlistEntry.serviceType].label}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm font-bold text-slate-500">{selectedWaitlistEntry.memo || '저장된 메모가 없습니다.'}</p>
                  </div>
                </div>
                {selectedWaitlistWebsiteRequest ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">연결된 웹 상담폼 접수</p>
                        <p className="mt-2 text-sm font-bold text-slate-700">
                          입학 대기 항목과 연결된 웹 접수 원본을 함께 확인합니다.
                        </p>
                      </div>
                      <Badge variant="outline" className="font-black text-orange-600">
                        웹 접수
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-1 text-sm font-bold text-slate-700">
                      <p>접수번호: {selectedWaitlistWebsiteRequest.receiptId || '-'}</p>
                      <p>연락처: {selectedWaitlistWebsiteRequest.consultPhone || '-'}</p>
                      <p>학교/학년: {[selectedWaitlistWebsiteRequest.school, selectedWaitlistWebsiteRequest.grade].filter(Boolean).join(' · ') || '-'}</p>
                    </div>
                  </div>
                ) : null}
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">바로 할 일</p>
                  {canManageLeadData ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(['waiting', 'admitted', 'cancelled'] as WaitlistStatus[]).map((status) => (
                        <Button
                          key={status}
                          type="button"
                          variant={selectedWaitlistEntry.status === status ? 'default' : 'outline'}
                          className="h-10 rounded-xl font-black"
                          onClick={() => void handleWaitlistStatusUpdate(selectedWaitlistEntry.id, status)}
                        >
                          {WAITLIST_STATUS_META[status].label}
                        </Button>
                      ))}
                      {canDeleteLeadData ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 rounded-xl font-black text-rose-600"
                          onClick={() => void handleWaitlistDelete(selectedWaitlistEntry.id, selectedWaitlistEntry.sourceLeadId)}
                        >
                          삭제
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm font-bold text-slate-500">
                      현재 계정은 입학 대기 상태를 조회할 수 있습니다.
                    </p>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      {/* ════════════════════════════════════════════
          입학 대기 등록 Dialog
      ════════════════════════════════════════════ */}
      <Dialog
        open={waitlistModal.open}
        onOpenChange={(open) => !open && setWaitlistModal(INITIAL_WAITLIST_MODAL())}
      >
      <DialogContent motionPreset="dashboard-premium" className="max-w-md rounded-2xl">
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
                    : waitlistSummary.waitingStudy}
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
