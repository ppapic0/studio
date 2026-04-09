
'use client';

import Link from 'next/link';
import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { useCollection, useFirestore, useFunctions, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { addDoc, collection, doc, increment, serverTimestamp, Timestamp, writeBatch, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { 
  UserPlus, 
  GraduationCap, 
  ChevronRight, 
  Loader2, 
  UserCheck,
  UserMinus,
  PauseCircle,
  Users,
  Trash2,
  AlertTriangle,
  Megaphone,
  TrendingUp,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { StudentProfile, AttendanceCurrent, CenterMembership } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatSeatLabel, resolveSeatIdentity } from '@/lib/seat-layout';
import { AdminWorkbenchCommandBar } from '@/components/dashboard/admin-workbench-command-bar';
import { appendAttendanceEventToBatch, mergeAttendanceDailyStatToBatch } from '@/lib/attendance-events';
import { syncAutoAttendanceRecord } from '@/lib/attendance-auto';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { canManageSettings, canManageStaff, canReadFinance, isTeacherOrAdminRole } from '@/lib/dashboard-access';

function resolveCallableErrorMessage(error: any, fallback: string): string {
  const detailMessage =
    typeof error?.details === 'string'
      ? error.details
      : typeof error?.details?.userMessage === 'string'
        ? error.details.userMessage
        : typeof error?.details?.message === 'string'
          ? error.details.message
          : '';

  const rawMessage = String(error?.message || '').replace(/^FirebaseError:\s*/i, '').trim();
  const cleanedRaw = rawMessage
    .replace(/^\d+\s+FAILED_PRECONDITION:\s*/i, '')
    .replace(/^\d+\s+INVALID_ARGUMENT:\s*/i, '')
    .replace(/^\d+\s+ALREADY_EXISTS:\s*/i, '')
    .replace(/^\d+\s+PERMISSION_DENIED:\s*/i, '')
    .replace(/^\d+\s+INTERNAL:\s*/i, '')
    .trim();

  const code = String(error?.code || '').toLowerCase();
  const isInternal = code.includes('internal') || /\b(functions\/internal|internal)\b/i.test(cleanedRaw);

  if (detailMessage) return detailMessage;
  if (!isInternal && cleanedRaw) return cleanedRaw;

  if (code.includes('permission-denied')) {
    return '삭제 권한이 없습니다. 센터관리자 계정인지 확인해 주세요.';
  }
  if (code.includes('failed-precondition')) {
    return '삭제할 학생 계정을 찾지 못했습니다. 학생 등록 상태를 다시 확인해 주세요.';
  }

  return fallback;
}

export default function StudentListPage() {
  const { activeMembership, membershipsLoading, viewMode } = useAppContext();
  const { user: currentUser } = useUser();
  const firestore = useFirestore();
  const functions = useFunctions();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusTab, setStatusTab] = useState<string>('active');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [liveStatusFilter, setLiveStatusFilter] = useState<string>('all');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [activeQuickAction, setActiveQuickAction] = useState<'attendance' | 'counseling' | 'sms'>('attendance');
  const [attendanceActionSaving, setAttendanceActionSaving] = useState(false);
  const [counselingActionSaving, setCounselingActionSaving] = useState(false);
  const [manualSmsSending, setManualSmsSending] = useState(false);
  const [counselingType, setCounselingType] = useState<'academic' | 'life' | 'career'>('academic');
  const [counselingContent, setCounselingContent] = useState('');
  const [counselingImprovement, setCounselingImprovement] = useState('');
  const [manualSmsMessage, setManualSmsMessage] = useState('');
  
  const isMobile = viewMode === 'mobile';

  // 신규 학생 등록 상태
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [newStudent, setNewStudent] = useState({
    name: '',
    email: '',
    password: '',
    schoolName: '',
    grade: '1학년',
  });

  const centerId = activeMembership?.id;
  const isTeacherOrAdmin = isTeacherOrAdminRole(activeMembership?.role);
  const canManageStudentAccounts = canManageStaff(activeMembership?.role);
  const canOpenFinance = canReadFinance(activeMembership?.role);
  const canOpenSettings = canManageSettings(activeMembership?.role);

  useEffect(() => {
    const showRisk = searchParams.get('showRisk');
    if (showRisk === '1' || showRisk === 'true') {
      router.replace('/dashboard/revenue?showRisk=1#risk-analysis');
    }
  }, [searchParams, router]);

  // 1. 센터 멤버 중 '학생' 역할인 사용자들 조회
  const membersQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isTeacherOrAdmin) return null;
    return query(
      collection(firestore, 'centers', centerId, 'members'), 
      where('role', '==', 'student')
    );
  }, [firestore, centerId, isTeacherOrAdmin]);
  
  const { data: studentMembers, isLoading: membersLoading } = useCollection<CenterMembership>(membersQuery, { enabled: isTeacherOrAdmin });

  // 2. 학생 상세 프로필 조회
  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isTeacherOrAdmin) return null;
    return collection(firestore, 'centers', centerId, 'students');
  }, [firestore, centerId, isTeacherOrAdmin]);
  
  const { data: studentsProfiles } = useCollection<StudentProfile>(studentsQuery, { enabled: isTeacherOrAdmin });

  // 3. 실시간 출결 상태 조회
  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isTeacherOrAdmin) return null;
    return collection(firestore, 'centers', centerId, 'attendanceCurrent');
  }, [firestore, centerId, isTeacherOrAdmin]);
  
  const { data: attendanceList } = useCollection<AttendanceCurrent>(attendanceQuery, { enabled: isTeacherOrAdmin });

  const availableClasses = useMemo(() => {
    const classes = Array.from(
      new Set(
        (studentMembers || [])
          .map((member) => member.className?.trim())
          .filter((value): value is string => Boolean(value))
      )
    );
    return classes.sort((a, b) => a.localeCompare(b, 'ko'));
  }, [studentMembers]);

  // 데이터 통합, 필터링 및 정렬
  const filteredStudents = useMemo(() => {
    if (!studentMembers) return [];
    
    const search = searchTerm.toLowerCase();
    
    return studentMembers
      .filter(member => {
        // 상태 필터링
        if (member.status !== statusTab) return false;

        const profile = studentsProfiles?.find(p => p.id === member.id);
        const attendance = attendanceList?.find((item) => item.studentId === member.id);
        const currentLiveStatus =
          attendance?.status === 'studying'
            ? 'studying'
            : attendance?.status === 'away' || attendance?.status === 'break'
              ? 'away'
              : 'absent';

        if (classFilter !== 'all' && (member.className || '') !== classFilter) return false;
        if (liveStatusFilter !== 'all' && currentLiveStatus !== liveStatusFilter) return false;

        // 검색어 필터링
        const seatLabel = formatSeatLabel(profile);
        const seatIdentity = resolveSeatIdentity(profile || {});
        return (
          member.displayName?.toLowerCase().includes(search) || 
          profile?.schoolName?.toLowerCase().includes(search) ||
          seatLabel.toLowerCase().includes(search) ||
          profile?.seatNo?.toString().includes(search) ||
          (seatIdentity.roomSeatNo > 0 && seatIdentity.roomSeatNo.toString().includes(search))
        );
      })
      .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
  }, [studentMembers, studentsProfiles, attendanceList, searchTerm, statusTab, classFilter, liveStatusFilter]);

  const selectedStudentPreview = useMemo(() => {
    if (!selectedStudentId) return null;
    const member = studentMembers?.find((item) => item.id === selectedStudentId);
    if (!member) return null;

    const profile = studentsProfiles?.find((item) => item.id === selectedStudentId);
    const attendance = attendanceList?.find((item) => item.studentId === selectedStudentId);
    const seatLabel = formatSeatLabel(profile);
    const seatIdentity = resolveSeatIdentity(profile || {});
    const attendanceLabel =
      attendance?.status === 'studying'
        ? '공부중'
        : attendance?.status === 'away' || attendance?.status === 'break'
          ? '외출'
          : attendance?.status === 'absent'
            ? '미입실'
            : '확인중';
    const attendanceTone =
      attendance?.status === 'studying'
        ? 'bg-emerald-100 text-emerald-700'
        : attendance?.status === 'away' || attendance?.status === 'break'
          ? 'bg-amber-100 text-amber-700'
          : 'bg-[#eef4ff] text-[#14295F]';

    return {
      member,
      profile,
      attendance,
      seatIdentity,
      seatDocId: attendance?.id || profile?.seatId || null,
      seatLabel,
      attendanceLabel,
      attendanceTone,
    };
  }, [selectedStudentId, studentMembers, studentsProfiles, attendanceList]);

  useEffect(() => {
    if (!selectedStudentPreview) return;
    setActiveQuickAction('attendance');
    setCounselingType('academic');
    setCounselingContent('');
    setCounselingImprovement('');
    setManualSmsMessage('');
  }, [selectedStudentPreview?.member.id]);

  const counts = useMemo(() => {
    if (!studentMembers) return { active: 0, onHold: 0, withdrawn: 0 };
    return {
      active: studentMembers.filter(m => m.status === 'active').length,
      onHold: studentMembers.filter(m => m.status === 'onHold').length,
      withdrawn: studentMembers.filter(m => m.status === 'withdrawn').length,
    };
  }, [studentMembers]);

  const operationalSummary = useMemo(() => {
    const activeIds = new Set((studentMembers || []).filter((member) => member.status === 'active').map((member) => member.id));
    const activeAttendance = (attendanceList || []).filter((item) => item.studentId && activeIds.has(item.studentId));
    const studyingCount = activeAttendance.filter((item) => item.status === 'studying').length;
    const awayCount = activeAttendance.filter((item) => item.status === 'away' || item.status === 'break').length;
    const absentCount = Math.max(0, activeIds.size - studyingCount - awayCount);
    const assignedSeatCount = (studentsProfiles || []).filter((profile) => {
      const identity = resolveSeatIdentity(profile || {});
      return identity.roomSeatNo > 0 || identity.seatNo > 0;
    }).length;

    return {
      activeStudents: counts.active,
      studyingCount,
      awayCount,
      absentCount,
      assignedSeatCount,
    };
  }, [attendanceList, counts.active, studentMembers, studentsProfiles]);

  const handleAddStudent = async () => {
    if (!centerId || !functions) return;
    if (!newStudent.name || !newStudent.email || !newStudent.password || !newStudent.schoolName) {
      toast({ variant: "destructive", title: "정보 미입력", description: "모든 필수 정보를 입력해 주세요." });
      return;
    }

    setIsSubmitting(true);
    try {
      const registerStudentFn = httpsCallable(functions, 'registerStudent');
      const result: any = await registerStudentFn({
        email: newStudent.email,
        password: newStudent.password,
        displayName: newStudent.name,
        schoolName: newStudent.schoolName,
        grade: newStudent.grade,
        centerId: centerId
      });

      if (result.data?.ok) {
        toast({ title: "등록 완료", description: `${newStudent.name} 학생의 계정이 생성되었습니다.` });
        setIsAddModalOpen(false);
        setNewStudent({ name: '', email: '', password: '', schoolName: '', grade: '1학년' });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "등록 실패", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAccount = async (studentId: string, name: string) => {
    if (!functions || !centerId) return;
    
    setIsDeleting(studentId);
    try {
      // 대량 데이터 삭제를 위해 클라이언트 측 제한 시간을 10분으로 연장
      const deleteFn = httpsCallable(functions, 'deleteStudentAccount', { timeout: 600000 });
      const result: any = await deleteFn({ studentId, centerId });
      
      if (result.data?.ok) {
        toast({ title: "삭제 완료", description: `${name} 학생의 모든 데이터가 영구적으로 삭제되었습니다.` });
      } else {
        throw new Error(result.data?.message || "삭제 처리 실패");
      }
    } catch (e: any) {
      console.error("[Delete Student Error]", e);
      let errorMsg = resolveCallableErrorMessage(e, "계정 삭제 중 오류가 발생했습니다.");
      if (e.code === 'deadline-exceeded') {
        errorMsg = "서버 처리 시간이 너무 오래 걸립니다. 하지만 삭제 작업은 백그라운드에서 계속 진행될 수 있습니다. 잠시 후 확인해 보세요.";
      }
      toast({ 
        variant: "destructive", 
        title: "삭제 실패", 
        description: errorMsg
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const handleOpenStudent360 = (studentId: string) => {
    if (!studentId) return;
    router.push(`/dashboard/teacher/students/${encodeURIComponent(studentId)}`);
  };

  const handleInlineAttendanceAction = async (nextStatus: AttendanceCurrent['status']) => {
    if (!firestore || !centerId || !selectedStudentPreview) return;

    const studentId = selectedStudentPreview.member.id;
    const studentName = selectedStudentPreview.member.displayName || '학생';
    const prevStatus = selectedStudentPreview.attendance?.status || 'absent';
    const seatDocId = selectedStudentPreview.seatDocId;
    const seatIdentity = selectedStudentPreview.seatIdentity;
    const nextStatusLabel =
      nextStatus === 'studying' ? '공부중' : nextStatus === 'away' ? '외출' : '미입실';

    if (!seatDocId || (!seatIdentity.roomSeatNo && !seatIdentity.seatNo)) {
      toast({
        variant: 'destructive',
        title: '출결 처리 불가',
        description: '좌석이 배정된 학생만 여기서 바로 출결을 처리할 수 있습니다.',
      });
      return;
    }

    if (prevStatus === nextStatus) {
      toast({
        title: '이미 반영된 상태입니다.',
        description: `${studentName} 학생은 이미 ${nextStatus === 'studying' ? '공부중' : nextStatus === 'away' ? '외출' : '미입실'} 상태입니다.`,
      });
      return;
    }

    setAttendanceActionSaving(true);
    try {
      const batch = writeBatch(firestore);
      const nowDate = new Date();
      const todayDateKey = format(nowDate, 'yyyy-MM-dd');
      const seatRef = doc(firestore, 'centers', centerId, 'attendanceCurrent', seatDocId);

      if (prevStatus === 'studying' && nextStatus !== 'studying' && selectedStudentPreview.attendance?.lastCheckInAt) {
        const nowMs = nowDate.getTime();
        const startTime = selectedStudentPreview.attendance.lastCheckInAt.toMillis();
        const sessionDateKey = format(selectedStudentPreview.attendance.lastCheckInAt.toDate(), 'yyyy-MM-dd');
        const sessionSeconds = Math.max(0, Math.floor((nowMs - startTime) / 1000));
        const sessionMinutes = Math.max(1, Math.ceil(sessionSeconds / 60));

        if (sessionSeconds > 0) {
          const logRef = doc(firestore, 'centers', centerId, 'studyLogs', studentId, 'days', sessionDateKey);
          batch.set(
            logRef,
            {
              studentId,
              centerId,
              dateKey: sessionDateKey,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          const sessionRef = doc(collection(firestore, 'centers', centerId, 'studyLogs', studentId, 'days', sessionDateKey, 'sessions'));
          batch.set(sessionRef, {
            startTime: selectedStudentPreview.attendance.lastCheckInAt,
            endTime: Timestamp.fromMillis(nowMs),
            durationMinutes: sessionMinutes,
            createdAt: serverTimestamp(),
          });

        }
      }

      const seatPayload: Record<string, unknown> = {
        studentId,
        seatNo: seatIdentity.seatNo || 0,
        roomId: seatIdentity.roomId || null,
        roomSeatNo: seatIdentity.roomSeatNo || undefined,
        type: selectedStudentPreview.attendance?.type || 'seat',
        seatZone: selectedStudentPreview.attendance?.seatZone || null,
        status: nextStatus,
        updatedAt: serverTimestamp(),
        ...(nextStatus === 'studying' ? { lastCheckInAt: serverTimestamp() } : {}),
      };
      batch.set(seatRef, seatPayload, { merge: true });

      appendAttendanceEventToBatch(batch, firestore, centerId, {
        studentId,
        dateKey: todayDateKey,
        eventType: 'status_override',
        occurredAt: nowDate,
        source: 'student_index',
        seatId: seatDocId,
        statusBefore: prevStatus,
        statusAfter: nextStatus,
      });

      let smsEventType: 'study_start' | 'away_start' | 'away_end' | 'study_end' | null = null;
      if (prevStatus === 'absent' && nextStatus === 'studying') {
        appendAttendanceEventToBatch(batch, firestore, centerId, {
          studentId,
          dateKey: todayDateKey,
          eventType: 'check_in',
          occurredAt: nowDate,
          source: 'student_index',
          seatId: seatDocId,
          statusBefore: prevStatus,
          statusAfter: nextStatus,
        });
        mergeAttendanceDailyStatToBatch(batch, firestore, centerId, studentId, todayDateKey, {
          attendanceStatus: nextStatus,
          checkInAt: nowDate,
          source: 'student_index',
        });
        smsEventType = 'study_start';
      } else if ((prevStatus === 'away' || prevStatus === 'break') && nextStatus === 'studying') {
        appendAttendanceEventToBatch(batch, firestore, centerId, {
          studentId,
          dateKey: todayDateKey,
          eventType: 'away_end',
          occurredAt: nowDate,
          source: 'student_index',
          seatId: seatDocId,
          statusBefore: prevStatus,
          statusAfter: nextStatus,
        });
        mergeAttendanceDailyStatToBatch(batch, firestore, centerId, studentId, todayDateKey, {
          attendanceStatus: nextStatus,
          source: 'student_index',
        });
        smsEventType = 'away_end';
      } else if ((nextStatus === 'away' || nextStatus === 'break') && prevStatus === 'studying') {
        appendAttendanceEventToBatch(batch, firestore, centerId, {
          studentId,
          dateKey: todayDateKey,
          eventType: 'away_start',
          occurredAt: nowDate,
          source: 'student_index',
          seatId: seatDocId,
          statusBefore: prevStatus,
          statusAfter: nextStatus,
        });
        mergeAttendanceDailyStatToBatch(batch, firestore, centerId, studentId, todayDateKey, {
          attendanceStatus: nextStatus,
          source: 'student_index',
        });
        smsEventType = 'away_start';
      } else if (nextStatus === 'absent' && prevStatus !== 'absent') {
        appendAttendanceEventToBatch(batch, firestore, centerId, {
          studentId,
          dateKey: todayDateKey,
          eventType: 'check_out',
          occurredAt: nowDate,
          source: 'student_index',
          seatId: seatDocId,
          statusBefore: prevStatus,
          statusAfter: nextStatus,
        });
        mergeAttendanceDailyStatToBatch(batch, firestore, centerId, studentId, todayDateKey, {
          attendanceStatus: nextStatus,
          checkOutAt: nowDate,
          hasCheckOutRecord: true,
          source: 'student_index',
        });
        smsEventType = 'study_end';
      } else {
        mergeAttendanceDailyStatToBatch(batch, firestore, centerId, studentId, todayDateKey, {
          attendanceStatus: nextStatus,
          source: 'student_index',
        });
      }

      await batch.commit();

      const autoCheckInAt =
        nextStatus === 'studying'
          ? nowDate
          : selectedStudentPreview.attendance?.lastCheckInAt?.toDate?.() || null;
      void syncAutoAttendanceRecord({
        firestore,
        centerId,
        studentId,
        studentName,
        targetDate: nowDate,
        checkInAt: autoCheckInAt,
        confirmedByUserId: currentUser?.uid,
      }).catch((syncError: any) => {
        console.warn('[student-index] auto attendance sync skipped', syncError?.message || syncError);
      });

      let successTitle = '출결 처리를 저장했습니다.';
      let successDescription = `${studentName} 학생 상태를 ${nextStatusLabel}으로 반영했습니다.`;

      if (smsEventType && functions) {
        try {
          const notifyAttendanceSms = httpsCallable(functions, 'notifyAttendanceSms');
          await notifyAttendanceSms({ centerId, studentId, eventType: smsEventType });
        } catch (notifyError: any) {
          console.warn('[student-index] attendance sms notify skipped', notifyError?.message || notifyError);
          successTitle = '출결은 저장되었습니다.';
          successDescription = `${studentName} 학생 상태는 ${nextStatusLabel}으로 반영했고, 보호자 문자 접수는 확인이 필요합니다.`;
        }
      } else if (smsEventType && !functions) {
        successTitle = '출결은 저장되었습니다.';
        successDescription = `${studentName} 학생 상태는 ${nextStatusLabel}으로 반영했고, 문자 기능은 아직 준비되지 않았습니다.`;
      }

      toast({
        title: successTitle,
        description: successDescription,
      });
    } catch (error) {
      console.error('[student-index] inline attendance update failed', error);
      toast({
        variant: 'destructive',
        title: '출결 처리 실패',
        description: '학생 상태를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      });
    } finally {
      setAttendanceActionSaving(false);
    }
  };

  const handleInlineCounselingSave = async () => {
    if (!firestore || !centerId || !selectedStudentPreview || !currentUser) return;
    if (!counselingContent.trim()) {
      toast({
        variant: 'destructive',
        title: '상담 내용이 비어 있습니다.',
        description: '핵심 상담 내용을 먼저 적어 주세요.',
      });
      return;
    }

    setCounselingActionSaving(true);
    try {
      await addDoc(collection(firestore, 'centers', centerId, 'counselingLogs'), {
        studentId: selectedStudentPreview.member.id,
        studentName: selectedStudentPreview.member.displayName || '학생',
        teacherId: currentUser.uid,
        teacherName: currentUser.displayName || activeMembership?.displayName || '담당 선생님',
        type: counselingType,
        content: counselingContent.trim(),
        improvement: counselingImprovement.trim(),
        readAt: null,
        createdAt: serverTimestamp(),
      });
      setCounselingContent('');
      setCounselingImprovement('');
      toast({
        title: '상담 기록을 저장했습니다.',
        description: `${selectedStudentPreview.member.displayName} 학생 상담 일지가 추가되었습니다.`,
      });
    } catch (error) {
      console.error('[student-index] inline counseling save failed', error);
      toast({
        variant: 'destructive',
        title: '상담 저장 실패',
        description: '상담 기록을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      });
    } finally {
      setCounselingActionSaving(false);
    }
  };

  const handleInlineManualSms = async () => {
    if (!functions || !centerId || !selectedStudentPreview) return;
    const message = manualSmsMessage.trim();
    if (!message) {
      toast({
        variant: 'destructive',
        title: '문자 내용이 비어 있습니다.',
        description: '보낼 문구를 먼저 입력해 주세요.',
      });
      return;
    }

    setManualSmsSending(true);
    try {
      const sendManualStudentSms = httpsCallable(functions, 'sendManualStudentSms');
      await sendManualStudentSms({
        centerId,
        studentId: selectedStudentPreview.member.id,
        message,
      });
      setManualSmsMessage('');
      toast({
        title: '문자 발송을 요청했습니다.',
        description: `${selectedStudentPreview.member.displayName} 학생 수신 대상에게 문자 발송을 접수했습니다.`,
      });
    } catch (error) {
      console.error('[student-index] inline sms send failed', error);
      toast({
        variant: 'destructive',
        title: '문자 발송 실패',
        description: '수신 대상이나 발송 상태를 다시 확인해 주세요.',
      });
    } finally {
      setManualSmsSending(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'studying': return <Badge className="bg-emerald-500 font-black text-[9px] h-5">공부중</Badge>;
      case 'away': return <Badge variant="outline" className="text-amber-500 border-amber-500 font-black text-[9px] h-5">외출중</Badge>;
      case 'break': return <Badge variant="secondary" className="font-black text-[9px] h-5 bg-[#fff4e8] text-[#d86a11]">휴식중</Badge>;
      default: return <Badge variant="outline" className="font-black text-[9px] h-5 border-[#dbe7ff] text-[#14295F]">미입실</Badge>;
    }
  };

  if (membershipsLoading && !activeMembership) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-[#2554D4]/30" />
      </div>
    );
  }

  if (!isTeacherOrAdmin) {
    return <div className="flex items-center justify-center h-[60vh]"><p className="font-black text-[#14295F]">권한이 없습니다.</p></div>;
  }

  return (
    <div className={cn("flex flex-col", isMobile ? "gap-4 pb-20" : "gap-8")}>
      <header className="grid gap-4">
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <div className={cn(
            "overflow-hidden rounded-[2.4rem] border-none shadow-[0_36px_80px_-56px_rgba(20,41,95,0.7)]",
            isMobile ? "p-0" : "p-0"
          )}>
            <div className={cn(
              "relative overflow-hidden bg-[linear-gradient(135deg,#14295F_0%,#173D8B_52%,#2554D4_100%)] text-white",
              isMobile ? "px-5 py-5" : "px-7 py-7"
            )}>
              <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
              <div className="pointer-events-none absolute bottom-0 left-0 h-28 w-28 rounded-full bg-[#FF7A16]/18 blur-2xl" />
              <div className={cn("relative z-10 grid gap-5", isMobile ? "grid-cols-1" : "grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] items-start")}>
                <div className="space-y-4">
                  <Badge className="border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                    Teacher Workbench
                  </Badge>
                  <div className="space-y-2">
                    <h1 className={cn("font-aggro-display font-black tracking-[-0.05em] text-white", isMobile ? "text-[1.9rem] leading-[1.02]" : "text-[clamp(2.45rem,4vw,3.65rem)] leading-[0.98]")}>
                      학생 운영 워크벤치
                    </h1>
                    <p className={cn("max-w-2xl font-semibold text-white/80", isMobile ? "text-[12px] leading-5" : "text-sm leading-6")}>
                      빠르게 스캔하고, 바로 처리하고, 필요할 때 학생 360으로 자연스럽게 이어지는 선생님용 학생 운영 허브입니다.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-black text-white">
                      재원생 {counts.active}명
                    </Badge>
                    <Badge className="border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-black text-white/80">
                      좌석 연동 {operationalSummary.assignedSeatCount}명
                    </Badge>
                    <Badge className="border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-black text-white/80">
                      공부중 {operationalSummary.studyingCount}명
                    </Badge>
                  </div>
                </div>

                <div className={cn("grid gap-3", isMobile ? "grid-cols-1" : "grid-cols-1")}>
                  <div className="rounded-[1.7rem] border border-white/12 bg-white/10 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">오늘 운영 포인트</p>
                    <p className="mt-2 text-base font-black leading-6 text-white">
                      실시간 상태 필터와 빠른 실행 시트를 묶어서, 학생별 출결·상담·문자 흐름을 한 번에 정리합니다.
                    </p>
                    <p className="mt-2 text-xs font-semibold text-white/70">
                      검색과 반 필터를 함께 쓰면 학생 360 진입 전 운영 범위를 더 빠르게 좁힐 수 있습니다.
                    </p>
                  </div>
                  {canManageStudentAccounts ? (
                    <DialogTrigger asChild>
                      <Button className={cn("rounded-[1.2rem] bg-white font-black text-[#14295F] hover:bg-[#f4f7ff]", isMobile ? "h-12 w-full" : "h-12 w-full")}>
                        <UserPlus className="mr-2 h-4 w-4" />
                        학생 계정 바로 생성
                      </Button>
                    </DialogTrigger>
                  ) : (
                    <div className="rounded-[1.2rem] border border-white/12 bg-white/8 px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">권한 안내</p>
                      <p className="mt-1 text-sm font-black text-white">학생 생성 권한은 센터관리자 전용입니다.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogContent motionPreset="dashboard-premium" className={cn("rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden", isMobile ? "fixed left-1/2 top-1/2 h-[84vh] w-[92vw] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-[2rem]" : "sm:max-w-2xl")}>
            <div className="bg-[linear-gradient(135deg,#14295F_0%,#173D8B_58%,#2554D4_100%)] px-7 py-6 text-white">
              <DialogHeader>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge className="border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-black text-white">
                    학생 등록
                  </Badge>
                  <Badge className="border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-black text-white/80">
                    운영 워크벤치
                  </Badge>
                </div>
                <DialogTitle className="text-3xl font-black tracking-tight">센터 학생 계정 생성</DialogTitle>
                <DialogDescription className="font-semibold text-white/80">
                  기본 계정 정보와 학교/학년 정보만 입력하면 학생 운영 워크벤치에 바로 연결됩니다.
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="max-h-[56vh] space-y-4 overflow-y-auto bg-white px-6 py-5 custom-scrollbar">
              <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "md:grid-cols-2")}>
                <div className="rounded-[1.5rem] border border-[#dbe7ff] bg-white p-4 shadow-[0_24px_56px_-44px_rgba(20,41,95,0.24)]">
                  <div className="mb-4">
                    <p className="text-sm font-black tracking-tight text-[#14295F]">기본 계정 정보</p>
                    <p className="text-[11px] font-semibold text-[#5c6e97]">학생이 로그인할 계정 정보를 먼저 입력합니다.</p>
                  </div>
                  <div className="space-y-3">
                    <div className="grid gap-1.5">
                      <Label className="text-[10px] font-black uppercase text-[#5c6e97]">이름</Label>
                      <Input placeholder="홍길동" value={newStudent.name} onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })} className="h-12 rounded-xl border-2 border-[#dbe7ff] font-bold text-[#14295F]" />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-[10px] font-black uppercase text-[#5c6e97]">이메일 (아이디)</Label>
                      <Input type="email" placeholder="이메일을 입력하세요" value={newStudent.email} onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })} className="h-12 rounded-xl border-2 border-[#dbe7ff] font-bold text-[#14295F]" />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-[10px] font-black uppercase text-[#5c6e97]">비밀번호 (8자 이상)</Label>
                      <Input type="password" placeholder="••••••••" value={newStudent.password} onChange={(e) => setNewStudent({ ...newStudent, password: e.target.value })} className="h-12 rounded-xl border-2 border-[#dbe7ff] font-bold text-[#14295F]" />
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-[#dbe7ff] bg-white p-4 shadow-[0_24px_56px_-44px_rgba(20,41,95,0.24)]">
                  <div className="mb-4">
                    <p className="text-sm font-black tracking-tight text-[#14295F]">학교 / 학년</p>
                    <p className="text-[11px] font-semibold text-[#5c6e97]">운영 카드와 학생 360에서 함께 쓰일 기본 학적 정보입니다.</p>
                  </div>
                  <div className="space-y-3">
                    <div className="grid gap-1.5">
                      <Label className="text-[10px] font-black uppercase text-[#5c6e97]">소속 학교</Label>
                      <Input placeholder="예: 동백고등학교" value={newStudent.schoolName} onChange={(e) => setNewStudent({ ...newStudent, schoolName: e.target.value })} className="h-12 rounded-xl border-2 border-[#dbe7ff] font-bold text-[#14295F]" />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-[10px] font-black uppercase text-[#5c6e97]">학년</Label>
                      <Select value={newStudent.grade} onValueChange={(val) => setNewStudent({ ...newStudent, grade: val })}>
                        <SelectTrigger className="h-12 rounded-xl border-2 border-[#dbe7ff] font-bold text-[#14295F]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1학년">1학년</SelectItem>
                          <SelectItem value="2학년">2학년</SelectItem>
                          <SelectItem value="3학년">3학년</SelectItem>
                          <SelectItem value="N수생">N수생</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="border-t border-[#dbe7ff] bg-[#f8fbff] p-6">
              <Button onClick={handleAddStudent} disabled={isSubmitting} className="h-12 w-full rounded-xl bg-[#14295F] font-black text-white shadow-xl hover:bg-[#173D8B]">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                학생 계정 생성 완료
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <section className={cn('grid gap-4', isMobile ? 'grid-cols-2' : 'md:grid-cols-3 xl:grid-cols-6')}>
        {[
          { label: '관리 규모', value: `${operationalSummary.activeStudents}명`, sub: '현재 관리 대상', tone: 'text-[#14295F] bg-[#eef4ff]' },
          { label: '공부중', value: `${operationalSummary.studyingCount}명`, sub: '실시간 좌석 기준', tone: 'text-emerald-700 bg-emerald-50' },
          { label: '외출', value: `${operationalSummary.awayCount}명`, sub: '복귀 확인 필요', tone: 'text-amber-700 bg-amber-50' },
          { label: '미입실', value: `${operationalSummary.absentCount}명`, sub: '도착 전 / 퇴실 포함', tone: 'text-rose-700 bg-rose-50' },
          { label: '좌석 연동', value: `${operationalSummary.assignedSeatCount}명`, sub: '도면 연동 가능', tone: 'text-sky-700 bg-sky-50' },
          { label: '리스크 분석', value: canOpenFinance ? '이동' : '-', sub: canOpenFinance ? '비즈니스 분석에서 확인' : '센터관리자 권한 필요', tone: 'text-violet-700 bg-violet-50' },
        ].map((item) => (
          <Card key={item.label} className="rounded-[1.75rem] border border-[#dbe7ff] bg-white shadow-[0_22px_52px_-46px_rgba(20,41,95,0.32)]">
            <CardContent className="p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5c6e97]">{item.label}</p>
              <p className="mt-2 text-2xl font-black tracking-tight text-[#14295F]">{item.value}</p>
              <div className={cn('mt-3 inline-flex rounded-full px-2.5 py-1 text-[10px] font-black', item.tone)}>
                {item.sub}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <AdminWorkbenchCommandBar
        variant="teacherWorkbench"
        eyebrow="학생/상담 워크벤치"
        title="학생 운영 워크벤치"
        description="같은 필터와 같은 빠른 실행으로 학생 관리, 상담, 문자, 출결 흐름을 빠르게 묶고 바로 학생 360으로 이어집니다."
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="이름, 학교 또는 좌석 번호 검색"
        selectValue={classFilter}
        onSelectChange={setClassFilter}
        selectOptions={[
          { value: 'all', label: '반 전체' },
          ...availableClasses.map((className) => ({ value: className, label: className })),
        ]}
        selectLabel="반 필터"
        quickActions={[
          ...(canManageStudentAccounts ? [{ label: '신규 가입', icon: <UserPlus className="h-4 w-4" />, onClick: () => setIsAddModalOpen(true) }] : []),
          { label: '리드상담', icon: <Megaphone className="h-4 w-4" />, href: '/dashboard/leads' },
          ...(canOpenFinance ? [{ label: '수익분석', icon: <TrendingUp className="h-4 w-4" />, href: '/dashboard/revenue' }] : []),
          ...(canOpenSettings
            ? [{ label: '문자 보내기', icon: <ChevronRight className="h-4 w-4" />, href: '/dashboard/settings/notifications' }]
            : [{ label: '상담/소통', icon: <ChevronRight className="h-4 w-4" />, href: '/dashboard/appointments' }]),
          { label: '출결 이동', icon: <UserCheck className="h-4 w-4" />, href: '/dashboard/attendance' },
        ]}
      >
        <div className="grid gap-1">
          <Label className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5c6e97]">실시간 상태</Label>
          <Select value={liveStatusFilter} onValueChange={setLiveStatusFilter}>
            <SelectTrigger className="h-11 min-w-[180px] rounded-xl border-2 border-[#dbe7ff] bg-white font-black text-[#14295F]">
              <SelectValue placeholder="실시간 상태 전체" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="all" className="font-black">실시간 상태 전체</SelectItem>
              <SelectItem value="studying" className="font-black">공부중</SelectItem>
              <SelectItem value="away" className="font-black">외출/휴식</SelectItem>
              <SelectItem value="absent" className="font-black">미입실/퇴실</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </AdminWorkbenchCommandBar>

      <Tabs defaultValue="active" className="w-full" onValueChange={setStatusTab}>
        <TabsList className={cn("grid grid-cols-3 rounded-[1.7rem] border border-[#dbe7ff] bg-[#f8fbff] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.96)]", isMobile ? "h-14 mb-4" : "h-16 mb-8 max-w-2xl")}>
          <TabsTrigger value="active" className="rounded-[1.1rem] font-black text-[#5c6e97] data-[state=active]:bg-[#14295F] data-[state=active]:text-white data-[state=active]:shadow-[0_18px_40px_-30px_rgba(20,41,95,0.6)] gap-2 transition-all"><UserCheck className="h-4 w-4" /><span className="hidden sm:inline">재원생</span><Badge variant="secondary" className="ml-1 h-5 rounded-md bg-emerald-50 px-1.5 text-[10px] font-black text-emerald-600">{counts.active}</Badge></TabsTrigger>
          <TabsTrigger value="onHold" className="rounded-[1.1rem] font-black text-[#5c6e97] data-[state=active]:bg-[#14295F] data-[state=active]:text-white data-[state=active]:shadow-[0_18px_40px_-30px_rgba(20,41,95,0.6)] gap-2 transition-all"><PauseCircle className="h-4 w-4" /><span className="hidden sm:inline">휴학생</span><Badge variant="secondary" className="ml-1 h-5 rounded-md bg-amber-50 px-1.5 text-[10px] font-black text-amber-600">{counts.onHold}</Badge></TabsTrigger>
          <TabsTrigger value="withdrawn" className="rounded-[1.1rem] font-black text-[#5c6e97] data-[state=active]:bg-[#14295F] data-[state=active]:text-white data-[state=active]:shadow-[0_18px_40px_-30px_rgba(20,41,95,0.6)] gap-2 transition-all"><UserMinus className="h-4 w-4" /><span className="hidden sm:inline">퇴원생</span><Badge variant="secondary" className="ml-1 h-5 rounded-md bg-[#eef4ff] px-1.5 text-[10px] font-black text-[#14295F]">{counts.withdrawn}</Badge></TabsTrigger>
        </TabsList>

        {membersLoading ? (<div className="flex flex-col items-center justify-center rounded-[2.4rem] border border-[#dbe7ff] bg-white py-28 shadow-[0_24px_56px_-44px_rgba(20,41,95,0.24)]"><Loader2 className="h-12 w-12 animate-spin text-[#2554d4]/40" /><p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-[#9aa9c7]">학생 운영 데이터를 불러오는 중입니다.</p></div>) : filteredStudents.length === 0 ? (
          <div className="rounded-[2.6rem] border-2 border-dashed border-[#dbe7ff] bg-white px-6 py-24 text-center shadow-[0_24px_56px_-44px_rgba(20,41,95,0.16)]"><Users className="mx-auto mb-4 h-16 w-16 text-[#d4dff7]" /><p className="font-black uppercase tracking-[0.18em] text-[#9aa9c7]">조건에 맞는 학생이 없습니다.</p><p className="mt-2 text-sm font-semibold text-[#5c6e97]">검색어, 반, 실시간 상태를 다시 조합해 보세요.</p></div>
        ) : (
          <div className={cn("grid gap-4", isMobile ? "grid-cols-1 px-1" : "xl:grid-cols-2")}>
            {filteredStudents.map((member) => {
              const profile = studentsProfiles?.find(p => p.id === member.id);
              const attendance = attendanceList?.find(a => a.studentId === member.id);
              const seatLabel = formatSeatLabel(profile);
              const attendanceLabel = attendance?.status === 'studying'
                ? '공부중'
                : attendance?.status === 'away' || attendance?.status === 'break'
                  ? '외출'
                : attendance?.status === 'absent'
                  ? '미입실'
                  : '확인중';
              const attendanceBarClass =
                attendance?.status === 'studying'
                  ? 'bg-emerald-500'
                  : attendance?.status === 'away' || attendance?.status === 'break'
                    ? 'bg-amber-500'
                    : 'bg-[#9aa9c7]';
              return (
                <Card key={member.id} className={cn("group overflow-hidden rounded-[2rem] border border-[#dbe7ff] bg-white shadow-[0_24px_56px_-44px_rgba(20,41,95,0.28)] transition-all hover:-translate-y-0.5 hover:shadow-[0_30px_70px_-44px_rgba(20,41,95,0.36)]", member.status === 'withdrawn' && "bg-[#fbfcff]")}>
                  <div className={cn("h-1.5 w-full", attendanceBarClass)} />
                  <CardContent className={isMobile ? "p-5" : "p-6"}>
                    <button
                      type="button"
                      onClick={() => setSelectedStudentId(member.id)}
                      className="block w-full text-left rounded-[1.5rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-start gap-4">
                          <Avatar className="h-14 w-14 border-4 border-white shadow-xl ring-1 ring-[#dbe7ff]"><AvatarFallback className="bg-[#eef4ff] text-[#14295F] font-black text-xl">{member.displayName?.charAt(0) || 'S'}</AvatarFallback></Avatar>
                          <div className="flex flex-col min-w-0 gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-lg font-black tracking-tighter text-[#14295F]">{member.displayName}</h3>
                              {member.className ? (
                                <Badge className="h-5 rounded-full border border-[#dbe7ff] bg-[#f8fbff] px-2 text-[10px] font-black text-[#14295F]">{member.className}</Badge>
                              ) : null}
                              {member.status === 'active' && getStatusBadge(attendance?.status)}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge className="h-6 rounded-full border-none bg-[#eef4ff] px-2.5 text-[10px] font-black text-[#244b90]">
                                {profile?.schoolName || '학교 정보 없음'}
                              </Badge>
                              <Badge className="h-6 rounded-full border border-[#dbe7ff] bg-[#f8fbff] px-2.5 text-[10px] font-black text-[#14295F]">
                                {profile?.grade || '학년 정보 없음'}
                              </Badge>
                              <Badge className="h-6 rounded-full border border-[#dbe7ff] bg-white px-2.5 text-[10px] font-black text-[#5c6e97]">
                                {seatLabel}
                              </Badge>
                            </div>
                            <div className="grid gap-2 text-[11px] font-bold text-[#5c6e97] sm:grid-cols-3">
                              <div className="rounded-xl border border-[#dbe7ff] bg-[#f8fbff] px-3 py-2">
                                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#9aa9c7]">현재 상태</p>
                                <p className="mt-1 text-sm font-black text-[#14295F]">{attendanceLabel}</p>
                              </div>
                              <div className="rounded-xl border border-[#dbe7ff] bg-[#f8fbff] px-3 py-2">
                                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#9aa9c7]">계정 상태</p>
                                <p className="mt-1 text-sm font-black text-[#14295F]">
                                  {member.status === 'active' ? '재원중' : member.status === 'onHold' ? '휴원' : '퇴원'}
                                </p>
                              </div>
                              <div className="rounded-xl border border-[#dbe7ff] bg-[#f8fbff] px-3 py-2">
                                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#9aa9c7]">운영 이동</p>
                                <p className="mt-1 text-sm font-black text-[#14295F]">운영 그래프 확인하기</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-[#9aa9c7] opacity-40 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                      </div>
                    </button>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button type="button" variant="outline" className="h-10 rounded-xl border-[#dbe7ff] bg-white px-4 text-xs font-black text-[#14295F] hover:bg-[#f4f7ff]" onClick={() => setSelectedStudentId(member.id)}>
                        즉시 처리
                      </Button>
                      <Button type="button" className="h-10 rounded-xl bg-[#14295F] px-4 text-xs font-black text-white hover:bg-[#173D8B]" onClick={() => handleOpenStudent360(member.id)}>
                        학생 360 열기
                      </Button>
                    </div>

                    {statusTab === 'withdrawn' && canManageStudentAccounts && (
                      <div className="mt-4 pt-4 border-t border-dashed border-rose-100">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" disabled={isDeleting === member.id} className="w-full h-11 rounded-xl font-black text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 gap-2 transition-all">
                              {isDeleting === member.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} 강제 삭제 실행
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="max-w-[400px] rounded-[2.5rem] border-none bg-white p-0 shadow-2xl overflow-hidden">
                            <div className="bg-[linear-gradient(135deg,#14295F_0%,#1F4CB1_58%,#FF8B2B_100%)] px-8 py-7 text-white">
                              <AlertDialogHeader>
                                <div className="mb-4 flex flex-wrap items-center gap-2">
                                  <Badge className="border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-black text-white">
                                    위험 작업
                                  </Badge>
                                  <Badge className="border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-black text-white/80">
                                    퇴원생 데이터 삭제
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="rounded-[1.3rem] bg-white/12 p-3"><AlertTriangle className="h-8 w-8 text-white" /></div>
                                  <div className="space-y-1">
                                    <AlertDialogTitle className="text-2xl font-black tracking-tighter leading-tight text-white">데이터 강제 삭제</AlertDialogTitle>
                                    <AlertDialogDescription className="font-bold leading-relaxed text-sm text-white/80">
                                      삭제 뒤에는 복구가 불가능하니, 퇴원 처리와 계정 상태를 먼저 다시 확인해 주세요.
                                    </AlertDialogDescription>
                                  </div>
                                </div>
                              </AlertDialogHeader>
                            </div>
                            <div className="space-y-4 bg-white px-8 py-6">
                              <div className="rounded-[1.6rem] border border-[#D7E4FF] bg-[#F8FBFF] px-5 py-4">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5c6e97]">삭제 대상</p>
                                <p className="mt-2 text-lg font-black text-[#14295F]">{member.displayName || '학생'}</p>
                                <p className="mt-2 text-sm font-semibold leading-6 text-[#5c6e97]">
                                  계정과 함께 <span className="font-black text-[#14295F]">학습 로그, 계획, 출결, 리포트, 상담 기록</span> 등 연결된 하위 데이터가 모두 삭제됩니다.
                                </p>
                              </div>
                              <div className="rounded-[1.4rem] border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold leading-6 text-[#14295F]">
                                <span className="font-black text-rose-600">주의:</span> 이 작업은 되돌릴 수 없고, 같은 학생 코드로도 이전 데이터를 복원하지 않습니다.
                              </div>
                            </div>
                            <AlertDialogFooter className="border-t border-[#D7E4FF] bg-[#F8FBFF] px-8 py-6">
                              <div className="flex w-full flex-col gap-2">
                                <AlertDialogAction onClick={() => handleDeleteAccount(member.id, member.displayName || '학생')} className="h-14 rounded-2xl font-black bg-rose-600 text-white hover:bg-rose-700 shadow-xl active:scale-95 transition-all">{isDeleting === member.id ? <Loader2 className="animate-spin h-5 w-5" /> : '강제 삭제 승인'}</AlertDialogAction>
                                <AlertDialogCancel className="h-14 rounded-2xl border-2 border-[#D7E4FF] bg-white font-black text-[#14295F] hover:bg-[#F1F6FF]">취소</AlertDialogCancel>
                              </div>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </Tabs>

      <Sheet open={!!selectedStudentPreview} onOpenChange={(open) => !open && setSelectedStudentId(null)}>
        <SheetContent
          side="right"
          motionPreset="dashboard-premium"
          className="w-[96vw] max-w-2xl overflow-y-auto border-none bg-[#f8fbff] px-0 py-0 sm:max-w-2xl"
        >
          {selectedStudentPreview ? (
            <>
              <div className="bg-[linear-gradient(135deg,#14295F_0%,#173D8B_58%,#2554D4_100%)] px-6 py-6 text-white">
                <SheetHeader className="space-y-2 text-left">
                  <div className="flex flex-wrap gap-2">
                    <Badge className="border border-white/14 bg-white/8 text-white font-black">
                      학생 브리프
                    </Badge>
                    {selectedStudentPreview.member.className ? (
                      <Badge className="border border-white/14 bg-white/8 text-white/80 font-black">
                        {selectedStudentPreview.member.className}
                      </Badge>
                    ) : null}
                    <Badge className="border border-white/14 bg-white/8 text-white/80 font-black">
                      {selectedStudentPreview.seatLabel}
                    </Badge>
                  </div>
                  <SheetTitle className="text-2xl font-black tracking-tight text-white">
                    {selectedStudentPreview.member.displayName}
                  </SheetTitle>
                  <SheetDescription className="text-sm font-bold text-white/80">
                    학생 360으로 들어가기 전에 현재 상태와 바로 처리할 운영 액션을 한 번에 확인합니다.
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[1.2rem] border border-white/14 bg-white/8 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">현재 상태</p>
                    <p className="mt-2 text-base font-black text-white">{selectedStudentPreview.attendanceLabel}</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/14 bg-white/8 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">학교 / 학년</p>
                    <p className="mt-2 text-base font-black text-white">{selectedStudentPreview.profile?.schoolName || '학교 미등록'}</p>
                    <p className="mt-1 text-xs font-semibold text-white/80">{selectedStudentPreview.profile?.grade || '학년 미등록'}</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/14 bg-white/8 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">계정 상태</p>
                    <p className="mt-2 text-base font-black text-white">
                      {selectedStudentPreview.member.status === 'active'
                        ? '재원중'
                        : selectedStudentPreview.member.status === 'onHold'
                          ? '휴원'
                          : '퇴원'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-5 p-6">
                <div className="rounded-[1.9rem] border border-[#dbe7ff] bg-white p-5 shadow-[0_24px_56px_-44px_rgba(20,41,95,0.24)]">
                  <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]')}>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5c6e97]">바로 할 일</p>
                      <p className="mt-2 text-sm font-black text-[#14295F]">즉시 처리할 액션을 고른 뒤 바로 저장할 수 있습니다.</p>
                    </div>
                    <Button asChild className="h-11 rounded-xl bg-[#14295F] font-black text-white hover:bg-[#173D8B]">
                      <Link href={`/dashboard/teacher/students/${selectedStudentPreview.member.id}`}>학생 360 열기</Link>
                    </Button>
                  </div>
                  <div className={cn('mt-4 grid gap-2', isMobile ? 'grid-cols-1' : 'grid-cols-3')}>
                    <Button type="button" variant={activeQuickAction === 'attendance' ? 'default' : 'outline'} className={cn('h-11 rounded-xl font-black', activeQuickAction === 'attendance' ? 'bg-[#14295F] text-white hover:bg-[#173D8B]' : 'border-[#dbe7ff] bg-white text-[#14295F] hover:bg-[#f4f7ff]')} onClick={() => setActiveQuickAction('attendance')}>
                      출결 처리
                    </Button>
                    <Button type="button" variant={activeQuickAction === 'counseling' ? 'default' : 'outline'} className={cn('h-11 rounded-xl font-black', activeQuickAction === 'counseling' ? 'bg-[#14295F] text-white hover:bg-[#173D8B]' : 'border-[#dbe7ff] bg-white text-[#14295F] hover:bg-[#f4f7ff]')} onClick={() => setActiveQuickAction('counseling')}>
                      상담 기록
                    </Button>
                    <Button type="button" variant={activeQuickAction === 'sms' ? 'default' : 'outline'} className={cn('h-11 rounded-xl font-black', activeQuickAction === 'sms' ? 'bg-[#14295F] text-white hover:bg-[#173D8B]' : 'border-[#dbe7ff] bg-white text-[#14295F] hover:bg-[#f4f7ff]')} onClick={() => setActiveQuickAction('sms')}>
                      문자 보내기
                    </Button>
                  </div>
                </div>

                <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)]')}>
                    <div className="rounded-[1.6rem] border border-[#dbe7ff] bg-white p-4 shadow-[0_22px_48px_-38px_rgba(20,41,95,0.2)]">
                      {activeQuickAction === 'attendance' ? (
                        <div className="space-y-4">
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#5c6e97]">출결 처리</p>
                            <p className="mt-1 text-sm font-bold text-[#5c6e97]">
                              페이지 이동 없이 현재 상태를 바로 바꾸고, 필요한 경우 자동 문자도 함께 접수합니다.
                            </p>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-3">
                            <Button
                              type="button"
                              className="h-11 rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-700"
                              disabled={attendanceActionSaving}
                              onClick={() => handleInlineAttendanceAction('studying')}
                            >
                              {attendanceActionSaving && activeQuickAction === 'attendance' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                              공부중
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-11 rounded-xl border-amber-200 bg-amber-50 font-black text-amber-700 hover:bg-amber-100"
                              disabled={attendanceActionSaving}
                              onClick={() => handleInlineAttendanceAction('away')}
                            >
                              외출 처리
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-11 rounded-xl border-[#dbe7ff] bg-white font-black text-[#14295F] hover:bg-[#f4f7ff]"
                              disabled={attendanceActionSaving}
                              onClick={() => handleInlineAttendanceAction('absent')}
                            >
                              미입실 / 종료
                            </Button>
                          </div>
                          <div className="rounded-[1.1rem] border border-dashed border-[#d6e2ff] bg-[#f7fbff] px-4 py-3">
                            <p className="text-xs font-black text-[#14295F]">현재 상태</p>
                            <p className="mt-1 text-sm font-bold text-[#5c6e97]">
                              {selectedStudentPreview.attendanceLabel} · {selectedStudentPreview.seatLabel}
                            </p>
                          </div>
                        </div>
                      ) : null}

                      {activeQuickAction === 'counseling' ? (
                        <div className="space-y-4">
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#5c6e97]">상담 기록</p>
                            <p className="mt-1 text-sm font-bold text-[#5c6e97]">
                              지금 바로 핵심 상담 메모를 남기고 학생 360 상담 트랙과 같은 데이터로 이어집니다.
                            </p>
                          </div>
                          <div className="grid gap-4">
                            <div className="space-y-2">
                              <Label className="text-xs font-black text-[#14295F]">상담 유형</Label>
                              <Select value={counselingType} onValueChange={(value: 'academic' | 'life' | 'career') => setCounselingType(value)}>
                                <SelectTrigger className="h-11 rounded-xl border-[#d6e2ff] bg-white font-bold text-[#14295F]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="academic">학습 상담</SelectItem>
                                  <SelectItem value="life">생활 상담</SelectItem>
                                  <SelectItem value="career">진로 상담</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-black text-[#14295F]">상담 내용</Label>
                              <Textarea
                                value={counselingContent}
                                onChange={(event) => setCounselingContent(event.target.value)}
                                placeholder="오늘 확인한 핵심 이슈나 학생 반응을 적어 주세요."
                                className="min-h-[108px] border-[#dbe7ff] bg-white font-bold text-[#14295F] placeholder:text-[#9aa9c7]"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-black text-[#14295F]">다음 개선 포인트</Label>
                              <Textarea
                                value={counselingImprovement}
                                onChange={(event) => setCounselingImprovement(event.target.value)}
                                placeholder="다음 상담이나 수업에서 바로 이어갈 조치가 있으면 적어 주세요."
                                className="min-h-[96px] border-[#dbe7ff] bg-white font-bold text-[#14295F] placeholder:text-[#9aa9c7]"
                              />
                            </div>
                            <Button
                              type="button"
                              className="h-11 rounded-xl bg-[#14295F] font-black text-white hover:bg-[#173D8B]"
                              disabled={counselingActionSaving}
                              onClick={handleInlineCounselingSave}
                            >
                              {counselingActionSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                              상담 일지 저장
                            </Button>
                          </div>
                        </div>
                      ) : null}

                      {activeQuickAction === 'sms' ? (
                        <div className="space-y-4">
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#5c6e97]">문자 보내기</p>
                            <p className="mt-1 text-sm font-bold text-[#5c6e97]">
                              보호자 번호가 있으면 보호자에게, 없으면 학생 본인 fallback 번호로 접수됩니다.
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-black text-[#14295F]">직접 보낼 문구</Label>
                            <Textarea
                              value={manualSmsMessage}
                              onChange={(event) => setManualSmsMessage(event.target.value)}
                              placeholder={`${selectedStudentPreview.member.displayName} 학생 관련 안내 문구를 입력해 주세요.`}
                              className="min-h-[136px] border-[#dbe7ff] bg-white font-bold text-[#14295F] placeholder:text-[#9aa9c7]"
                            />
                            <p className="text-[11px] font-bold text-[#7b8db3]">
                              학생 상세 문자 콘솔로 이동하지 않고 여기서 바로 문자 발송을 접수합니다.
                            </p>
                          </div>
                          <Button
                            type="button"
                            className="h-11 rounded-xl bg-[#14295F] font-black text-white hover:bg-[#173D8B]"
                            disabled={manualSmsSending}
                            onClick={handleInlineManualSms}
                          >
                            {manualSmsSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            문자 발송 접수
                          </Button>
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-[1.55rem] border border-[#dbe6ff] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(246,249,255,0.98)_100%)] p-4 shadow-[0_22px_36px_-30px_rgba(20,41,95,0.32)]">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5c6e97]">운영 요약</p>
                      <div className="mt-3 space-y-3">
                        <div className="rounded-[1rem] bg-white/90 px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.96)]">
                          <p className="text-[11px] font-black text-[#7b8db3]">학생</p>
                          <p className="mt-1 text-base font-black tracking-tight text-[#14295F]">
                            {selectedStudentPreview.member.displayName}
                          </p>
                          <p className="mt-1 text-xs font-bold text-[#5c6e97]">
                            {selectedStudentPreview.profile?.schoolName || '학교 미등록'} · {selectedStudentPreview.profile?.grade || '학년 미등록'}
                          </p>
                        </div>
                        <div className="rounded-[1rem] bg-white/90 px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.96)]">
                          <p className="text-[11px] font-black text-[#7b8db3]">현재 상태</p>
                          <p className="mt-1 text-sm font-black text-[#14295F]">
                            {selectedStudentPreview.attendanceLabel}
                          </p>
                          <p className="mt-1 text-xs font-bold text-[#5c6e97]">{selectedStudentPreview.seatLabel}</p>
                        </div>
                        <div className="rounded-[1rem] bg-[#14295F] px-3.5 py-3 text-white shadow-[0_16px_28px_-22px_rgba(20,41,95,0.75)]">
                          <p className="text-[11px] font-black text-white/60">바로 처리 포인트</p>
                          <ul className="mt-2 space-y-2 text-xs font-bold text-white/90">
                            {activeQuickAction === 'attendance' ? (
                              <>
                                <li>현재 상태를 바꾸면 출결 기록과 자동 문자가 함께 이어집니다.</li>
                                <li>공부중에서 종료로 바꾸면 오늘 세션 시간도 함께 정리됩니다.</li>
                              </>
                            ) : null}
                            {activeQuickAction === 'counseling' ? (
                              <>
                                <li>짧게라도 남겨두면 학생 360 상담 기록에 즉시 연결됩니다.</li>
                                <li>개선 포인트를 적어두면 다음 상담 액션이 더 분명해집니다.</li>
                              </>
                            ) : null}
                            {activeQuickAction === 'sms' ? (
                              <>
                                <li>직접 문자를 보내도 수신 우선순위는 보호자 → 학생 fallback으로 유지됩니다.</li>
                                <li>실제 수신은 통신사와 단말 정책에 따라 다를 수 있습니다.</li>
                              </>
                            ) : null}
                          </ul>
                        </div>
                        </div>
                      </div>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
