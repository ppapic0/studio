
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  MessageSquare, 
  Calendar, 
  Clock, 
  User, 
  CheckCircle2, 
  History, 
  Plus, 
  Loader2,
  FileText,
  ChevronRight,
  AlertCircle,
  Sparkles,
  CalendarPlus,
  ArrowRight,
  UserCheck,
  Check,
  X,
  FileEdit,
  Megaphone,
  GraduationCap,
  Filter,
  ClipboardCheck,
  Send,
  Link2,
  ShieldCheck,
  Wifi
} from 'lucide-react';
import { useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { collection, query, where, addDoc, serverTimestamp, Timestamp, updateDoc, doc, orderBy, limit, FieldValue } from 'firebase/firestore';
import { format } from 'date-fns';
import { CounselingReservation, CounselingLog, CenterMembership, StudentProfile, SupportThreadMessage, SupportThreadKind } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { isAdminRole, isTeacherOrAdminRole } from '@/lib/dashboard-access';

type ParentCommunicationRecord = {
  id: string;
  studentId: string;
  parentUid?: string;
  parentName?: string;
  senderRole?: 'parent' | 'student';
  senderUid?: string;
  senderName?: string;
  type: 'consultation' | 'request' | 'suggestion';
  requestCategory?: 'question' | 'request' | 'suggestion';
  title?: string;
  body?: string;
  channel?: 'visit' | 'phone' | 'online' | null;
  status?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  handledByName?: string;
  handledByUid?: string;
  replyBody?: string;
  repliedAt?: Timestamp;
  repliedByName?: string;
  repliedByUid?: string;
  supportKind?: SupportThreadKind | null;
  requestedUrl?: string | null;
  latestMessageAt?: Timestamp;
  latestMessagePreview?: string;
};

type CenterAnnouncementRecord = {
  id: string;
  title?: string;
  body?: string;
  audience?: 'student' | 'parent' | 'all';
  isPublished?: boolean;
  status?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

type StudentInquiryType = 'question' | 'suggestion' | 'firewall';
type SupportThreadTimelineEntry = {
  id: string;
  senderRole: SupportThreadMessage['senderRole'];
  senderName: string;
  body: string;
  createdAt?: Timestamp;
  supportKind?: SupportThreadKind | null;
  requestedUrl?: string | null;
  isInitialRequest?: boolean;
};

const STUDENT_SUPPORT_KIND_LABEL: Record<SupportThreadKind, string> = {
  student_question: '학생 질문',
  student_suggestion: '학생 건의',
  wifi_unblock: '와이파이 해제 요청',
};

function getStudentSupportKind(inquiryType: StudentInquiryType): SupportThreadKind {
  if (inquiryType === 'suggestion') return 'student_suggestion';
  if (inquiryType === 'firewall') return 'wifi_unblock';
  return 'student_question';
}

function normalizeRequestedUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withProtocol);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('invalid-url');
  }
  return parsed.toString();
}

function isStudentChatEnabledThread(item: Pick<ParentCommunicationRecord, 'senderRole' | 'supportKind'>) {
  return item.senderRole === 'student'
    && (item.supportKind === 'wifi_unblock' || item.supportKind === 'student_suggestion');
}

const isPublishedAnnouncement = (item: CenterAnnouncementRecord) => {
  const normalizedStatus = item?.status?.trim?.().toLowerCase();
  if (normalizedStatus) return normalizedStatus === 'published';
  if (typeof item?.isPublished === 'boolean') return item.isPublished;
  return true;
};

type AppointmentTab = 'reservations' | 'logs' | 'inquiries' | 'parent';

type AppointmentsPageContentProps = {
  forceTab?: AppointmentTab;
  showAll?: boolean;
};

const PREVIEW_LIMIT = 5;

export function AppointmentsPageContent({
  forceTab = 'reservations',
  showAll = false,
}: AppointmentsPageContentProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership, viewMode, currentTier } = useAppContext();
  const { toast } = useToast();

  const isMobile = viewMode === 'mobile';
  const [activeTab, setActiveTab] = useState<AppointmentTab>(forceTab);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [selectedResForLog, setSelectedResForLog] = useState<CounselingReservation | null>(null);
  
  const [aptDate, setAptDate] = useState('');
  const [aptTime, setAptTime] = useState('14:00');
  const [studentNote, setStudentNote] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  
  const [logType, setLogType] = useState<'academic' | 'life' | 'career'>('academic');
  const [logContent, setLogContent] = useState('');
  const [logImprovement, setLogImprovement] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<string>('all');
  const [parentTypeFilter, setParentTypeFilter] = useState<'all' | 'consultation' | 'request' | 'suggestion'>('all');
  const [parentStatusFilter, setParentStatusFilter] = useState<'all' | 'requested' | 'in_progress' | 'in_review' | 'done'>('all');
  const [inquiryType, setInquiryType] = useState<StudentInquiryType>('question');
  const [inquiryTitle, setInquiryTitle] = useState('');
  const [inquiryBody, setInquiryBody] = useState('');
  const [firewallUrl, setFirewallUrl] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [threadDrafts, setThreadDrafts] = useState<Record<string, string>>({});
  const [selectedSupportThread, setSelectedSupportThread] = useState<ParentCommunicationRecord | null>(null);
  const [announcementAudience, setAnnouncementAudience] = useState<'student' | 'parent' | 'all'>('all');
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const markedLogReadIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setActiveTab(forceTab);
  }, [forceTab]);

  useEffect(() => {
    setAptDate(format(new Date(), 'yyyy-MM-dd'));
  }, []);

  // 시즌 판별 로직
  const getSeasonName = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    if (month <= 2) return `${year - 1}년 겨울방학`;
    if (month <= 6) return `${year}년 1학기`;
    if (month <= 8) return `${year}년 여름방학`;
    if (month <= 12) return `${year}년 2학기`;
    return `${year}년 겨울방학`;
  };

  // 종속성 안정화
  const centerId = activeMembership?.id;
  const userRole = activeMembership?.role;
  const studentUid = user?.uid;
  const linkedStudentIds = useMemo(() => activeMembership?.linkedStudentIds || [], [activeMembership?.linkedStudentIds]);
  const linkedIdsKey = JSON.stringify(linkedStudentIds);

  const isStudent = userRole === 'student';
  const isParent = userRole === 'parent';
  const isStaff = isTeacherOrAdminRole(userRole);
  const isAdmin = isAdminRole(userRole);
  const canAccessCommunications = isStaff || isStudent;
  const shouldLoadReservations = activeTab === 'reservations' || showAll;
  const shouldLoadLogs = activeTab === 'logs' || showAll;
  const shouldLoadCommunications = activeTab === 'inquiries' || activeTab === 'parent' || showAll;
  const shouldLoadTeachers = isStaff || isRequestModalOpen;
  const shouldLoadAnnouncements = isStudent || isStaff;

  // 상담 희망 선생님 목록
  const teachersQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !shouldLoadTeachers) return null;
    return query(
      collection(firestore, 'centers', centerId, 'members'),
      where('role', '==', 'teacher')
    );
  }, [firestore, centerId, shouldLoadTeachers]);
  const { data: allStaff } = useCollection<CenterMembership>(teachersQuery, {
    enabled: !!centerId && shouldLoadTeachers,
  });

  const filteredTeachers = useMemo(() => {
    if (!allStaff) return [];
    return allStaff.filter(t => t.displayName !== '동백센터관리자');
  }, [allStaff]);

  const studentProfilesQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isStaff) return null;
    return collection(firestore, 'centers', centerId, 'students');
  }, [firestore, centerId, isStaff]);
  const { data: studentProfiles } = useCollection<StudentProfile>(studentProfilesQuery, { enabled: isStaff && !!centerId });

  const studentNameById = useMemo(() => {
    const map = new Map<string, string>();
    (studentProfiles || []).forEach((profile) => {
      if (profile.id) {
        map.set(profile.id, profile.name || profile.id);
      }
    });
    return map;
  }, [studentProfiles]);

  // 예약 내역 쿼리
  const reservationsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentUid || !userRole || !shouldLoadReservations) return null;
    const baseRef = collection(firestore, 'centers', centerId, 'counselingReservations');
    
    if (isStaff) return query(baseRef);
    if (isStudent) return query(baseRef, where('studentId', '==', studentUid));
    if (isParent && linkedStudentIds.length > 0) return query(baseRef, where('studentId', 'in', linkedStudentIds));
    
    return null;
  }, [firestore, centerId, studentUid, userRole, isStaff, isStudent, isParent, linkedIdsKey, shouldLoadReservations]);

  const { data: rawReservations, isLoading: resLoading } = useCollection<CounselingReservation>(reservationsQuery, {
    enabled: !!centerId && !!studentUid && !!userRole && shouldLoadReservations,
  });

  // 상담 일지 쿼리
  const logsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentUid || !userRole || !shouldLoadLogs) return null;
    const baseRef = collection(firestore, 'centers', centerId, 'counselingLogs');
    
    if (isStaff) return query(baseRef);
    if (isStudent) return query(baseRef, where('studentId', '==', studentUid));
    if (isParent && linkedStudentIds.length > 0) return query(baseRef, where('studentId', 'in', linkedStudentIds));
    
    return null;
  }, [firestore, centerId, studentUid, userRole, isStaff, isStudent, isParent, linkedIdsKey, shouldLoadLogs]);

  const { data: rawLogs, isLoading: logsLoading } = useCollection<CounselingLog>(logsQuery, {
    enabled: !!centerId && !!studentUid && !!userRole && shouldLoadLogs,
  });

  const announcementsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !shouldLoadAnnouncements) return null;
    return query(
      collection(firestore, 'centers', centerId, 'centerAnnouncements'),
      orderBy('createdAt', 'desc'),
      limit(30),
    );
  }, [firestore, centerId, shouldLoadAnnouncements]);
  const { data: rawAnnouncements, isLoading: announcementsLoading } = useCollection<CenterAnnouncementRecord>(announcementsQuery, {
    enabled: !!centerId && shouldLoadAnnouncements,
  });

  const parentCommunicationsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentUid || !canAccessCommunications || !shouldLoadCommunications) return null;
    const baseRef = collection(firestore, 'centers', centerId, 'parentCommunications');

    if (isStaff) return query(baseRef);
    if (isStudent) return query(baseRef, where('senderUid', '==', studentUid));

    return null;
  }, [firestore, centerId, studentUid, canAccessCommunications, isStaff, isStudent, shouldLoadCommunications]);
  const { data: rawParentCommunications, isLoading: parentCommsLoading } = useCollection<ParentCommunicationRecord>(parentCommunicationsQuery, {
    enabled: canAccessCommunications && !!centerId && !!studentUid && shouldLoadCommunications,
  });

  const supportMessagesQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentUid || !canAccessCommunications || !shouldLoadCommunications) return null;
    const baseRef = collection(firestore, 'centers', centerId, 'supportMessages');

    if (isStaff) return query(baseRef);
    if (isStudent) return query(baseRef, where('studentId', '==', studentUid));

    return null;
  }, [firestore, centerId, studentUid, canAccessCommunications, isStaff, isStudent, shouldLoadCommunications]);
  const { data: rawSupportMessages } = useCollection<SupportThreadMessage>(supportMessagesQuery, {
    enabled: canAccessCommunications && !!centerId && !!studentUid && shouldLoadCommunications,
  });

  const reservations = useMemo(() => {
    if (!rawReservations) return [];
    return [...rawReservations].sort((a, b) => (b.scheduledAt?.toMillis() || 0) - (a.scheduledAt?.toMillis() || 0));
  }, [rawReservations]);
  const reservationQuestionById = useMemo(() => {
    const map = new Map<string, string>();
    reservations.forEach((reservation) => {
      const question = reservation.studentNote?.trim();
      if (reservation.id && question) map.set(reservation.id, question);
    });
    return map;
  }, [reservations]);

  const parentCommunications = useMemo(() => {
    if (!rawParentCommunications) return [];
    return [...rawParentCommunications].sort((a, b) => {
      const aMs = a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
      const bMs = b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
      return bMs - aMs;
    });
  }, [rawParentCommunications]);

  const supportMessages = useMemo(() => {
    if (!rawSupportMessages) return [];
    return [...rawSupportMessages].sort((a, b) => {
      const aMs = a.createdAt?.toMillis?.() || 0;
      const bMs = b.createdAt?.toMillis?.() || 0;
      return aMs - bMs;
    });
  }, [rawSupportMessages]);

  const supportMessagesByCommunicationId = useMemo(() => {
    const map = new Map<string, SupportThreadMessage[]>();
    supportMessages.forEach((message) => {
      if (!message.communicationId) return;
      const current = map.get(message.communicationId) || [];
      current.push(message);
      map.set(message.communicationId, current);
    });
    return map;
  }, [supportMessages]);

  const filteredParentCommunications = useMemo(() => {
    return parentCommunications.filter((item) => {
      if (!isStaff) return true;
      const typeMatched = parentTypeFilter === 'all' || item.type === parentTypeFilter;
      const status = item.status || 'requested';
      const statusMatched = parentStatusFilter === 'all' || status === parentStatusFilter;
      return typeMatched && statusMatched;
    });
  }, [parentCommunications, parentTypeFilter, parentStatusFilter, isStaff]);

  const studentInquiries = useMemo(
    () => parentCommunications.filter((item) => item.senderRole === 'student' || item.senderUid === studentUid),
    [parentCommunications, studentUid]
  );

  const availableSeasons = useMemo(() => {
    if (!rawLogs) return [];
    const seasons = new Set<string>();
    rawLogs.forEach(log => {
      if (log.createdAt) {
        seasons.add(getSeasonName(log.createdAt.toDate()));
      }
    });
    return Array.from(seasons).sort().reverse();
  }, [rawLogs]);

  const filteredLogs = useMemo(() => {
    if (!rawLogs) return [];
    let list = [...rawLogs];
    
    if (selectedSeason !== 'all') {
      list = list.filter(log => log.createdAt && getSeasonName(log.createdAt.toDate()) === selectedSeason);
    }
    
    return list.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
  }, [rawLogs, selectedSeason]);

  const visibleReservations = useMemo(
    () => (showAll ? reservations : reservations.slice(0, PREVIEW_LIMIT)),
    [showAll, reservations]
  );
  const visibleLogs = useMemo(
    () => (showAll ? filteredLogs : filteredLogs.slice(0, PREVIEW_LIMIT)),
    [showAll, filteredLogs]
  );
  const visibleParentCommunications = useMemo(
    () => (showAll ? filteredParentCommunications : filteredParentCommunications.slice(0, PREVIEW_LIMIT)),
    [showAll, filteredParentCommunications]
  );
  const visibleStudentInquiries = useMemo(
    () => (showAll ? studentInquiries : studentInquiries.slice(0, PREVIEW_LIMIT)),
    [showAll, studentInquiries]
  );

  const studentAnnouncements = useMemo(() => {
    if (!rawAnnouncements) return [];
    return [...rawAnnouncements]
      .filter((item) => isPublishedAnnouncement(item))
      .filter((item) => item?.audience === 'student' || item?.audience === 'all' || !item?.audience)
      .sort((a, b) => (b?.createdAt?.toMillis?.() || 0) - (a?.createdAt?.toMillis?.() || 0));
  }, [rawAnnouncements]);
  const visibleStudentAnnouncements = useMemo(
    () => (showAll ? studentAnnouncements : studentAnnouncements.slice(0, PREVIEW_LIMIT)),
    [showAll, studentAnnouncements]
  );
  const staffAnnouncements = useMemo(() => {
    if (!rawAnnouncements || !isStaff) return [];
    return [...rawAnnouncements]
      .filter((item) => isPublishedAnnouncement(item))
      .sort((a, b) => (b?.createdAt?.toMillis?.() || 0) - (a?.createdAt?.toMillis?.() || 0));
  }, [rawAnnouncements, isStaff]);
  const visibleStaffAnnouncements = useMemo(
    () => (showAll ? staffAnnouncements : staffAnnouncements.slice(0, 3)),
    [showAll, staffAnnouncements]
  );
  const staffPendingReservations = useMemo(
    () => reservations.filter((item) => item.status === 'requested').length,
    [reservations]
  );
  const staffConfirmedReservations = useMemo(
    () => reservations.filter((item) => item.status === 'confirmed').length,
    [reservations]
  );
  const staffCompletedReservations = useMemo(
    () => reservations.filter((item) => item.status === 'done').length,
    [reservations]
  );
  const staffUnreadLogs = useMemo(
    () => filteredLogs.filter((item) => !item.readAt).length,
    [filteredLogs]
  );
  const staffOpenStudentInquiries = useMemo(
    () => studentInquiries.filter((item) => (item.status || 'requested') !== 'done').length,
    [studentInquiries]
  );
  const staffOpenParentRequests = useMemo(
    () => filteredParentCommunications.filter((item) => (item.status || 'requested') !== 'done').length,
    [filteredParentCommunications]
  );
  const staffTodayReservations = useMemo(() => {
    const now = new Date();
    return reservations.filter((item) => {
      const scheduledAt = item.scheduledAt?.toDate?.();
      if (!scheduledAt) return false;
      return (
        scheduledAt.getFullYear() === now.getFullYear() &&
        scheduledAt.getMonth() === now.getMonth() &&
        scheduledAt.getDate() === now.getDate()
      );
    }).length;
  }, [reservations]);
  const currentTabLabelMap: Record<AppointmentTab, string> = {
    reservations: '상담 예약',
    logs: '상담 일지',
    inquiries: '질문/건의',
    parent: '학부모 요청',
  };
  const currentStaffTab = showAll ? forceTab : activeTab;
  const staffWorkbenchStats = useMemo(
    () => [
      {
        label: '승인 대기',
        value: `${staffPendingReservations}건`,
        description: '확정 전 예약을 빠르게 처리합니다.',
      },
      {
        label: '오늘 일정',
        value: `${staffTodayReservations}건`,
        description: '오늘 예정된 상담 흐름을 한 번에 봅니다.',
      },
      {
        label: '미확인 일지',
        value: `${staffUnreadLogs}건`,
        description: '학생이 아직 확인하지 않은 피드백입니다.',
      },
      {
        label: '열린 요청',
        value: `${staffOpenParentRequests + staffOpenStudentInquiries}건`,
        description: '학생 질문과 학부모 요청을 함께 모아 봅니다.',
      },
    ],
    [
      staffOpenStudentInquiries,
      staffOpenParentRequests,
      staffPendingReservations,
      staffTodayReservations,
      staffUnreadLogs,
    ]
  );

  useEffect(() => {
    if (!firestore || !centerId || !user || isStaff) return;
    if (!showAll && activeTab !== 'logs') return;

    const unreadLogs = visibleLogs.filter((log) => {
      if (!log?.id || log.readAt) return false;
      if (markedLogReadIdsRef.current.has(log.id)) return false;
      return true;
    });
    if (!unreadLogs.length) return;

    unreadLogs.forEach((log) => markedLogReadIdsRef.current.add(log.id));

    void Promise.all(
      unreadLogs.map((log) =>
        updateDoc(doc(firestore, 'centers', centerId, 'counselingLogs', log.id), {
          readAt: serverTimestamp(),
          readByUid: user.uid,
          readByRole: isParent ? 'parent' : 'student',
        }).catch(() => {
          markedLogReadIdsRef.current.delete(log.id);
        })
      )
    );
  }, [firestore, centerId, user, isStaff, showAll, activeTab, visibleLogs, isParent]);

  const handleRequestAppointment = async () => {
    if (!firestore || !centerId || !user) return;
    if (!aptDate) {
      toast({ variant: "destructive", title: "날짜를 선택해 주세요." });
      return;
    }
    if (!selectedTeacherId) {
      toast({ variant: "destructive", title: "선생님을 선택해 주세요." });
      return;
    }

    setIsSubmitting(true);
    try {
      const scheduledAt = new Date(`${aptDate}T${aptTime}`);
      if (scheduledAt < new Date()) {
        toast({ variant: "destructive", title: "예약 불가", description: "현재 시간보다 이전으로는 신청할 수 없습니다." });
        setIsSubmitting(false);
        return;
      }

      const teacher = filteredTeachers?.find(t => t.id === selectedTeacherId);

      await addDoc(collection(firestore, 'centers', centerId, 'counselingReservations'), {
        studentId: user.uid,
        studentName: user.displayName || '학생',
        centerId: centerId,
        teacherId: selectedTeacherId,
        teacherName: teacher?.displayName || '선생님',
        scheduledAt: Timestamp.fromDate(scheduledAt),
        status: 'requested',
        studentNote: studentNote.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast({ title: "상담 신청 완료" });
      setIsRequestModalOpen(false);
      setStudentNote('');
      setSelectedTeacherId('');
    } catch (e: any) {
      toast({ variant: "destructive", title: "신청 실패", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (resId: string, status: CounselingReservation['status']) => {
    if (!firestore || !centerId) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(firestore, 'centers', centerId, 'counselingReservations', resId), {
        status,
        updatedAt: serverTimestamp()
      });
      
      let message = "";
      if (status === 'confirmed') message = "상담 승인 완료";
      else if (status === 'canceled') message = isStudent ? "상담 신청 취소 완료" : "상담 거절 완료";
      
      toast({ title: message });
    } catch (e: any) {
      toast({ variant: "destructive", title: "처리 실패" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenLogModal = (res: CounselingReservation) => {
    setSelectedResForLog(res);
    setLogContent('');
    setLogImprovement('');
    setLogType('academic');
    setIsLogModalOpen(true);
  };

  const handleSaveCounselLog = async () => {
    if (!firestore || !centerId || !user || !selectedResForLog || !logContent.trim()) return;
    setIsSubmitting(true);
    try {
      const logData = {
        studentId: selectedResForLog.studentId,
        studentName: selectedResForLog.studentName || '학생',
        teacherId: user.uid,
        teacherName: user.displayName || '선생님',
        type: logType,
        content: logContent.trim(),
        improvement: logImprovement.trim(),
        studentQuestion: selectedResForLog.studentNote?.trim() || '',
        createdAt: serverTimestamp(),
        readAt: null,
        reservationId: selectedResForLog.id
      };

      await addDoc(collection(firestore, 'centers', centerId, 'counselingLogs'), logData);
      await updateDoc(doc(firestore, 'centers', centerId, 'counselingReservations', selectedResForLog.id), {
        status: 'done',
        updatedAt: serverTimestamp()
      });

      toast({ title: "상담 일지 저장 및 완료 처리됨" });
      setIsLogModalOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "저장 실패" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitInquiry = async () => {
    if (!firestore || !centerId || !user || !isStudent) return;
    if (!inquiryBody.trim()) {
      toast({ variant: 'destructive', title: '문의 내용을 입력해 주세요.' });
      return;
    }

    let normalizedUrl: string | null = null;
    if (inquiryType === 'firewall') {
      try {
        normalizedUrl = normalizeRequestedUrl(firewallUrl);
      } catch {
        toast({ variant: 'destructive', title: '해제 요청 URL을 정확히 입력해 주세요.' });
        return;
      }
      if (!normalizedUrl) {
        toast({ variant: 'destructive', title: '해제 요청 URL을 입력해 주세요.' });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const communicationType: ParentCommunicationRecord['type'] =
        inquiryType === 'suggestion' ? 'suggestion' : 'request';
      const defaultTitle =
        inquiryType === 'firewall'
          ? '와이파이 방화벽 해제 요청'
          : inquiryType === 'question'
            ? '학생 질문'
            : '학생 건의사항';
      const supportKind = getStudentSupportKind(inquiryType);
      const inquiryContent = inquiryBody.trim();
      const communicationRef = await addDoc(collection(firestore, 'centers', centerId, 'parentCommunications'), {
        studentId: user.uid,
        senderRole: 'student',
        senderUid: user.uid,
        senderName: user.displayName || '학생',
        type: communicationType,
        requestCategory:
          inquiryType === 'firewall'
            ? 'request'
            : inquiryType === 'question'
              ? 'question'
              : 'suggestion',
        title: inquiryTitle.trim() || defaultTitle,
        body: inquiryContent,
        supportKind,
        requestedUrl: normalizedUrl,
        status: 'requested',
        latestMessageAt: serverTimestamp(),
        latestMessagePreview: inquiryContent.length > 90 ? `${inquiryContent.slice(0, 90)}…` : inquiryContent,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (inquiryType === 'firewall' || inquiryType === 'suggestion') {
        await addDoc(collection(firestore, 'centers', centerId, 'supportMessages'), {
          centerId,
          communicationId: communicationRef.id,
          studentId: user.uid,
          parentUid: null,
          senderRole: 'student',
          senderUid: user.uid,
          senderName: user.displayName || '학생',
          body: inquiryContent,
          supportKind,
          requestedUrl: normalizedUrl,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setSelectedSupportThread({
          id: communicationRef.id,
          studentId: user.uid,
          senderRole: 'student',
          senderUid: user.uid,
          senderName: user.displayName || '학생',
          type: communicationType,
          requestCategory: inquiryType === 'firewall' ? 'request' : 'suggestion',
          title: inquiryTitle.trim() || defaultTitle,
          body: inquiryContent,
          supportKind,
          requestedUrl: normalizedUrl,
          status: 'requested',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          latestMessageAt: Timestamp.now(),
          latestMessagePreview: inquiryContent.length > 90 ? `${inquiryContent.slice(0, 90)}…` : inquiryContent,
        });
      }
      toast({ title: inquiryType === 'firewall' ? '와이파이 해제 요청이 등록되었습니다.' : '문의가 등록되었습니다.' });
      setInquiryTitle('');
      setInquiryBody('');
      setFirewallUrl('');
      setInquiryType('question');
    } catch (e: any) {
      toast({ variant: 'destructive', title: '문의 등록에 실패했습니다.', description: e?.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleParentCommunicationStatus = async (
    communicationId: string,
    status: 'in_progress' | 'in_review' | 'done'
  ) => {
    if (!firestore || !centerId || !user) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(firestore, 'centers', centerId, 'parentCommunications', communicationId), {
        status,
        updatedAt: serverTimestamp(),
        handledByUid: user.uid,
        handledByName: user.displayName || '운영자',
      });
      toast({ title: status === 'done' ? '처리 완료로 업데이트됨' : '진행 상태로 업데이트됨' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: '상태 업데이트 실패', description: e?.message || '서버 오류가 발생했습니다.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveCommunicationReply = async (item: ParentCommunicationRecord) => {
    if (!firestore || !centerId || !user) return;
    const replyBody = (replyDrafts[item.id] ?? item.replyBody ?? '').trim();
    if (!replyBody) {
      toast({ variant: 'destructive', title: '답변 내용을 입력해 주세요.' });
      return;
    }
    setIsSubmitting(true);
    try {
      await updateDoc(doc(firestore, 'centers', centerId, 'parentCommunications', item.id), {
        replyBody,
        repliedAt: serverTimestamp(),
        repliedByUid: user.uid,
        repliedByName: user.displayName || '센터',
        handledByUid: user.uid,
        handledByName: user.displayName || '센터',
        status: item.status === 'done' ? 'done' : 'in_review',
        updatedAt: serverTimestamp(),
      });
      setReplyDrafts((prev) => ({ ...prev, [item.id]: replyBody }));
      toast({ title: '답변이 저장되었습니다.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: '답변 저장에 실패했습니다.', description: e?.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSupportThreadMessages = (communicationId: string) =>
    supportMessagesByCommunicationId.get(communicationId) || [];

  const getThreadDraftValue = (communicationId: string) => threadDrafts[communicationId] ?? '';

  const getSupportThreadTimeline = (item: ParentCommunicationRecord): SupportThreadTimelineEntry[] => {
    const threadMessages = getSupportThreadMessages(item.id);
    const initialBody = item.body?.trim();
    const shouldIncludeInitialRequest = item.senderRole === 'student'
      && Boolean(initialBody)
      && !threadMessages.some((message) => message.senderRole === 'student' && message.body.trim() === initialBody);

    const initialEntry: SupportThreadTimelineEntry[] = shouldIncludeInitialRequest
      ? [{
          id: `${item.id}-initial`,
          senderRole: 'student',
          senderName: item.senderName || '학생',
          body: initialBody || '',
          createdAt: item.createdAt || item.updatedAt,
          supportKind: item.supportKind || null,
          requestedUrl: item.requestedUrl || null,
          isInitialRequest: true,
        }]
      : [];

    return [
      ...initialEntry,
      ...threadMessages.map((message) => ({
        id: message.id,
        senderRole: message.senderRole,
        senderName: message.senderName,
        body: message.body,
        createdAt: message.createdAt,
        supportKind: message.supportKind || null,
        requestedUrl: message.requestedUrl || null,
      })),
    ];
  };

  const liveSelectedSupportThread = useMemo(() => {
    if (!selectedSupportThread) return null;
    return parentCommunications.find((item) => item.id === selectedSupportThread.id) || selectedSupportThread;
  }, [parentCommunications, selectedSupportThread]);

  const liveSelectedSupportThreadTimeline = useMemo(() => {
    if (!liveSelectedSupportThread) return [];
    return getSupportThreadTimeline(liveSelectedSupportThread);
  }, [liveSelectedSupportThread, supportMessagesByCommunicationId]);

  const handleSendSupportMessage = async (item: ParentCommunicationRecord) => {
    if (!firestore || !centerId || !user) return;
    const messageBody = getThreadDraftValue(item.id).trim();
    if (!messageBody) {
      toast({ variant: 'destructive', title: '메시지 내용을 입력해 주세요.' });
      return;
    }

    const senderRole: SupportThreadMessage['senderRole'] = isStudent
      ? 'student'
      : isAdmin
        ? 'centerAdmin'
        : 'teacher';
    const senderName =
      user.displayName ||
      (senderRole === 'centerAdmin' ? '센터관리자' : senderRole === 'teacher' ? '선생님' : '학생');
    const latestPreview = messageBody.length > 90 ? `${messageBody.slice(0, 90)}…` : messageBody;

    setIsSubmitting(true);
    try {
      await addDoc(collection(firestore, 'centers', centerId, 'supportMessages'), {
        centerId,
        communicationId: item.id,
        studentId: item.studentId,
        parentUid: item.parentUid || null,
        senderRole,
        senderUid: user.uid,
        senderName,
        body: messageBody,
        supportKind: item.supportKind || null,
        requestedUrl: item.requestedUrl || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const communicationUpdate: Record<string, string | FieldValue | null> = {
        updatedAt: serverTimestamp(),
        latestMessageAt: serverTimestamp(),
        latestMessagePreview: latestPreview,
      };

      if (isStudent) {
        communicationUpdate.status = 'requested';
      } else {
        communicationUpdate.replyBody = messageBody;
        communicationUpdate.repliedAt = serverTimestamp();
        communicationUpdate.repliedByUid = user.uid;
        communicationUpdate.repliedByName = senderName;
        communicationUpdate.handledByUid = user.uid;
        communicationUpdate.handledByName = senderName;
        communicationUpdate.status =
          item.status === 'done'
            ? 'done'
            : item.type === 'consultation'
              ? 'in_progress'
              : 'in_review';
      }

      await updateDoc(doc(firestore, 'centers', centerId, 'parentCommunications', item.id), communicationUpdate);
      setThreadDrafts((prev) => ({ ...prev, [item.id]: '' }));
      toast({ title: isStudent ? '메시지를 보냈습니다.' : '답변을 보냈습니다.' });
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: isStudent ? '메시지 전송에 실패했습니다.' : '답변 전송에 실패했습니다.',
        description: e?.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublishAnnouncement = async () => {
    if (!firestore || !centerId || !user || !isStaff) return;
    if (!announcementTitle.trim() || !announcementBody.trim()) {
      toast({ variant: 'destructive', title: '공지 제목과 내용을 입력해 주세요.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(firestore, 'centers', centerId, 'centerAnnouncements'), {
        title: announcementTitle.trim(),
        body: announcementBody.trim(),
        audience: announcementAudience,
        isPublished: true,
        status: 'published',
        source: 'appointments',
        createdByUid: user.uid,
        createdByName: user.displayName || '센터',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast({ title: '공지사항이 발송되었습니다.' });
      setAnnouncementTitle('');
      setAnnouncementBody('');
      setAnnouncementAudience('all');
    } catch (e: any) {
      toast({ variant: 'destructive', title: '공지 발송에 실패했습니다.', description: e?.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCommunicationTypeBadge = (item: ParentCommunicationRecord) => {
    if (item.supportKind === 'wifi_unblock') {
      return isStaff ? (
        <Badge variant="outline" className="h-6 rounded-full border-[#ffe1c5] bg-[#fff1e4] px-2.5 text-[10px] font-black text-[#14295F]">
          와이파이 해제 요청
        </Badge>
      ) : (
        <Badge variant="outline" className="border-none bg-orange-100 text-orange-700 font-black text-[10px]">
          와이파이 해제 요청
        </Badge>
      );
    }
    if (item.supportKind === 'student_question') {
      return isStaff ? (
        <Badge variant="outline" className="h-6 rounded-full border-[#d6e4ff] bg-[#edf4ff] px-2.5 text-[10px] font-black text-[#14295F]">
          학생 질문
        </Badge>
      ) : (
        <Badge variant="outline" className="border-none bg-sky-100 text-sky-700 font-black text-[10px]">
          학생 질문
        </Badge>
      );
    }
    if (item.supportKind === 'student_suggestion') {
      return isStaff ? (
        <Badge variant="outline" className="h-6 rounded-full border-[#eadcff] bg-[#f7f0ff] px-2.5 text-[10px] font-black text-[#14295F]">
          학생 건의
        </Badge>
      ) : (
        <Badge variant="outline" className="border-none bg-violet-100 text-violet-700 font-black text-[10px]">
          학생 건의
        </Badge>
      );
    }
    if (isStaff) {
      if (item.type === 'consultation') return <Badge variant="outline" className="h-6 rounded-full border-[#d6e4ff] bg-[#edf4ff] px-2.5 text-[10px] font-black text-[#14295F]">상담요청</Badge>;
      if (item.type === 'request' && item.senderRole === 'student') return <Badge variant="outline" className="h-6 rounded-full border-[#d6e4ff] bg-[#edf4ff] px-2.5 text-[10px] font-black text-[#14295F]">학생 질문</Badge>;
      if (item.type === 'request' && item.senderRole === 'parent' && item.requestCategory === 'question') return <Badge variant="outline" className="h-6 rounded-full border-[#d6e4ff] bg-[#edf4ff] px-2.5 text-[10px] font-black text-[#14295F]">학부모 질의</Badge>;
      if (item.type === 'request' && item.senderRole === 'parent' && item.requestCategory === 'request') return <Badge variant="outline" className="h-6 rounded-full border-[#ffe3c6] bg-[#fff3e7] px-2.5 text-[10px] font-black text-[#14295F]">학부모 요청</Badge>;
      if (item.type === 'request') return <Badge variant="outline" className="h-6 rounded-full border-[#ffe3c6] bg-[#fff3e7] px-2.5 text-[10px] font-black text-[#14295F]">일반요청</Badge>;
      return <Badge variant="outline" className="h-6 rounded-full border-[#eadcff] bg-[#f7f0ff] px-2.5 text-[10px] font-black text-[#14295F]">건의사항</Badge>;
    }
    if (item.type === 'consultation') return <Badge variant="outline" className="border-none bg-blue-100 text-blue-700 font-black text-[10px]">상담요청</Badge>;
    if (item.type === 'request' && item.senderRole === 'student') return <Badge variant="outline" className="border-none bg-sky-100 text-sky-700 font-black text-[10px]">학생 질문</Badge>;
    if (item.type === 'request' && item.senderRole === 'parent' && item.requestCategory === 'question') return <Badge variant="outline" className="border-none bg-cyan-100 text-cyan-700 font-black text-[10px]">학부모 질의</Badge>;
    if (item.type === 'request' && item.senderRole === 'parent' && item.requestCategory === 'request') return <Badge variant="outline" className="border-none bg-amber-100 text-amber-700 font-black text-[10px]">학부모 요청</Badge>;
    if (item.type === 'request') return <Badge variant="outline" className="border-none bg-amber-100 text-amber-700 font-black text-[10px]">일반요청</Badge>;
    return <Badge variant="outline" className="border-none bg-violet-100 text-violet-700 font-black text-[10px]">건의사항</Badge>;
  };

  const getCommunicationOwnerLabel = (item: ParentCommunicationRecord) => {
    if (item.senderRole === 'student') return item.senderName || '학생';
    return item.parentName || item.parentUid || item.senderName || '학부모';
  };

  const getSupportSenderLabel = (message: Pick<SupportThreadTimelineEntry, 'senderRole' | 'senderName'>) => {
    if (message.senderRole === 'student') return message.senderName || '학생';
    if (message.senderRole === 'centerAdmin') return message.senderName || '센터관리자';
    if (message.senderRole === 'teacher') return message.senderName || '선생님';
    return message.senderName || '학부모';
  };

  const getReplyDraftValue = (item: ParentCommunicationRecord) => replyDrafts[item.id] ?? item.replyBody ?? '';

  const getParentTypeBadge = (type: ParentCommunicationRecord['type']) => {
    if (isStaff) {
      if (type === 'consultation') return <Badge variant="outline" className="h-6 rounded-full border-[#d6e4ff] bg-[#edf4ff] px-2.5 text-[10px] font-black text-[#14295F]">상담요청</Badge>;
      if (type === 'request') return <Badge variant="outline" className="h-6 rounded-full border-[#ffe3c6] bg-[#fff3e7] px-2.5 text-[10px] font-black text-[#14295F]">일반요청</Badge>;
      return <Badge variant="outline" className="h-6 rounded-full border-[#eadcff] bg-[#f7f0ff] px-2.5 text-[10px] font-black text-[#14295F]">건의사항</Badge>;
    }
    if (type === 'consultation') return <Badge variant="outline" className="border-none bg-blue-100 text-blue-700 font-black text-[10px]">상담요청</Badge>;
    if (type === 'request') return <Badge variant="outline" className="border-none bg-amber-100 text-amber-700 font-black text-[10px]">일반요청</Badge>;
    return <Badge variant="outline" className="border-none bg-violet-100 text-violet-700 font-black text-[10px]">건의사항</Badge>;
  };

  const getParentStatusBadge = (status?: string) => {
    if (isStaff) {
      if (status === 'done') return <Badge variant="outline" className="h-6 rounded-full border-[#dcefe2] bg-[#effaf3] px-2.5 text-[10px] font-black text-[#14295F]">처리 완료</Badge>;
      if (status === 'in_progress') return <Badge variant="outline" className="h-6 rounded-full border-[#d6e4ff] bg-[#edf4ff] px-2.5 text-[10px] font-black text-[#14295F]">처리 중</Badge>;
      if (status === 'in_review') return <Badge variant="outline" className="h-6 rounded-full border-[#ffe3c6] bg-[#fff3e7] px-2.5 text-[10px] font-black text-[#14295F]">검토 중</Badge>;
      return <Badge variant="outline" className="h-6 rounded-full border-[#dbe5ff] bg-[#f6f9ff] px-2.5 text-[10px] font-black text-[#14295F]">접수됨</Badge>;
    }
    if (status === 'done') return <Badge variant="outline" className="border-none bg-emerald-100 text-emerald-700 font-black text-[10px]">처리 완료</Badge>;
    if (status === 'in_progress') return <Badge variant="outline" className="border-none bg-blue-100 text-blue-700 font-black text-[10px]">처리 중</Badge>;
    if (status === 'in_review') return <Badge variant="outline" className="border-none bg-amber-100 text-amber-700 font-black text-[10px]">검토 중</Badge>;
    return <Badge variant="secondary" className="font-black text-[10px]">접수됨</Badge>;
  };

  const getStatusBadge = (status: string) => {
    if (isStudentTrackTheme) {
      switch (status) {
        case 'requested': return <Badge variant="secondary" className="font-black text-[10px] shadow-none">승인 대기</Badge>;
        case 'confirmed': return <Badge variant="dark" className="border-emerald-300/20 bg-emerald-400/15 text-emerald-100 font-black text-[10px] shadow-none">예약 확정</Badge>;
        case 'done': return <Badge variant="dark" className="border-white/10 bg-white/8 text-[var(--text-on-dark-soft)] font-black text-[10px] shadow-none">상담 완료</Badge>;
        case 'canceled': return <Badge variant="dark" className="border-rose-300/20 bg-rose-400/15 text-rose-100 font-black text-[10px] shadow-none">취소됨</Badge>;
        default: return <Badge variant="dark" className="font-black text-[10px] shadow-none">{status}</Badge>;
      }
    }
    if (isStaff) {
      switch (status) {
        case 'requested': return <Badge variant="outline" className="h-6 rounded-full border-[#ffe3c6] bg-[#fff3e7] px-2.5 text-[10px] font-black text-[#14295F]">승인 대기</Badge>;
        case 'confirmed': return <Badge variant="outline" className="h-6 rounded-full border-[#dcefe2] bg-[#effaf3] px-2.5 text-[10px] font-black text-[#14295F]">예약 확정</Badge>;
        case 'done': return <Badge variant="outline" className="h-6 rounded-full border-[#dbe5ff] bg-[#f6f9ff] px-2.5 text-[10px] font-black text-[#14295F]">상담 완료</Badge>;
        case 'canceled': return <Badge variant="outline" className="h-6 rounded-full border-[#ffd7d7] bg-[#fff1f1] px-2.5 text-[10px] font-black text-[#14295F]">취소됨</Badge>;
        default: return <Badge variant="outline" className="h-6 rounded-full border-[#dbe5ff] bg-[#f6f9ff] px-2.5 text-[10px] font-black text-[#14295F]">{status}</Badge>;
      }
    }
    switch (status) {
      case 'requested': return <Badge variant="secondary" className="bg-amber-50 text-amber-600 border-amber-100 font-black text-[10px]">승인 대기</Badge>;
      case 'confirmed': return <Badge variant="outline" className="bg-emerald-500 text-white border-none font-black text-[10px] shadow-sm">예약 확정</Badge>;
      case 'done': return <Badge variant="outline" className="opacity-40 font-black text-[10px]">상담 완료</Badge>;
      case 'canceled': return <Badge variant="destructive" className="font-black text-[10px]">취소됨</Badge>;
      default: return <Badge variant="outline" className="font-black text-[10px]">{status}</Badge>;
    }
  };

  const isStudentTrackTheme = isStudent;
  const counselingCtaClass =
    'border border-[rgba(255,215,180,0.32)] bg-[linear-gradient(180deg,#FFB24C_0%,#FF8A1F_100%)] text-[var(--text-on-accent)] shadow-[0_18px_34px_-24px_rgba(255,138,31,0.55)] hover:brightness-[1.04]';
  const studentSectionCardClass = cn(
    'w-full overflow-hidden border-none',
    isMobile ? 'rounded-[1.5rem]' : 'rounded-[2.5rem]',
    isStudentTrackTheme
      ? 'student-utility-card shadow-none'
      : isStaff
        ? 'border border-[#dbe5ff] bg-[linear-gradient(180deg,#ffffff_0%,#f7faff_58%,#eef4ff_100%)] shadow-[0_30px_65px_-42px_rgba(20,41,95,0.42)]'
        : 'shadow-xl bg-white ring-1 ring-border/50'
  );
  const studentSectionHeaderClass = cn(
    isMobile ? 'p-5' : 'p-6 sm:p-8',
    isStudentTrackTheme
      ? 'border-b border-white/10 bg-transparent'
      : isStaff
        ? 'border-b border-[#dbe5ff] bg-[linear-gradient(135deg,rgba(20,41,95,0.08)_0%,rgba(79,124,255,0.08)_54%,rgba(255,122,22,0.1)_100%)]'
        : 'bg-muted/5 border-b'
  );
  const studentSectionTitleClass = cn(
    'font-black flex items-center gap-3 break-keep',
    isMobile ? 'text-lg' : 'text-xl',
    isStudentTrackTheme ? 'font-aggro-display text-[var(--text-on-dark)]' : 'text-[#14295F]'
  );
  const studentSectionDescriptionClass = cn(
    'font-bold text-xs mt-1',
    isStudentTrackTheme ? 'text-[var(--text-on-dark-soft)]' : 'text-[#5c6e97]'
  );
  const studentTabRailClass = cn(
    'grid w-full p-1.5 mb-8',
    isStaff ? 'grid-cols-4' : isStudent ? 'grid-cols-3' : 'grid-cols-2',
    isMobile ? 'h-auto max-w-full gap-1.5 rounded-[1.5rem]' : isStaff ? 'h-16 max-w-full gap-2 rounded-[1.6rem]' : isStudent ? 'h-16 max-w-2xl mx-auto gap-2 rounded-full' : 'h-16 max-w-sm mx-auto gap-2 rounded-full',
    isStudentTrackTheme
      ? 'surface-card surface-card--ghost on-dark border border-white/10 shadow-none'
      : isStaff
        ? 'border border-[#dbe5ff] bg-[linear-gradient(135deg,#f8fbff_0%,#eef4ff_55%,#f8f1ff_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]'
        : 'bg-muted/30 border shadow-inner'
  );
  const studentTabTriggerClass = cn(
    'rounded-full font-black gap-2 transition-all',
    isMobile ? 'min-h-[3.25rem] px-2' : '',
    isStudentTrackTheme
      ? 'text-[#5D739B] hover:bg-white/60 hover:text-[#17326B] data-[state=active]:bg-[var(--accent-orange)] data-[state=active]:text-white data-[state=active]:shadow-[0_12px_24px_-16px_rgba(255,138,31,0.48)]'
      : isStaff
        ? 'text-[#5c6e97] hover:bg-white/70 hover:text-[#14295F] data-[state=active]:bg-white data-[state=active]:text-[#14295F] data-[state=active]:shadow-[0_18px_34px_-24px_rgba(20,41,95,0.42)]'
        : 'data-[state=active]:bg-white data-[state=active]:shadow-lg'
  );
  const studentEmptyStateClass = cn(
    'text-center font-black italic flex flex-col items-center gap-4',
    isStudentTrackTheme ? 'text-[var(--text-on-dark-muted)]/80' : isStaff ? 'text-[#5c6e97]' : 'text-muted-foreground/30'
  );
  const studentMoreWrapClass = cn(
    'p-5 sm:p-6 flex justify-center',
    isStudentTrackTheme
      ? 'border-t border-white/10 bg-white/[0.03]'
      : isStaff
        ? 'border-t border-[#dbe5ff] bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)]'
        : 'border-t border-muted/10 bg-muted/5'
  );
  const studentGhostPanelClass = isStudentTrackTheme
    ? 'surface-card surface-card--ghost on-dark rounded-[1.25rem] border-white/10 shadow-none'
    : isStaff
      ? 'rounded-[1.25rem] border border-[#dbe5ff] bg-[linear-gradient(135deg,#fbfdff_0%,#eef4ff_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]'
      : 'rounded-[1.25rem] border bg-slate-50/40';
  const studentTitleTextClass = isStudentTrackTheme ? 'font-aggro-display text-[var(--text-on-dark)]' : 'text-[#14295F]';
  const studentMetaTextClass = isStudentTrackTheme ? 'text-[var(--text-on-dark-muted)]' : 'text-[#5c6e97]';
  const studentBodyTextClass = isStudentTrackTheme ? 'text-[var(--text-on-dark-soft)]' : 'text-[#14295F]';
  const staffHeroShellClass = cn(
    'w-full overflow-hidden border border-[#213a7a] bg-[#14295F] shadow-[0_34px_70px_-42px_rgba(20,41,95,0.72)]',
    isMobile ? 'rounded-[1.75rem] p-5' : 'rounded-[2.75rem] px-8 py-8'
  );
  const staffPanelShellClass = cn(
    'w-full overflow-hidden border border-[#dbe5ff] bg-[linear-gradient(180deg,#ffffff_0%,#f7faff_55%,#edf3ff_100%)] shadow-[0_28px_60px_-42px_rgba(20,41,95,0.36)]',
    isMobile ? 'rounded-[1.5rem]' : 'rounded-[2.25rem]'
  );
  const staffLabelClass = 'text-[10px] font-black uppercase tracking-[0.22em] text-[#5c6e97]';
  const staffInsetPanelClass = 'rounded-[1.4rem] border border-[#dbe5ff] bg-[linear-gradient(135deg,#f9fbff_0%,#eef4ff_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]';
  const staffInputClass = 'rounded-xl border-[#dbe5ff] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] font-bold text-[#14295F] placeholder:text-[#8ca0c7]';

  const renderRequestedUrlPanel = (item: ParentCommunicationRecord, surface: 'student' | 'staff') => {
    if (item.supportKind !== 'wifi_unblock' || !item.requestedUrl) return null;

    if (surface === 'staff') {
      return (
        <div className="rounded-2xl border border-[#ffe1c5] bg-[linear-gradient(135deg,#fff8ef_0%,#fff1e4_100%)] p-4">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-white p-2 shadow-sm">
              <ShieldCheck className="h-4 w-4 text-[#FF7A16]" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#c26a1c]">와이파이 방화벽 해제 요청</p>
              <p className="mt-1 text-xs font-bold text-[#14295F]">학생이 학습용 사이트 허용을 요청했습니다.</p>
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-[#ffd9b6] bg-white/80 p-3">
            <p className="text-[10px] font-black text-[#c26a1c]">요청 URL</p>
            <a
              href={item.requestedUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 flex items-center gap-2 break-all text-sm font-black text-[#14295F] underline decoration-[#ffb170] underline-offset-4"
            >
              <Link2 className="h-3.5 w-3.5 shrink-0 text-[#FF7A16]" />
              {item.requestedUrl}
            </a>
          </div>
        </div>
      );
    }

    return (
      <div className={cn(
        isStudentTrackTheme
          ? 'surface-card surface-card--ghost on-dark border-[#ffb170]/20'
          : 'rounded-2xl border border-orange-200 bg-orange-50/80',
        'p-4'
      )}>
        <div className="flex items-center gap-2">
          <Wifi className={cn('h-4 w-4', isStudentTrackTheme ? 'text-[#ffb170]' : 'text-orange-600')} />
          <p className={cn('text-[10px] font-black uppercase tracking-[0.22em]', isStudentTrackTheme ? 'text-[#ffcf9f]' : 'text-orange-700')}>
            와이파이 방화벽 해제 요청
          </p>
        </div>
        <a
          href={item.requestedUrl}
          target="_blank"
          rel="noreferrer"
          className={cn(
            'mt-2 flex items-center gap-2 break-all text-sm font-black underline underline-offset-4',
            isStudentTrackTheme ? 'text-[var(--text-on-dark)] decoration-[#ffb170]/70' : 'text-orange-900 decoration-orange-300'
          )}
        >
          <Link2 className={cn('h-3.5 w-3.5 shrink-0', isStudentTrackTheme ? 'text-[#ffb170]' : 'text-orange-600')} />
          {item.requestedUrl}
        </a>
      </div>
    );
  };

  const renderSupportThread = (item: ParentCommunicationRecord, surface: 'student' | 'staff') => {
    const threadMessages = getSupportThreadTimeline(item);
    const draftValue = getThreadDraftValue(item.id);

    return (
      <div className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className={cn(
              'text-[10px] font-black uppercase tracking-[0.22em]',
              surface === 'staff'
                ? 'text-[#5c6e97]'
                : isStudentTrackTheme
                  ? 'text-[var(--text-on-dark-muted)]'
                  : 'text-sky-700'
            )}>
              1:1 톡
            </p>
            {item.senderRole === 'student' && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setSelectedSupportThread(item)}
                className={cn(
                  'h-8 rounded-full px-3 text-[11px] font-black',
                  surface === 'staff'
                    ? 'border-[#dbe5ff] bg-white text-[#14295F] hover:bg-[#f5f8ff]'
                    : isStudentTrackTheme
                      ? 'border-white/12 bg-white/[0.08] text-[var(--text-on-dark)] hover:bg-white/[0.14]'
                      : 'border-sky-200 bg-white text-sky-800 hover:bg-sky-50'
                )}
              >
                톡방 열기
              </Button>
            )}
          </div>
          {threadMessages.length === 0 ? (
            <div className={cn(
              surface === 'staff'
                ? 'rounded-2xl border border-dashed border-[#dbe5ff] bg-[#f8fbff] p-4 text-[#5c6e97]'
                : isStudentTrackTheme
                  ? 'surface-card surface-card--ghost on-dark rounded-[1.2rem] border-white/10 p-4 text-[var(--text-on-dark-muted)]'
                  : 'rounded-2xl border border-dashed border-sky-200 bg-sky-50/60 p-4 text-sky-700',
              'text-sm font-bold'
            )}>
              아직 추가 대화가 없습니다. 아래에서 바로 메시지를 이어갈 수 있어요.
            </div>
          ) : (
            <div className="space-y-2">
              {threadMessages.map((message) => {
                const isStudentSender = message.senderRole === 'student';
                const messageTime = message.createdAt?.toDate?.();
                return (
                  <div
                    key={message.id}
                    className={cn(
                      'rounded-2xl border p-4',
                      surface === 'staff'
                        ? isStudentSender
                          ? 'border-[#dbe5ff] bg-[linear-gradient(135deg,#ffffff_0%,#f4f8ff_100%)]'
                          : 'border-[#ffe1c5] bg-[linear-gradient(135deg,#fff8ef_0%,#fff1e4_100%)]'
                        : isStudentTrackTheme
                          ? isStudentSender
                            ? 'surface-card surface-card--ghost on-dark border-white/10'
                            : 'surface-card surface-card--ghost on-dark border-emerald-300/18'
                          : isStudentSender
                            ? 'border-sky-200 bg-sky-50/80'
                            : 'border-emerald-200 bg-emerald-50/80'
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className={cn(
                        'text-[10px] font-black uppercase tracking-[0.2em]',
                        surface === 'staff'
                          ? 'text-[#5c6e97]'
                          : isStudentTrackTheme
                            ? 'text-[var(--text-on-dark-muted)]'
                            : isStudentSender
                              ? 'text-sky-700'
                              : 'text-emerald-700'
                      )}>
                        {getSupportSenderLabel(message)}
                      </p>
                      <p className={cn(
                        'text-[10px] font-bold',
                        surface === 'staff'
                          ? 'text-[#7f93ba]'
                          : isStudentTrackTheme
                            ? 'text-[var(--text-on-dark-muted)]'
                            : 'text-muted-foreground'
                      )}>
                        {messageTime ? format(messageTime, 'MM.dd HH:mm') : ''}
                      </p>
                    </div>
                    {message.isInitialRequest && (
                      <p className={cn(
                        'mt-1 text-[10px] font-black',
                        surface === 'staff'
                          ? 'text-[#7f93ba]'
                          : isStudentTrackTheme
                            ? 'text-[var(--accent-orange-soft)]'
                            : 'text-orange-700'
                      )}>
                        첫 요청 메시지
                      </p>
                    )}
                    <p className={cn(
                      'mt-2 whitespace-pre-wrap text-sm font-bold leading-relaxed',
                      surface === 'staff'
                        ? 'text-[#14295F]'
                        : isStudentTrackTheme
                          ? isStudentSender
                            ? 'text-[var(--text-on-dark)]'
                            : 'text-emerald-100'
                          : isStudentSender
                            ? 'text-sky-900'
                            : 'text-emerald-900'
                    )}>
                      {message.body}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Textarea
            value={draftValue}
            onChange={(e) => setThreadDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
            placeholder={surface === 'staff' ? '학생에게 보낼 답변을 입력해 주세요.' : '선생님 또는 센터관리자에게 추가 메시지를 남겨 주세요.'}
            className={cn(
              'min-h-[92px] resize-none',
              surface === 'staff'
                ? staffInputClass
                : isStudentTrackTheme
                  ? 'rounded-xl border-white/12 bg-white/[0.08] text-[var(--text-on-dark)] placeholder:text-[var(--text-on-dark-muted)]'
                  : 'rounded-xl border-2'
            )}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={isSubmitting || !draftValue.trim()}
              onClick={() => handleSendSupportMessage(item)}
              className={cn(
                'rounded-xl font-black h-9 gap-1.5',
                surface === 'staff'
                  ? 'bg-[#14295F] text-white hover:bg-[#10224e]'
                  : counselingCtaClass
              )}
            >
              <Send className="h-3.5 w-3.5" />
              {surface === 'staff' ? '메시지 보내기' : '톡 보내기'}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn(
        'flex w-full flex-col gap-6 pb-20',
        isStaff ? 'max-w-6xl mx-auto' : 'max-w-4xl mx-auto',
        isMobile ? 'px-1 items-center' : 'px-4'
      )}
    >
      {isStudentTrackTheme && !showAll ? (
        <header className="w-full">
          <section className={cn("surface-card surface-card--primary on-dark student-utility-card overflow-hidden border-none", isMobile ? "rounded-[1.5rem] px-5 py-5" : "rounded-[2.5rem] px-7 py-7")}>
            <div className="flex flex-col gap-5">
              <div className={cn("flex justify-between gap-4", isMobile ? "flex-col" : "items-start")}>
                <div className="min-w-0">
                  <h1 className={cn("font-aggro-display font-black tracking-tighter leading-none text-[var(--text-on-dark)]", isMobile ? "text-3xl" : "text-4xl")}>상담트랙</h1>
                  <p className="mt-3 text-[10px] font-black uppercase tracking-[0.22em] text-[var(--accent-orange-soft)]">
                    상담 예약 · 피드백 센터
                  </p>
                </div>
                <div className="surface-card surface-card--ghost on-dark rounded-[1.2rem] border-white/10 px-3.5 py-3 shadow-none">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-muted)]">Today</p>
                  <p className="mt-1 text-sm font-black text-[var(--text-on-dark)]">예약 · 질문 · 피드백</p>
                  <p className="mt-1 text-[11px] font-semibold text-[var(--text-on-dark-soft)]">중요한 흐름만 빠르게 확인해요.</p>
                </div>
              </div>
              <Dialog open={isRequestModalOpen} onOpenChange={setIsRequestModalOpen}>
                <DialogTrigger asChild>
                  <Button size="lg" className={cn("student-cta rounded-2xl font-black gap-2 interactive-button border-none", isMobile ? "w-full max-w-full min-h-[3.75rem]" : "h-14 w-fit px-8", counselingCtaClass)}>
                    <CalendarPlus className="h-5 w-5" /> 새 상담 신청
                  </Button>
                </DialogTrigger>
                <DialogContent className={cn("rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl transition-all duration-500", isMobile ? "w-[min(94vw,25rem)] max-h-[86svh] rounded-[2rem]" : "sm:max-w-md")}>
                  <div className={cn("text-white relative bg-[linear-gradient(180deg,#FFB24C_0%,#FF8A1F_100%)]", isMobile ? "p-6" : "p-10")}>
                    <Sparkles className="absolute top-0 right-0 p-10 h-40 w-40 opacity-10 rotate-12" />
                    <DialogHeader>
                      <DialogTitle className={cn("font-black tracking-tighter text-left break-keep", isMobile ? "text-[1.7rem]" : "text-3xl")}>상담 신청</DialogTitle>
                      <DialogDescription className="text-white/80 font-bold mt-1 text-left">상담 일시와 선생님을 선택해 주세요.</DialogDescription>
                    </DialogHeader>
                  </div>
                  <div className={cn("space-y-6 bg-white overflow-y-auto custom-scrollbar", isMobile ? "max-h-[calc(86svh-9rem)] p-5" : "p-8 max-h-[60vh]")}>
                    <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-2")}>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">희망 날짜</label>
                        <Input type="date" value={aptDate} onChange={(e) => setAptDate(e.target.value)} className="rounded-xl h-12 border-2" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">희망 시간</label>
                        <Input type="time" value={aptTime} onChange={(e) => setAptTime(e.target.value)} className="rounded-xl h-12 border-2" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-muted-foreground ml-1 flex items-center gap-1.5">
                        <UserCheck className="h-3 w-3" /> 상담 희망 선생님
                      </label>
                      <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                        <SelectTrigger className="h-12 rounded-xl border-2 font-bold">
                          <SelectValue placeholder="선생님을 선택하세요" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-none shadow-2xl">
                          {filteredTeachers.map((t) => (
                            <SelectItem key={t.id} value={t.id} className="font-bold py-2.5">
                              {t.displayName} (선생님)
                            </SelectItem>
                          ))}
                          {!filteredTeachers.length && <p className="p-4 text-center text-xs font-bold opacity-40">선택 가능한 선생님이 없습니다.</p>}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">상담 요청 내용 (선택)</label>
                      <Textarea 
                        placeholder="고민이나 질문하고 싶은 내용을 자유롭게 적어주세요." 
                        value={studentNote}
                        onChange={(e) => setStudentNote(e.target.value)}
                        className="rounded-xl min-h-[100px] resize-none text-sm font-bold border-2"
                      />
                    </div>
                  </div>
                  <DialogFooter className={cn("bg-muted/30", isMobile ? "p-5" : "p-8")}>
                    <Button onClick={handleRequestAppointment} disabled={isSubmitting} className={cn("w-full h-14 rounded-2xl font-black text-lg", counselingCtaClass)}>
                      {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : '상담 신청 완료'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </section>
        </header>
      ) : isStaff ? (
        <section className="w-full space-y-6">
          <div className={staffHeroShellClass}>
            <div className={cn('grid gap-6', isMobile ? 'grid-cols-1' : 'lg:grid-cols-[1.15fr_0.85fr] lg:items-start')}>
              <div className="min-w-0">
                <Badge variant="dark" className="border-white/10 bg-white/8 px-3 py-1 text-[10px] font-black shadow-none">
                  COUNSEL WORKBENCH
                </Badge>
                <h1 className={cn('mt-4 font-aggro-display font-black tracking-tight text-white', isMobile ? 'text-3xl' : 'text-[3.25rem] leading-none')}>
                  상담 운영 워크벤치
                </h1>
                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-white/80">
                  예약 승인, 상담 기록, 학생 질문, 학부모 요청을 한 흐름으로 묶어서 보는 선생님 전용 운영 보드입니다.
                </p>
                <div className={cn('mt-5 grid gap-3', isMobile ? 'grid-cols-2' : 'grid-cols-4')}>
                  {staffWorkbenchStats.map((item) => (
                    <div key={item.label} className="rounded-[1.4rem] border border-white/10 bg-white/[0.08] px-4 py-4 shadow-none">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/60">{item.label}</p>
                      <p className="mt-2 text-2xl font-black tracking-tight text-white">{item.value}</p>
                      <p className="mt-1 text-[11px] font-semibold leading-5 text-white/70">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.06] p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/60">현재 포커스</p>
                  <p className="mt-2 text-lg font-black text-white">
                    {currentTabLabelMap[currentStaffTab]}
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-white/75">
                    {showAll
                      ? '선택한 탭의 전체 내역을 검토하는 모드입니다.'
                      : isAdmin
                        ? '센터 전체 상담 흐름을 한 화면에서 조율하는 관리자 보기입니다.'
                        : '승인과 답변이 필요한 항목을 먼저 처리할 수 있도록 정리했습니다.'}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.06] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/60">예약 운영</p>
                    <p className="mt-2 text-base font-black text-white">확정 {staffConfirmedReservations}건</p>
                    <p className="mt-1 text-[11px] font-semibold leading-5 text-white/70">오늘 일정 {staffTodayReservations}건, 완료 {staffCompletedReservations}건</p>
                  </div>
                  <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.06] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/60">커뮤니케이션</p>
                    <p className="mt-2 text-base font-black text-white">학생 질문 {staffOpenStudentInquiries}건</p>
                    <p className="mt-1 text-[11px] font-semibold leading-5 text-white/70">학부모 요청 {staffOpenParentRequests}건, 공지 {staffAnnouncements.length}건</p>
                  </div>
                </div>
                <div className={cn('flex gap-3', isMobile ? 'flex-col' : 'items-center justify-end')}>
                  {showAll ? (
                    <Button
                      asChild
                      variant="outline"
                      className="h-12 rounded-2xl border-white/15 bg-white/8 px-5 font-black text-white hover:bg-white/14 hover:text-white"
                    >
                      <Link href="/dashboard/appointments">
                        목록으로 돌아가기 <ArrowRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    <Badge variant="dark" className="h-12 rounded-2xl border-white/10 bg-white/8 px-4 text-sm font-black text-white shadow-none">
                      {isAdmin ? '센터 전체 상담 일정' : '상담 예약 · 피드백 센터'}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className={cn('grid gap-5', isMobile ? 'grid-cols-1' : 'xl:grid-cols-[1.35fr_0.65fr]')}>
            <Card className={staffPanelShellClass}>
              <CardHeader className={cn('border-b border-[#dbe5ff] bg-[linear-gradient(135deg,rgba(20,41,95,0.08)_0%,rgba(79,124,255,0.08)_52%,rgba(255,122,22,0.1)_100%)]', isMobile ? 'p-5' : 'p-6 sm:p-8')}>
                <div className={cn('flex gap-4', isMobile ? 'flex-col' : 'items-start justify-between')}>
                  <div className="space-y-2">
                    <p className={staffLabelClass}>공지 운영</p>
                    <CardTitle className={cn('flex items-center gap-3 font-black text-[#14295F]', isMobile ? 'text-lg' : 'text-[1.45rem]')}>
                      <Megaphone className="h-6 w-6 text-[#14295F]" /> 학생·학부모 공지 발송
                    </CardTitle>
                    <CardDescription className="text-sm font-semibold leading-6 text-[#5c6e97]">
                      상담트랙에 올리는 공지를 바로 작성하고 최근 발송 이력을 함께 확인합니다.
                    </CardDescription>
                  </div>
                  <div className="rounded-[1.3rem] border border-[#dbe5ff] bg-[linear-gradient(135deg,#ffffff_0%,#eef4ff_100%)] px-4 py-3 shadow-[0_16px_34px_-28px_rgba(20,41,95,0.22)]">
                    <p className={staffLabelClass}>발송 누적</p>
                    <p className="mt-2 text-xl font-black text-[#14295F]">{staffAnnouncements.length}건</p>
                    <p className="mt-1 text-[11px] font-semibold text-[#5c6e97]">학생·학부모 공지 기록</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className={cn('space-y-5', isMobile ? 'p-4' : 'p-6')}>
                <div className={cn('grid gap-5', isMobile ? 'grid-cols-1' : 'lg:grid-cols-[1.05fr_0.95fr]')}>
                  <div className={cn(staffInsetPanelClass, 'p-5 space-y-4')}>
                    <div className="space-y-2">
                      <p className={staffLabelClass}>공지 대상</p>
                      <Select value={announcementAudience} onValueChange={(value) => setAnnouncementAudience(value as 'student' | 'parent' | 'all')}>
                        <SelectTrigger className={cn('h-11 rounded-xl border-[#dbe5ff] bg-white font-bold text-[#14295F]', staffInputClass)}>
                          <SelectValue placeholder="대상 선택" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-[#dbe5ff] shadow-2xl">
                          <SelectItem value="all" className="font-bold">학생 + 학부모</SelectItem>
                          <SelectItem value="student" className="font-bold">학생</SelectItem>
                          <SelectItem value="parent" className="font-bold">학부모</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <p className={staffLabelClass}>제목</p>
                      <Input
                        value={announcementTitle}
                        onChange={(e) => setAnnouncementTitle(e.target.value)}
                        placeholder="공지 제목"
                        className={cn('h-11', staffInputClass)}
                      />
                    </div>
                    <div className="space-y-2">
                      <p className={staffLabelClass}>내용</p>
                      <Textarea
                        value={announcementBody}
                        onChange={(e) => setAnnouncementBody(e.target.value)}
                        placeholder="학생/학부모에게 전달할 공지 내용을 입력해 주세요."
                        className={cn('min-h-[130px] resize-none', staffInputClass)}
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={handlePublishAnnouncement} disabled={isSubmitting} className="h-11 rounded-xl bg-[#FF7A16] px-5 font-black text-white hover:bg-[#e76c10]">
                        {isSubmitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Megaphone className="mr-1.5 h-4 w-4" />}
                        공지 발송
                      </Button>
                    </div>
                  </div>

                  <div className={cn(staffInsetPanelClass, 'p-5')}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className={staffLabelClass}>최근 공지</p>
                        <p className="mt-2 text-base font-black text-[#14295F]">가장 최근 발송한 공지들</p>
                      </div>
                      <Badge variant="outline" className="h-6 rounded-full border-[#dbe5ff] bg-white px-2.5 text-[10px] font-black text-[#14295F]">
                        최신 3건
                      </Badge>
                    </div>
                    <div className="mt-4 space-y-3">
                      {announcementsLoading ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="h-5 w-5 animate-spin text-[#5c6e97]" />
                        </div>
                      ) : visibleStaffAnnouncements.length === 0 ? (
                        <div className="rounded-[1.2rem] border border-dashed border-[#dbe5ff] bg-white p-5 text-center">
                          <p className="text-sm font-bold text-[#14295F]">등록된 공지가 없습니다.</p>
                          <p className="mt-1 text-[11px] font-semibold text-[#5c6e97]">첫 공지를 작성해 학생과 학부모 화면에 바로 반영해 보세요.</p>
                        </div>
                      ) : (
                        visibleStaffAnnouncements.map((item: any) => {
                          const createdAt = item?.createdAt?.toDate?.();
                          const createdAtLabel = createdAt ? format(createdAt, 'yyyy.MM.dd HH:mm') : '-';
                          const audienceLabel =
                            item?.audience === 'student' ? '학생' : item?.audience === 'parent' ? '학부모' : '학생+학부모';
                          return (
                            <div key={item.id} className="rounded-[1.2rem] border border-[#dbe5ff] bg-[linear-gradient(135deg,#ffffff_0%,#f4f8ff_100%)] px-4 py-3.5 shadow-[0_14px_28px_-24px_rgba(20,41,95,0.18)]">
                              <div className="flex items-center justify-between gap-2">
                                <p className="truncate text-sm font-black text-[#14295F]">{item?.title || '공지사항'}</p>
                                <Badge variant="outline" className="h-6 rounded-full border-[#dbe5ff] bg-[#f6f9ff] px-2.5 text-[10px] font-black text-[#14295F]">
                                  {audienceLabel}
                                </Badge>
                              </div>
                              <p className="mt-1 text-[11px] font-semibold text-[#5c6e97]">{createdAtLabel}</p>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4">
              <div className={cn(staffPanelShellClass, 'p-5')}>
                <p className={staffLabelClass}>즉시 확인</p>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-[1.25rem] border border-[#ffe0c2] bg-[linear-gradient(135deg,#fff7ef_0%,#ffffff_100%)] px-4 py-4 shadow-[0_16px_32px_-28px_rgba(255,122,22,0.24)]">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#5c6e97]">예약 승인 대기</p>
                    <p className="mt-2 text-2xl font-black text-[#14295F]">{staffPendingReservations}건</p>
                    <p className="mt-1 text-[11px] font-semibold text-[#5c6e97]">승인 또는 거절 처리가 필요한 예약입니다.</p>
                  </div>
                  <div className="rounded-[1.25rem] border border-[#d7efe0] bg-[linear-gradient(135deg,#f1fbf5_0%,#ffffff_100%)] px-4 py-4 shadow-[0_16px_32px_-28px_rgba(16,185,129,0.2)]">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#5c6e97]">미확인 피드백</p>
                    <p className="mt-2 text-2xl font-black text-[#14295F]">{staffUnreadLogs}건</p>
                    <p className="mt-1 text-[11px] font-semibold text-[#5c6e97]">학생이 아직 확인하지 않은 상담 일지입니다.</p>
                  </div>
                  <div className="rounded-[1.25rem] border border-[#e3dcff] bg-[linear-gradient(135deg,#f8f5ff_0%,#ffffff_100%)] px-4 py-4 shadow-[0_16px_32px_-28px_rgba(124,58,237,0.18)]">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#5c6e97]">열린 요청</p>
                    <p className="mt-2 text-2xl font-black text-[#14295F]">{staffOpenStudentInquiries + staffOpenParentRequests}건</p>
                    <p className="mt-1 text-[11px] font-semibold text-[#5c6e97]">학생 질문과 학부모 요청을 합산한 처리 대기입니다.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <header className={cn("flex justify-between items-center w-full", isMobile ? "flex-col gap-4 items-center text-center" : "flex-row")}>
          <div className="space-y-1">
            <h1 className={cn("font-black tracking-tighter text-primary leading-none", isMobile ? "text-3xl" : "text-4xl")}>상담트랙</h1>
            {showAll ? (
              <p className="text-[11px] font-black text-primary/70 ml-1">전체 내역 보기</p>
            ) : (
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ml-1">
                {isAdmin ? '센터 전체 상담 일정' : '상담 예약 · 피드백 센터'}
              </p>
            )}
          </div>
          {showAll ? (
            <Button asChild variant="outline" className="rounded-xl font-black">
              <Link href="/dashboard/appointments">
                목록으로 돌아가기 <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          ) : isStudent && (
            <Dialog open={isRequestModalOpen} onOpenChange={setIsRequestModalOpen}>
              <DialogTrigger asChild>
                <Button size="lg" className={cn("student-cta rounded-2xl font-black gap-2 shadow-xl interactive-button border-none text-white", isMobile ? "w-full max-w-full min-h-[3.75rem]" : "h-14 px-8", counselingCtaClass)}>
                  <CalendarPlus className="h-5 w-5" /> 새 상담 신청
                </Button>
              </DialogTrigger>
              <DialogContent className={cn("rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl transition-all duration-500", isMobile ? "w-[min(94vw,25rem)] max-h-[86svh] rounded-[2rem]" : "sm:max-w-md")}>
                <div className={cn("text-white relative bg-[linear-gradient(180deg,#FFB24C_0%,#FF8A1F_100%)]", isMobile ? "p-6" : "p-10")}>
                  <Sparkles className="absolute top-0 right-0 p-10 h-40 w-40 opacity-10 rotate-12" />
                  <DialogHeader>
                    <DialogTitle className={cn("font-black tracking-tighter text-left break-keep", isMobile ? "text-[1.7rem]" : "text-3xl")}>상담 신청</DialogTitle>
                    <DialogDescription className="text-white/80 font-bold mt-1 text-left">상담 일시와 선생님을 선택해 주세요.</DialogDescription>
                  </DialogHeader>
                </div>
                <div className={cn("space-y-6 bg-white overflow-y-auto custom-scrollbar", isMobile ? "max-h-[calc(86svh-9rem)] p-5" : "p-8 max-h-[60vh]")}>
                  <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-2")}>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">희망 날짜</label>
                      <Input type="date" value={aptDate} onChange={(e) => setAptDate(e.target.value)} className="rounded-xl h-12 border-2" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">희망 시간</label>
                      <Input type="time" value={aptTime} onChange={(e) => setAptTime(e.target.value)} className="rounded-xl h-12 border-2" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-muted-foreground ml-1 flex items-center gap-1.5">
                      <UserCheck className="h-3 w-3" /> 상담 희망 선생님
                    </label>
                    <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                      <SelectTrigger className="h-12 rounded-xl border-2 font-bold">
                        <SelectValue placeholder="선생님을 선택하세요" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-none shadow-2xl">
                        {filteredTeachers.map((t) => (
                          <SelectItem key={t.id} value={t.id} className="font-bold py-2.5">
                            {t.displayName} (선생님)
                          </SelectItem>
                        ))}
                        {!filteredTeachers.length && <p className="p-4 text-center text-xs font-bold opacity-40">선택 가능한 선생님이 없습니다.</p>}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">상담 요청 내용 (선택)</label>
                    <Textarea 
                      placeholder="고민이나 질문하고 싶은 내용을 자유롭게 적어주세요." 
                      value={studentNote}
                      onChange={(e) => setStudentNote(e.target.value)}
                      className="rounded-xl min-h-[100px] resize-none text-sm font-bold border-2"
                    />
                  </div>
                </div>
                <DialogFooter className={cn("bg-muted/30", isMobile ? "p-5" : "p-8")}>
                  <Button onClick={handleRequestAppointment} disabled={isSubmitting} className={cn("w-full h-14 rounded-2xl font-black text-lg", counselingCtaClass)}>
                    {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : '상담 신청 완료'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </header>
      )}

      {isStudent && (
        <Card variant={isStudentTrackTheme ? 'secondary' : 'default'} className={cn(studentSectionCardClass, isMobile ? "mb-4" : "mb-6")}>
          <CardHeader className={studentSectionHeaderClass}>
            <CardTitle className={studentSectionTitleClass}>
              <Megaphone className={cn("h-6 w-6", isStudentTrackTheme ? "text-[var(--accent-orange)] opacity-100" : "opacity-70 text-amber-700")} /> 공지사항
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {announcementsLoading ? (
              <div className="py-12 flex justify-center"><Loader2 className={cn("animate-spin h-7 w-7", isStudentTrackTheme ? "text-white/30" : "text-primary opacity-20")} /></div>
            ) : visibleStudentAnnouncements.length === 0 ? (
              <div className={cn("py-14 text-center font-black", isStudentTrackTheme ? "text-[var(--text-on-dark-muted)]/80" : "text-muted-foreground/40")}>등록된 공지사항이 없습니다.</div>
            ) : (
              <div className={cn(isStudentTrackTheme ? "space-y-3 p-4" : "divide-y divide-muted/10")}>
                {visibleStudentAnnouncements.map((item: any) => {
                  const createdAt = item?.createdAt?.toDate?.();
                  const createdAtLabel = createdAt ? format(createdAt, 'yyyy.MM.dd HH:mm') : '-';
                  return (
                    <div key={item.id} className={cn(isStudentTrackTheme ? "surface-card surface-card--ghost on-dark rounded-[1.25rem] border-white/10 p-4 shadow-none" : "space-y-2", !isStudentTrackTheme && (isMobile ? "p-4" : "p-5 sm:p-6"))}>
                      <div className="flex items-center justify-between gap-3">
                        <h3 className={cn("font-black break-keep", isMobile ? "text-sm" : "text-base", studentTitleTextClass)}>{item?.title || '공지사항'}</h3>
                        <span className={cn("text-[10px] font-bold shrink-0", studentMetaTextClass)}>{createdAtLabel}</span>
                      </div>
                      <p className={cn("text-sm font-semibold whitespace-pre-wrap leading-relaxed", studentBodyTextClass)}>
                        {item?.body || '내용이 없습니다.'}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={(value) => !showAll && setActiveTab(value as AppointmentTab)} className="w-full flex flex-col items-center">
        {!showAll && (
          <TabsList className={studentTabRailClass}>
            <TabsTrigger value="reservations" className={studentTabTriggerClass}>
              <Calendar className="h-4 w-4" /> <span className="text-xs sm:text-sm">상담 예약</span>
            </TabsTrigger>
            <TabsTrigger value="logs" className={studentTabTriggerClass}>
              <FileText className="h-4 w-4" /> <span className="text-xs sm:text-sm">상담 일지</span>
            </TabsTrigger>
            {(isStudent || isStaff) && (
              <TabsTrigger value="inquiries" className={studentTabTriggerClass}>
                <MessageSquare className="h-4 w-4" /> <span className="text-xs sm:text-sm">질문/건의</span>
              </TabsTrigger>
            )}
            {isStaff && (
              <TabsTrigger value="parent" className={studentTabTriggerClass}>
                <ClipboardCheck className="h-4 w-4" /> <span className="text-xs sm:text-sm">학부모 요청</span>
              </TabsTrigger>
            )}
          </TabsList>
        )}

        <TabsContent value="reservations" className="animate-in fade-in slide-in-from-bottom-2 duration-500 w-full">
          <Card variant={isStudentTrackTheme ? 'secondary' : 'default'} className={studentSectionCardClass}>
            <CardHeader className={studentSectionHeaderClass}>
              <div className={cn('flex gap-4', isMobile ? 'flex-col' : 'items-start justify-between')}>
                <div className="space-y-2">
                  <CardTitle className={studentSectionTitleClass}>
                    <History className={cn("h-6 w-6", isStudentTrackTheme ? "text-[var(--accent-orange)] opacity-100" : isStaff ? "text-[#14295F]" : "opacity-40")} /> 예약 및 신청 내역
                  </CardTitle>
                  {isStaff && (
                    <CardDescription className="text-sm font-semibold leading-6 text-[#5c6e97]">
                      승인 대기와 확정된 일정을 한 레일에서 확인하고 바로 일지 작성으로 이어집니다.
                    </CardDescription>
                  )}
                </div>
                {isStaff && (
                  <Badge variant="outline" className="h-7 rounded-full border-[#dbe5ff] bg-white px-3 text-[10px] font-black text-[#14295F]">
                    승인 대기 {staffPendingReservations}건
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {resLoading ? (
                <div className="py-20 flex justify-center"><Loader2 className={cn("animate-spin h-8 w-8", isStudentTrackTheme ? "text-white/30" : isStaff ? "text-[#5c6e97]" : "text-primary opacity-20")} /></div>
              ) : reservations.length === 0 ? (
                <div className={cn("py-32", studentEmptyStateClass)}>
                  <Calendar className={cn("h-16 w-16", isStudentTrackTheme ? "opacity-30" : "opacity-10")} />
                  예약 내역이 없습니다.
                </div>
              ) : (
                <div className={cn(isStudentTrackTheme ? "space-y-3 p-4" : "divide-y divide-muted/10")}>
                  {visibleReservations.map((res) => (
                    <div
                      key={res.id}
                      className={cn(
                        "flex flex-col sm:flex-row sm:items-center justify-between group transition-colors gap-4",
                        isStudentTrackTheme
                          ? "surface-card surface-card--ghost on-dark rounded-[1.35rem] border-white/10 shadow-none"
                          : isStaff
                            ? "rounded-[1.5rem] border border-[#dbe5ff] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_58%,#edf4ff_100%)] mx-4 my-4 shadow-[0_20px_42px_-34px_rgba(20,41,95,0.24)]"
                            : "hover:bg-muted/5",
                        isMobile ? "p-5" : "p-6 sm:p-8"
                      )}
                    >
                      <div className="flex items-center gap-4 sm:gap-6 min-w-0">
                        <div className={cn("rounded-2xl flex flex-col items-center justify-center shrink-0 transition-all duration-500", isStudentTrackTheme ? "border border-white/12 bg-white/[0.08] shadow-none" : isStaff ? "border border-[#d4e0ff] bg-[#eef4ff]" : "bg-primary/5 border-2 border-primary/10 shadow-inner", isMobile ? "h-14 w-14" : "h-16 w-16", !isStudentTrackTheme && !isStaff && (isStudent ? `group-hover:bg-gradient-to-br ${currentTier.gradient}` : "group-hover:bg-primary"))}>
                          <span className={cn("font-black tracking-tighter", isMobile ? "text-[8px]" : "text-[10px]", isStudentTrackTheme ? "text-[var(--text-on-dark-muted)]" : isStaff ? "text-[#5c6e97]" : "text-primary/60 group-hover:text-white/60")}>{res.scheduledAt ? format(res.scheduledAt.toDate(), 'M월') : ''}</span>
                          <span className={cn("font-black leading-none mt-0.5", isMobile ? "text-lg" : "text-xl sm:text-2xl", isStudentTrackTheme ? "text-[var(--text-on-dark)]" : isStaff ? "text-[#14295F]" : "text-primary group-hover:text-white")}>{res.scheduledAt ? format(res.scheduledAt.toDate(), 'd') : ''}</span>
                        </div>
                        <div className="grid gap-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className={cn("font-black tracking-tight break-keep", isMobile ? "text-sm" : "text-base sm:text-lg", studentTitleTextClass)}>{res.scheduledAt ? format(res.scheduledAt.toDate(), 'HH:mm') : ''} 상담</h3>
                            {getStatusBadge(res.status)}
                          </div>
                          <p className={cn("font-bold flex items-center gap-1.5 truncate", isMobile ? "text-[9px]" : "text-[10px] sm:text-xs", studentMetaTextClass)}>
                            <User className="h-3.5 w-3.5 opacity-40 shrink-0" /> 
                            {isStudent ? (res.teacherName || '담당 교사 배정 중') : `${res.studentName} 학생 (담당: ${res.teacherName})`}
                          </p>
                          {isStaff && res.studentNote?.trim() && (
                            <div className="mt-2 rounded-[1rem] border border-[#dbe5ff] bg-[linear-gradient(135deg,#ffffff_0%,#f1f6ff_100%)] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
                              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5c6e97]">학생 메모</p>
                              <p className="mt-1 text-sm font-semibold leading-6 text-[#14295F]">{res.studentNote.trim()}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {isStaff && res.status === 'requested' && (
                          <div className="flex gap-2 w-full sm:w-auto">
                            <Button size="sm" onClick={() => handleUpdateStatus(res.id, 'confirmed')} className="rounded-xl font-black bg-[#FF7A16] hover:bg-[#e86c10] gap-1.5 h-10 px-4 text-white">
                              <Check className="h-4 w-4" /> 승인
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(res.id, 'canceled')} className="rounded-xl font-black border-[#dbe5ff] text-[#14295F] hover:bg-[#f5f8ff] h-10 px-4">
                              <X className="h-4 w-4" /> 거절
                            </Button>
                          </div>
                        )}
                        {isStaff && res.status === 'confirmed' && (
                          <Button size="sm" onClick={() => handleOpenLogModal(res)} className="rounded-xl font-black bg-[#14295F] text-white gap-1.5 h-10 px-4 shadow-md hover:bg-[#10224e]">
                            <FileEdit className="h-4 w-4" /> 일지 작성
                          </Button>
                        )}
                        {isStudent && (res.status === 'requested' || res.status === 'confirmed') && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleUpdateStatus(res.id, 'canceled')} 
                            className={cn("rounded-xl font-black h-10 px-4 transition-all", isStudentTrackTheme ? "border-rose-300/30 bg-rose-400/10 text-rose-100 hover:bg-rose-400/18" : "border-rose-200 text-rose-600 hover:bg-rose-50")}
                          >
                            <X className="h-4 w-4" /> 신청 취소
                          </Button>
                        )}
                        {!isStaff && !isStudent && <div className="h-10 w-10 rounded-full bg-primary/5 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                          <ChevronRight className="h-5 w-5" />
                        </div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
                {!showAll && reservations.length > PREVIEW_LIMIT && (
                  <div className={studentMoreWrapClass}>
                    <Button
                      asChild
                      variant={isStudentTrackTheme ? 'dark' : 'outline'}
                      className={cn(
                        'rounded-xl font-black',
                        isStaff && 'border-[#dbe5ff] bg-white text-[#14295F] hover:bg-[#f5f8ff]'
                      )}
                    >
                      <Link href="/dashboard/appointments/reservations">
                        상담예약 더보기 <ArrowRight className="ml-1 h-4 w-4" />
                      </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="animate-in fade-in slide-in-from-bottom-2 duration-500 w-full">
          <Card variant={isStudentTrackTheme ? 'secondary' : 'default'} className={studentSectionCardClass}>
            <CardHeader className={studentSectionHeaderClass}>
              <div className={cn("flex justify-between items-center gap-4", isMobile ? "flex-col" : "flex-row")}>
                <div className="space-y-2">
                  <CardTitle className={studentSectionTitleClass}>
                    <CheckCircle2 className={cn("h-6 w-6", isStudentTrackTheme ? "text-[var(--accent-orange)] opacity-100" : isStaff ? "text-[#14295F]" : "opacity-60 text-emerald-700")} /> 피드백 및 결과 일지
                  </CardTitle>
                  {isStaff && (
                    <CardDescription className="text-sm font-semibold leading-6 text-[#5c6e97]">
                      학생이 확인한 피드백과 아직 읽지 않은 일지를 시즌별로 빠르게 검토합니다.
                    </CardDescription>
                  )}
                </div>
                
                <div className={cn("flex items-center gap-2 p-1.5 rounded-2xl border", isMobile ? "w-full" : "w-auto", isStudentTrackTheme ? "border-white/10 bg-white/[0.06] shadow-none" : isStaff ? "border-[#dbe5ff] bg-[linear-gradient(135deg,#ffffff_0%,#eef4ff_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]" : "bg-white/50 shadow-sm")}>
                  <Filter className={cn("h-3.5 w-3.5 ml-2", isStudentTrackTheme ? "text-[var(--accent-orange-soft)]" : isStaff ? "text-[#14295F]" : "text-emerald-600")} />
                  <Select value={selectedSeason} onValueChange={setSelectedSeason}>
                    <SelectTrigger className={cn("h-9 w-full sm:w-[180px] border-none bg-transparent font-black text-xs shadow-none focus:ring-0", isStudentTrackTheme ? "text-[var(--text-on-dark)]" : isStaff ? "text-[#14295F]" : "")}>
                      <SelectValue placeholder="시즌 선택" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-2xl">
                      <SelectItem value="all" className="font-bold">전체 시즌 보기</SelectItem>
                      {availableSeasons.map(season => (
                        <SelectItem key={season} value={season} className="font-bold">
                          {season}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {logsLoading ? (
                <div className="py-20 flex justify-center"><Loader2 className={cn("animate-spin h-8 w-8", isStudentTrackTheme ? "text-white/30" : isStaff ? "text-[#5c6e97]" : "text-primary opacity-20")} /></div>
              ) : filteredLogs.length === 0 ? (
                <div className={cn("py-32", studentEmptyStateClass)}>
                  <FileText className={cn("h-16 w-16", isStudentTrackTheme ? "opacity-30" : "opacity-10")} />
                  해당 시즌의 기록이 없습니다.
                </div>
              ) : (
                <div className={cn(isStudentTrackTheme ? "space-y-3 p-4" : "divide-y divide-muted/10")}>
                  {visibleLogs.map((log) => {
                    const studentQuestion =
                      log.studentQuestion?.trim() ||
                      (log.reservationId ? reservationQuestionById.get(log.reservationId)?.trim() : '') ||
                      '';
                    return (
                    <div key={log.id} className={cn(isStudentTrackTheme ? "surface-card surface-card--ghost on-dark rounded-[1.35rem] border-white/10 shadow-none" : isStaff ? "rounded-[1.5rem] border border-[#e2dcff] bg-[linear-gradient(135deg,#ffffff_0%,#faf7ff_52%,#eef4ff_100%)] mx-4 my-4 shadow-[0_20px_42px_-34px_rgba(79,84,215,0.18)]" : "hover:bg-muted/5 transition-colors", isMobile ? "p-5" : "p-6 sm:p-10")}>
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-lg font-black uppercase text-[9px] px-2 py-0.5",
                                isStudentTrackTheme
                                  ? "border-white/14 bg-white/10 text-white shadow-none"
                                  : isStaff
                                    ? "border-[#dbe5ff] bg-[#f6f9ff] text-[#14295F]"
                                    : "border-primary/20 text-primary"
                              )}
                            >
                              {log.type === 'academic' ? '학업' : log.type === 'life' ? '생활' : '진로'}
                            </Badge>
                            <span className={cn("text-[10px] font-bold flex items-center gap-1.5", isStaff ? "text-[#5c6e97]" : "text-muted-foreground")}>
                              <Clock className="h-3 w-3 opacity-40" />
                              {log.createdAt ? format(log.createdAt.toDate(), 'yyyy.MM.dd') : ''}
                            </span>
                            <Badge variant="outline" className={cn("font-black text-[10px] px-2 py-0.5", isStaff ? "border-[#dbe5ff] bg-[#f6f9ff] text-[#14295F]" : "bg-emerald-100 text-emerald-700 border-none")}>
                              {log.createdAt ? getSeasonName(log.createdAt.toDate()) : ''}
                            </Badge>
                            {!isStudent && (
                              <Badge variant="secondary" className={cn("font-black text-[9px] gap-1 px-2 py-0.5", isStaff ? "border border-[#dbe5ff] bg-white text-[#14295F]" : "")}>
                                <GraduationCap className="h-2.5 w-2.5" /> {log.studentName}
                              </Badge>
                            )}
                            {isStaff && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "font-black text-[9px] px-2 py-0.5",
                                  log.readAt
                                    ? "border-[#dcefe2] bg-[#effaf3] text-[#14295F]"
                                    : "border-[#ffe3c6] bg-[#fff3e7] text-[#14295F]"
                                )}
                              >
                                {log.readAt ? '읽음' : '미확인'}
                              </Badge>
                            )}
                          </div>
                          {!isMobile && <span className={cn("text-[8px] font-black tracking-[0.3em]", isStudentTrackTheme ? "text-[var(--text-on-dark-muted)]/70" : isStaff ? "text-[#9badd3]" : "text-primary/30")}>상담 로그</span>}
                        </div>
                        
                        <div className="space-y-3">
                          {studentQuestion && (
                            <div className={cn(isStudentTrackTheme ? "surface-card surface-card--ghost on-dark border-[#66b9ff]/20" : isStaff ? "rounded-[1.25rem] border border-[#d8e7ff] bg-[linear-gradient(135deg,#ffffff_0%,#eff6ff_100%)]" : "rounded-[1.25rem] border border-sky-200 bg-sky-50/60", isMobile ? "p-4" : "p-5")}>
                              <p className={cn("mb-1 text-[10px] font-black uppercase tracking-widest", isStudentTrackTheme ? "text-[#9fd6ff]" : isStaff ? "text-[#5c6e97]" : "text-sky-700")}>학생 질문</p>
                              <p className={cn("font-bold leading-relaxed whitespace-pre-wrap break-keep", isMobile ? "text-sm" : "text-base", isStudentTrackTheme ? "text-[var(--text-on-dark)]" : isStaff ? "text-[#14295F]" : "text-sky-900")}>
                                {studentQuestion}
                              </p>
                            </div>
                          )}
                          <div className={cn(studentGhostPanelClass, isMobile ? "p-4" : "p-5")}>
                            <p className={cn("font-bold leading-relaxed whitespace-pre-wrap break-keep", isMobile ? "text-sm" : "text-base", studentBodyTextClass)}>{log.content}</p>
                          </div>
                          {log.improvement && (
                            <div className={cn(isStudentTrackTheme ? "surface-card surface-card--ghost on-dark border-emerald-300/18 flex items-start gap-3" : isStaff ? "rounded-[1.25rem] border border-[#d7efe0] bg-[linear-gradient(135deg,#f3fbf6_0%,#ffffff_100%)] flex items-start gap-3" : "rounded-[1.25rem] bg-emerald-50 border border-emerald-100 flex items-start gap-3", isMobile ? "p-4" : "p-5")}>
                              <div className={cn("p-1.5 rounded-lg shrink-0", isStudentTrackTheme ? "bg-emerald-400/12" : isStaff ? "bg-white" : "bg-white shadow-sm")}><AlertCircle className={cn("h-3.5 w-3.5", isStudentTrackTheme ? "text-emerald-300" : isStaff ? "text-[#14295F]" : "text-emerald-600")} /></div>
                              <div className="space-y-0.5">
                                <p className={cn("text-[9px] font-black uppercase tracking-widest leading-none", isStudentTrackTheme ? "text-emerald-300" : isStaff ? "text-[#5c6e97]" : "text-emerald-700")}>실천 권고</p>
                                <p className={cn("font-bold leading-relaxed", isMobile ? "text-xs" : "text-sm", isStudentTrackTheme ? "text-emerald-100" : isStaff ? "text-[#14295F]" : "text-emerald-900")}>{log.improvement}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
                {!showAll && filteredLogs.length > PREVIEW_LIMIT && (
                  <div className={studentMoreWrapClass}>
                    <Button
                      asChild
                      variant={isStudentTrackTheme ? 'dark' : 'outline'}
                      className={cn(
                        'rounded-xl font-black',
                        isStaff && 'border-[#dbe5ff] bg-white text-[#14295F] hover:bg-[#f5f8ff]'
                      )}
                    >
                      <Link href="/dashboard/appointments/logs">
                        상담일지 더보기 <ArrowRight className="ml-1 h-4 w-4" />
                      </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {(isStudent || isStaff) && (
          <TabsContent value="inquiries" className="animate-in fade-in slide-in-from-bottom-2 duration-500 w-full">
            <Card variant={isStudentTrackTheme ? 'secondary' : 'default'} className={studentSectionCardClass}>
              <CardHeader className={studentSectionHeaderClass}>
                <div className={cn('flex gap-4', isMobile ? 'flex-col' : 'items-start justify-between')}>
                  <div className="space-y-2">
                    <CardTitle className={studentSectionTitleClass}>
                      <MessageSquare className={cn("h-6 w-6", isStudentTrackTheme ? "text-[var(--accent-orange)] opacity-100" : isStaff ? "text-[#14295F]" : "opacity-60 text-sky-700")} /> 질문/건의/요청함
                    </CardTitle>
                    <CardDescription className={studentSectionDescriptionClass}>궁금한 점, 건의사항, 와이파이 방화벽 해제 요청까지 남기면 선생님 또는 센터관리자가 확인 후 답변합니다.</CardDescription>
                  </div>
                  {isStaff && (
                    <Badge variant="outline" className="h-7 rounded-full border-[#dbe5ff] bg-white px-3 text-[10px] font-black text-[#14295F]">
                      열린 질문 {staffOpenStudentInquiries}건
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {isStudent && (
                <div className={cn("space-y-4 border-b", isMobile ? "p-5" : "p-6 sm:p-8", isStudentTrackTheme ? "border-white/10 bg-white/[0.03]" : "bg-sky-50/20")}>
                  <div className={cn("grid gap-3", isMobile ? "grid-cols-1" : "grid-cols-[150px_1fr]")}>
                    <Select value={inquiryType} onValueChange={(value) => setInquiryType(value as StudentInquiryType)}>
                      <SelectTrigger className={cn("h-11 rounded-xl border-2 font-bold text-xs", isStudentTrackTheme && "border-white/12 bg-white/[0.08] text-[var(--text-on-dark)]")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="question">질문</SelectItem>
                        <SelectItem value="suggestion">건의사항</SelectItem>
                        <SelectItem value="firewall">와이파이 방화벽 해제 요청</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={inquiryTitle}
                      onChange={(e) => setInquiryTitle(e.target.value)}
                      placeholder={
                        inquiryType === 'firewall'
                          ? '요청 제목 (선택)'
                          : inquiryType === 'question'
                            ? '질문 제목 (선택)'
                            : '건의 제목 (선택)'
                      }
                      className={cn("h-11 rounded-xl border-2 font-bold", isStudentTrackTheme && "border-white/12 bg-white/[0.08] text-[var(--text-on-dark)] placeholder:text-[var(--text-on-dark-muted)]")}
                    />
                  </div>
                  {inquiryType === 'firewall' && (
                    <Input
                      value={firewallUrl}
                      onChange={(e) => setFirewallUrl(e.target.value)}
                      placeholder="예: classroom.google.com 또는 https://classroom.google.com"
                      className={cn("h-11 rounded-xl border-2 font-bold", isStudentTrackTheme && "border-white/12 bg-white/[0.08] text-[var(--text-on-dark)] placeholder:text-[var(--text-on-dark-muted)]")}
                    />
                  )}
                  <Textarea
                    value={inquiryBody}
                    onChange={(e) => setInquiryBody(e.target.value)}
                    placeholder={
                      inquiryType === 'firewall'
                        ? '해당 URL이 왜 필요한지, 어떤 수업/과제에 필요한지 이유를 적어 주세요.'
                        : inquiryType === 'question'
                          ? '질문 내용을 입력해 주세요.'
                          : '건의사항 내용을 입력해 주세요.'
                    }
                    className={cn("rounded-xl min-h-[120px] resize-none text-sm font-bold border-2", isStudentTrackTheme && "border-white/12 bg-white/[0.08] text-[var(--text-on-dark)] placeholder:text-[var(--text-on-dark-muted)]")}
                  />
                  <div className="flex justify-end">
                    <Button
                      onClick={handleSubmitInquiry}
                      disabled={isSubmitting || !inquiryBody.trim() || (inquiryType === 'firewall' && !firewallUrl.trim())}
                      className={cn("rounded-xl font-black h-11 px-6", counselingCtaClass)}
                    >
                      {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : '등록하기'}
                    </Button>
                  </div>
                </div>
                )}
                {parentCommsLoading ? (
                  <div className="py-20 flex justify-center"><Loader2 className={cn("animate-spin h-8 w-8", isStudentTrackTheme ? "text-white/30" : isStaff ? "text-[#5c6e97]" : "text-primary opacity-20")} /></div>
                ) : studentInquiries.length === 0 ? (
                  <div className={cn("py-24", studentEmptyStateClass)}>
                    <MessageSquare className={cn("h-16 w-16", isStudentTrackTheme ? "opacity-30" : "opacity-10")} />
                    등록된 질문/건의/요청이 없습니다.
                  </div>
                ) : (
                  <div className={cn(isStudentTrackTheme ? "space-y-3 p-4" : "divide-y divide-muted/10")}>
                    {visibleStudentInquiries.map((item) => {
                      const createdAtDate = item.createdAt?.toDate?.() || item.updatedAt?.toDate?.();
                      const createdAtLabel = createdAtDate ? format(createdAtDate, 'yyyy.MM.dd HH:mm') : '-';
                      const repliedAtDate = item.repliedAt?.toDate?.();
                      const repliedAtLabel = repliedAtDate ? format(repliedAtDate, 'yyyy.MM.dd HH:mm') : '';
                      const threadMessages = getSupportThreadMessages(item.id);
                      return (
                        <div key={item.id} className={cn(isStudentTrackTheme ? "surface-card surface-card--ghost on-dark rounded-[1.35rem] border-white/10 shadow-none" : isStaff ? "space-y-3 rounded-[1.5rem] border border-[#d9ecff] bg-[linear-gradient(135deg,#ffffff_0%,#f4faff_54%,#eef5ff_100%)] mx-4 my-4 shadow-[0_20px_42px_-34px_rgba(37,84,215,0.18)]" : "space-y-3 hover:bg-muted/5 transition-colors", isMobile ? "p-5" : "p-6 sm:p-8")}>
                          <div className="flex items-center gap-2 flex-wrap">
                            {getCommunicationTypeBadge(item)}
                            {getParentStatusBadge(item.status)}
                          </div>
                          <h3 className={cn("font-black break-keep", isMobile ? "text-sm" : "text-base", studentTitleTextClass)}>{item.title || '질문/건의'}</h3>
                          <p className={cn("text-[10px] font-bold", studentMetaTextClass)}>{createdAtLabel}</p>
                          {isStudentChatEnabledThread(item) && (
                            <div className="flex justify-end">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => setSelectedSupportThread(item)}
                                className={cn("rounded-full px-4 font-black h-9 gap-1.5", counselingCtaClass)}
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                                1:1 톡방 열기
                              </Button>
                            </div>
                          )}
                          {renderRequestedUrlPanel(item, 'student')}
                          <div className={cn(studentGhostPanelClass, "p-4")}>
                            <p className={cn("whitespace-pre-wrap text-sm font-bold leading-relaxed", studentBodyTextClass)}>{item.body?.trim() || '내용이 없습니다.'}</p>
                          </div>
                          {item.replyBody && threadMessages.length === 0 && (
                            <div className={cn(isStudentTrackTheme ? "surface-card surface-card--ghost on-dark border-emerald-300/18" : isStaff ? "rounded-2xl border border-[#d8efe2] bg-[linear-gradient(135deg,#f1fbf5_0%,#ffffff_100%)]" : "rounded-2xl border border-emerald-200 bg-emerald-50/70", "p-4")}>
                              <p className={cn("text-[10px] font-black mb-1", isStudentTrackTheme ? "text-emerald-300" : isStaff ? "text-[#5c6e97]" : "text-emerald-700")}>답변 {item.repliedByName ? `· ${item.repliedByName}` : ''} {repliedAtLabel ? `· ${repliedAtLabel}` : ''}</p>
                              <p className={cn("whitespace-pre-wrap text-sm font-bold leading-relaxed", isStudentTrackTheme ? "text-emerald-100" : isStaff ? "text-[#14295F]" : "text-emerald-900")}>{item.replyBody}</p>
                            </div>
                          )}
                          {renderSupportThread(item, 'student')}
                        </div>
                      );
                    })}
                  </div>
                )}
                {!showAll && studentInquiries.length > PREVIEW_LIMIT && (
                  <div className={studentMoreWrapClass}>
                    <Button
                      asChild
                      variant={isStudentTrackTheme ? 'dark' : 'outline'}
                      className={cn(
                        'rounded-xl font-black',
                        isStaff && 'border-[#dbe5ff] bg-white text-[#14295F] hover:bg-[#f5f8ff]'
                      )}
                    >
                      <Link href="/dashboard/appointments/inquiries">
                        질문/건의 더보기<ArrowRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isStaff && (
          <TabsContent value="parent" className="animate-in fade-in slide-in-from-bottom-2 duration-500 w-full">
            <Card className={staffPanelShellClass}>
              <CardHeader className={cn("border-b border-[#dbe5ff] bg-[linear-gradient(135deg,rgba(20,41,95,0.08)_0%,rgba(79,124,255,0.08)_52%,rgba(255,122,22,0.1)_100%)]", isMobile ? "p-6" : "p-6 sm:p-8")}>
                <div className={cn("flex justify-between items-center gap-4", isMobile ? "flex-col items-stretch" : "flex-row")}>
                  <div className="space-y-2">
                    <CardTitle className={cn("font-black text-[#14295F] flex items-center gap-3 break-keep", isMobile ? "text-lg" : "text-xl")}>
                      <ClipboardCheck className="h-6 w-6" /> 상담트랙 워크보드
                    </CardTitle>
                    <CardDescription className="text-sm font-semibold leading-6 text-[#5c6e97]">학생 질문, 와이파이 해제 요청, 학부모 요청을 확인하고 상태 변경 또는 답변을 남길 수 있습니다.</CardDescription>
                  </div>
                  <div className={cn("flex items-center gap-2", isMobile ? "w-full flex-col" : "w-auto")}>
                    <Select value={parentTypeFilter} onValueChange={(value: any) => setParentTypeFilter(value)}>
                      <SelectTrigger className={cn("h-10 rounded-xl border-[#dbe5ff] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] font-bold text-xs text-[#14295F]", isMobile ? "w-full" : "w-[150px]")}>
                        <SelectValue placeholder="요청 유형" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">유형 전체</SelectItem>
                        <SelectItem value="consultation">상담요청</SelectItem>
                        <SelectItem value="request">일반요청</SelectItem>
                        <SelectItem value="suggestion">건의사항</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={parentStatusFilter} onValueChange={(value: any) => setParentStatusFilter(value)}>
                      <SelectTrigger className={cn("h-10 rounded-xl border-[#dbe5ff] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] font-bold text-xs text-[#14295F]", isMobile ? "w-full" : "w-[150px]")}>
                        <SelectValue placeholder="처리 상태" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">상태 전체</SelectItem>
                        <SelectItem value="requested">접수됨</SelectItem>
                        <SelectItem value="in_progress">처리 중</SelectItem>
                        <SelectItem value="in_review">검토 중</SelectItem>
                        <SelectItem value="done">처리 완료</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {parentCommsLoading ? (
                  <div className="py-20 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-[#5c6e97]" /></div>
                ) : filteredParentCommunications.length === 0 ? (
                  <div className="py-24 text-center text-[#5c6e97] font-black italic flex flex-col items-center gap-4">
                    <ClipboardCheck className="h-16 w-16 opacity-30" />
                    확인할 문의가 없습니다.
                  </div>
                ) : (
                  <div className="space-y-4 p-4 sm:p-5">
                    {visibleParentCommunications.map((item) => {
                      const createdAtDate = item.createdAt?.toDate?.() || item.updatedAt?.toDate?.();
                      const createdAtLabel = createdAtDate ? format(createdAtDate, 'yyyy.MM.dd HH:mm') : '-';
                      const studentName = studentNameById.get(item.studentId) || item.studentId;
                      const channelLabel =
                        item.channel === 'visit' ? '방문' : item.channel === 'phone' ? '전화' : item.channel === 'online' ? '온라인' : null;
                      const threadMessages = getSupportThreadMessages(item.id);
                      const isStudentThread = item.senderRole === 'student';
                      return (
                        <div key={item.id} className={cn("flex flex-col gap-4 rounded-[1.5rem] border border-[#e7dcff] bg-[linear-gradient(135deg,#fffaf3_0%,#f8f5ff_45%,#eef5ff_100%)] shadow-[0_20px_42px_-34px_rgba(20,41,95,0.2)]", isMobile ? "p-5" : "p-6 sm:p-8")}>
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="space-y-2 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {getCommunicationTypeBadge(item)}
                                {getParentStatusBadge(item.status)}
                                <Badge variant="outline" className="h-6 rounded-full border-[#dbe5ff] bg-white px-2.5 text-[10px] font-black text-[#14295F]">{item.senderRole === 'student' ? '작성: 학생' : '작성: 학부모'}</Badge>
                                {channelLabel && <Badge variant="outline" className="h-6 rounded-full border-[#dbe5ff] bg-white px-2.5 text-[10px] font-black text-[#14295F]">채널: {channelLabel}</Badge>}
                              </div>
                              <h3 className={cn("font-black text-[#14295F] break-keep", isMobile ? "text-sm" : "text-base")}>{item.title || '문의'}</h3>
                              <p className="text-[10px] font-bold text-[#5c6e97]">
                                작성자: {getCommunicationOwnerLabel(item)} · 학생: {studentName} · {createdAtLabel}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {isStudentThread && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setSelectedSupportThread(item)}
                                  className="rounded-xl border-[#dbe5ff] bg-white font-black text-[#14295F] h-9 hover:bg-[#f5f8ff]"
                                >
                                  1:1 톡 열기
                                </Button>
                              )}
                              {item.status !== 'in_progress' && item.status !== 'done' && (
                                <Button size="sm" variant="outline" disabled={isSubmitting} onClick={() => handleParentCommunicationStatus(item.id, item.type === 'consultation' ? 'in_progress' : 'in_review')} className="rounded-xl border-[#dbe5ff] bg-white font-black text-[#14295F] h-9 hover:bg-[#f5f8ff]">
                                  {item.type === 'consultation' ? '처리 시작' : '검토 시작'}
                                </Button>
                              )}
                              {item.status !== 'done' && (
                                <Button size="sm" disabled={isSubmitting} onClick={() => handleParentCommunicationStatus(item.id, 'done')} className="rounded-xl font-black h-9 bg-[#FF7A16] text-white hover:bg-[#e86c10]">
                                  완료 처리
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-[#dbe5ff] bg-[linear-gradient(135deg,#ffffff_0%,#f4f8ff_100%)] p-4">
                            <p className="whitespace-pre-wrap text-sm font-bold text-[#14295F] leading-relaxed">{item.body?.trim() || '요청 내용이 비어 있습니다.'}</p>
                          </div>
                          {renderRequestedUrlPanel(item, 'staff')}
                          {isStudentThread ? (
                            renderSupportThread(item, 'staff')
                          ) : (
                            <div className="space-y-2">
                              <p className="text-[10px] font-black text-[#5c6e97] uppercase tracking-wider">답변</p>
                              <Textarea
                                value={getReplyDraftValue(item)}
                                onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                placeholder="학생/학부모에게 전달할 답변을 입력해 주세요."
                                className={cn("min-h-[92px] resize-none", staffInputClass)}
                              />
                              <div className="flex justify-end">
                                <Button size="sm" disabled={isSubmitting || !getReplyDraftValue(item).trim()} onClick={() => handleSaveCommunicationReply(item)} className="rounded-xl font-black h-9 bg-[#14295F] text-white hover:bg-[#10224e]">
                                  답변 저장
                                </Button>
                              </div>
                            </div>
                          )}
                          {item.replyBody && threadMessages.length === 0 && (
                            <div className="rounded-2xl border border-[#d8efe2] bg-[linear-gradient(135deg,#f2fbf6_0%,#ffffff_100%)] p-4">
                              <p className="text-[10px] font-black text-[#5c6e97] mb-1">
                                최근 답변{item.repliedByName ? ` · ${item.repliedByName}` : ''}
                              </p>
                              <p className="whitespace-pre-wrap text-sm font-bold text-[#14295F] leading-relaxed">{item.replyBody}</p>
                            </div>
                          )}
                          {item.handledByName && (
                            <p className="text-[10px] font-bold text-[#5c6e97]">담당자: {item.handledByName}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {!showAll && filteredParentCommunications.length > PREVIEW_LIMIT && (
                  <div className="border-t border-[#dbe5ff] p-5 sm:p-6 flex justify-center bg-[linear-gradient(180deg,#f9fbff_0%,#eef4ff_100%)]">
                    <Button asChild variant="outline" className="rounded-xl border-[#dbe5ff] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] font-black text-[#14295F] hover:bg-[#f5f8ff]">
                      <Link href="/dashboard/appointments/parent-requests">
                        학부모 요청 더보기 <ArrowRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={isLogModalOpen} onOpenChange={setIsLogModalOpen}>
        <DialogContent className={cn("rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl", isMobile ? "w-[min(94vw,28rem)] max-h-[86svh] rounded-[2rem]" : "sm:max-w-md")}>
          <div className={cn("relative bg-[#14295F] text-white", isMobile ? "p-6" : "p-8")}>
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tighter">상담 일지 작성</DialogTitle>
              <DialogDescription className="text-white/70 font-bold">상담 후 피드백을 기록하고 예약을 완료 처리합니다.</DialogDescription>
            </DialogHeader>
            {selectedResForLog && (
              <div className="mt-4 rounded-[1.2rem] border border-white/10 bg-white/[0.08] px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/60">대상 상담</p>
                <p className="mt-2 text-base font-black text-white">{selectedResForLog.studentName || '학생'} · {selectedResForLog.teacherName || '선생님'}</p>
                <p className="mt-1 text-[11px] font-semibold text-white/70">
                  {selectedResForLog.scheduledAt ? format(selectedResForLog.scheduledAt.toDate(), 'yyyy.MM.dd HH:mm') : '일정 정보 없음'}
                </p>
              </div>
            )}
          </div>
          <div className={cn("space-y-5 bg-white", isMobile ? "max-h-[calc(86svh-9rem)] overflow-y-auto p-5" : "p-8")}>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-[#5c6e97] ml-1">상담 유형</label>
              <Select value={logType} onValueChange={(val: any) => setLogType(val)}>
                <SelectTrigger className={cn("rounded-xl h-12", staffInputClass)}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="academic">학업/성적</SelectItem>
                  <SelectItem value="life">생활 습관</SelectItem>
                  <SelectItem value="career">진로/진학</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-[#5c6e97] ml-1">상담 내용</label>
              <Textarea placeholder="핵심 내용을 상세히 기록하세요." value={logContent} onChange={(e) => setLogContent(e.target.value)} className={cn("min-h-[120px] text-sm", staffInputClass)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-[#5c6e97] ml-1">개선 권고 사항</label>
              <Input placeholder="학생이 수행할 과제나 개선점" value={logImprovement} onChange={(e) => setLogImprovement(e.target.value)} className={cn("h-12", staffInputClass)} />
            </div>
          </div>
          <DialogFooter className={cn("border-t border-[#dbe5ff] bg-[#f8fbff]", isMobile ? "p-5" : "p-8")}>
            <Button onClick={handleSaveCounselLog} disabled={isSubmitting || !logContent.trim()} className="w-full h-14 rounded-2xl font-black bg-[#FF7A16] text-white shadow-xl hover:bg-[#e86c10]">
              {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : '상담 완료 및 일지 저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(liveSelectedSupportThread)} onOpenChange={(open) => { if (!open) setSelectedSupportThread(null); }}>
        <DialogContent className={cn("overflow-hidden border-none p-0 shadow-2xl", isMobile ? "w-[min(96vw,29rem)] max-h-[88svh] rounded-[2rem]" : "sm:max-w-3xl rounded-[2.25rem]")}>
          {liveSelectedSupportThread && (
            <>
              <div className={cn(
                "relative overflow-hidden",
                isStudentTrackTheme
                  ? "bg-[linear-gradient(135deg,#14295F_0%,#1C3D8B_58%,#2C5BD8_100%)] text-white"
                  : "bg-[linear-gradient(135deg,#14295F_0%,#274BA6_58%,#3F73FF_100%)] text-white",
                isMobile ? "p-5" : "p-7"
              )}>
                <DialogHeader>
                  <DialogTitle className={cn("font-black tracking-tight", isMobile ? "text-xl" : "text-2xl")}>
                    {liveSelectedSupportThread.title || '1:1 톡'}
                  </DialogTitle>
                  <DialogDescription className="text-white/75 font-bold">
                    {isStudentTrackTheme
                      ? '선생님 또는 센터관리자와 카카오톡처럼 이어지는 1:1 상담 톡방이에요.'
                      : '학생과 실시간으로 이어지는 1:1 상담 톡방입니다.'}
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {getCommunicationTypeBadge(liveSelectedSupportThread)}
                  {getParentStatusBadge(liveSelectedSupportThread.status)}
                  <Badge variant="dark" className="border-white/12 bg-white/10 text-white shadow-none">
                    1:1 톡 진행 중
                  </Badge>
                </div>
                {liveSelectedSupportThread.supportKind === 'wifi_unblock' && liveSelectedSupportThread.requestedUrl && (
                  <div className="mt-4 rounded-[1.35rem] border border-white/12 bg-white/[0.08] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/70">요청 URL</p>
                    <a
                      href={liveSelectedSupportThread.requestedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 flex items-center gap-2 break-all text-sm font-black text-white underline decoration-white/40 underline-offset-4"
                    >
                      <Link2 className="h-3.5 w-3.5 shrink-0 text-[#ffcf9f]" />
                      {liveSelectedSupportThread.requestedUrl}
                    </a>
                  </div>
                )}
              </div>

              <div className="flex flex-col bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)]">
                <div className={cn("overflow-y-auto", isMobile ? "max-h-[46svh] p-4" : "max-h-[30rem] p-6")}>
                  <div className="space-y-3">
                    {liveSelectedSupportThreadTimeline.map((message) => {
                      const isStudentSender = message.senderRole === 'student';
                      const alignRight = isStudentTrackTheme ? isStudentSender : !isStudentSender;
                      const messageTime = message.createdAt?.toDate?.();

                      return (
                        <div key={message.id} className={cn('flex', alignRight ? 'justify-end' : 'justify-start')}>
                          <div
                            className={cn(
                              'max-w-[85%] rounded-[1.5rem] px-4 py-3 shadow-sm',
                              alignRight
                                ? 'bg-[linear-gradient(180deg,#FFB24C_0%,#FF8A1F_100%)] text-white'
                                : 'border border-[#dbe5ff] bg-white text-[#14295F]'
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <p className={cn(
                                'text-[10px] font-black uppercase tracking-[0.18em]',
                                alignRight ? 'text-white/75' : 'text-[#7f93ba]'
                              )}>
                                {getSupportSenderLabel(message)}
                              </p>
                              {message.isInitialRequest && (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'h-5 rounded-full px-2 text-[9px] font-black',
                                    alignRight
                                      ? 'border-white/20 bg-white/10 text-white'
                                      : 'border-[#ffd9b6] bg-[#fff3e7] text-[#FF7A16]'
                                  )}
                                >
                                  첫 요청
                                </Badge>
                              )}
                            </div>
                            <p className={cn(
                              'mt-2 whitespace-pre-wrap text-sm font-bold leading-relaxed',
                              alignRight ? 'text-white' : 'text-[#14295F]'
                            )}>
                              {message.body}
                            </p>
                            <p className={cn(
                              'mt-2 text-[10px] font-semibold',
                              alignRight ? 'text-white/70' : 'text-[#8ca0c7]'
                            )}>
                              {messageTime ? format(messageTime, 'MM.dd HH:mm') : ''}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className={cn("border-t border-[#dbe5ff] bg-white", isMobile ? "p-4" : "p-5")}>
                  <div className="space-y-3">
                    <Textarea
                      value={getThreadDraftValue(liveSelectedSupportThread.id)}
                      onChange={(e) => setThreadDrafts((prev) => ({ ...prev, [liveSelectedSupportThread.id]: e.target.value }))}
                      placeholder={isStudentTrackTheme ? '선생님 또는 센터관리자에게 보낼 메시지를 입력해 주세요.' : '학생에게 보낼 메시지를 입력해 주세요.'}
                      className="min-h-[92px] resize-none rounded-[1.25rem] border-[#dbe5ff] bg-[#f8fbff] font-bold text-[#14295F] placeholder:text-[#8ca0c7]"
                    />
                    <div className="flex justify-end">
                      <Button
                        onClick={() => handleSendSupportMessage(liveSelectedSupportThread)}
                        disabled={isSubmitting || !getThreadDraftValue(liveSelectedSupportThread.id).trim()}
                        className={cn("rounded-full px-5 font-black h-11 gap-2", counselingCtaClass)}
                      >
                        <Send className="h-4 w-4" />
                        메시지 보내기
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AppointmentsPage() {
  return <AppointmentsPageContent />;
}
