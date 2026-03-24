'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { useCollection, useFirestore } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { format, parse } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Search,
  Loader2,
  Pencil,
  Trash2,
  AlertCircle,
  Clock,
  Zap,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { CenterMembership, StudentProfile } from '@/lib/types';

type SessionDoc = {
  id: string;
  startTime: Timestamp;
  endTime: Timestamp;
  durationMinutes: number;
  closedReason?: string;
  autoClosedAt?: Timestamp;
  validationFlag?: string;
};

function toHm(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

function tsToLabel(ts: Timestamp | undefined): string {
  if (!ts?.toDate) return '-';
  return format(ts.toDate(), 'HH:mm', { locale: ko });
}

export default function SessionCorrectionPage() {
  const firestore = useFirestore();
  const { activeMembership, memberships } = useAppContext();
  const { toast } = useToast();

  const centerId = useMemoFirebase(
    () =>
      memberships.find((m) => m.id === activeMembership?.id)?.id ??
      memberships.find((m) => m.status === 'active')?.id ??
      null,
    [memberships, activeMembership]
  );

  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [dateKey, setDateKey] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [sessions, setSessions] = useState<SessionDoc[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [editTarget, setEditTarget] = useState<SessionDoc | null>(null);
  const [editMinutes, setEditMinutes] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SessionDoc | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 학생 목록
  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'members'),
      where('role', '==', 'student'),
      where('status', '==', 'active')
    );
  }, [firestore, centerId]);
  const { data: studentMembers } = useCollection<CenterMembership>(studentsQuery);

  const [studentProfiles, setStudentProfiles] = useState<StudentProfile[]>([]);
  useEffect(() => {
    if (!firestore || !centerId || !studentMembers?.length) return;
    void (async () => {
      const profiles = await Promise.all(
        studentMembers.map(async (m) => {
          const snap = await getDoc(doc(firestore, 'centers', centerId, 'students', m.id));
          if (!snap.exists()) return null;
          return { id: snap.id, ...(snap.data() as Omit<StudentProfile, 'id'>) };
        })
      );
      setStudentProfiles(profiles.filter(Boolean) as StudentProfile[]);
    })();
  }, [firestore, centerId, studentMembers]);

  const filtered = studentProfiles.filter((s) =>
    !search || s.name.includes(search) || s.grade?.includes(search)
  );

  const loadSessions = async () => {
    if (!firestore || !centerId || !selectedStudent || !dateKey) return;
    setLoadingSessions(true);
    try {
      const sessionsRef = collection(
        firestore,
        'centers', centerId, 'studyLogs', selectedStudent.id, 'days', dateKey, 'sessions'
      );
      const snap = await getDocs(query(sessionsRef, orderBy('startTime', 'asc')));
      setSessions(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SessionDoc, 'id'>) }))
      );
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    if (selectedStudent && dateKey) void loadSessions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStudent, dateKey]);

  const handleEditSave = async () => {
    if (!firestore || !centerId || !selectedStudent || !editTarget) return;
    const newMinutes = parseInt(editMinutes, 10);
    if (!Number.isFinite(newMinutes) || newMinutes < 0 || newMinutes > 360) {
      toast({ title: '오류', description: '0~360분 범위로 입력하세요.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const diff = newMinutes - editTarget.durationMinutes;
      const batch = writeBatch(firestore);

      const sessionRef = doc(
        firestore,
        'centers', centerId, 'studyLogs', selectedStudent.id, 'days', dateKey, 'sessions', editTarget.id
      );
      batch.update(sessionRef, { durationMinutes: newMinutes, correctedAt: serverTimestamp() });

      if (diff !== 0) {
        const logRef = doc(firestore, 'centers', centerId, 'studyLogs', selectedStudent.id, 'days', dateKey);
        const logSnap = await getDoc(logRef);
        const current = Number(logSnap.data()?.totalMinutes ?? 0);
        batch.update(logRef, { totalMinutes: Math.max(0, current + diff), updatedAt: serverTimestamp() });

        const statRef = doc(firestore, 'centers', centerId, 'dailyStudentStats', dateKey, 'students', selectedStudent.id);
        const statSnap = await getDoc(statRef);
        const currentStat = Number(statSnap.data()?.totalStudyMinutes ?? 0);
        batch.set(statRef, { totalStudyMinutes: Math.max(0, currentStat + diff), updatedAt: serverTimestamp() }, { merge: true });
      }

      await batch.commit();
      toast({ title: '수정 완료', description: `${newMinutes}분으로 변경됐습니다.` });
      setEditTarget(null);
      await loadSessions();
    } catch (e) {
      toast({ title: '오류', description: '저장 실패', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!firestore || !centerId || !selectedStudent || !deleteTarget) return;
    setDeleting(true);
    try {
      const batch = writeBatch(firestore);

      const sessionRef = doc(
        firestore,
        'centers', centerId, 'studyLogs', selectedStudent.id, 'days', dateKey, 'sessions', deleteTarget.id
      );
      batch.delete(sessionRef);

      const logRef = doc(firestore, 'centers', centerId, 'studyLogs', selectedStudent.id, 'days', dateKey);
      const logSnap = await getDoc(logRef);
      const current = Number(logSnap.data()?.totalMinutes ?? 0);
      batch.update(logRef, { totalMinutes: Math.max(0, current - deleteTarget.durationMinutes), updatedAt: serverTimestamp() });

      const statRef = doc(firestore, 'centers', centerId, 'dailyStudentStats', dateKey, 'students', selectedStudent.id);
      const statSnap = await getDoc(statRef);
      const currentStat = Number(statSnap.data()?.totalStudyMinutes ?? 0);
      batch.set(statRef, { totalStudyMinutes: Math.max(0, currentStat - deleteTarget.durationMinutes), updatedAt: serverTimestamp() }, { merge: true });

      await batch.commit();
      toast({ title: '삭제 완료' });
      setDeleteTarget(null);
      await loadSessions();
    } catch (e) {
      toast({ title: '오류', description: '삭제 실패', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6 pb-24">
      <div>
        <h1 className="text-xl font-black text-[#14295F]">세션 수동 보정</h1>
        <p className="text-sm text-muted-foreground mt-1">학생별·날짜별 집중 세션을 조회하고 시간을 수정하거나 삭제합니다.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* 학생 선택 */}
        <Card className="rounded-2xl border border-[#e2e8f8]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-black">학생 선택</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="이름·학년 검색"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm rounded-xl"
              />
            </div>
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {filtered.length === 0 && (
                <p className="text-center py-4 text-xs text-muted-foreground">학생이 없습니다</p>
              )}
              {filtered.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedStudent(s)}
                  className={cn(
                    'w-full text-left rounded-xl px-3 py-2 text-sm transition-all flex items-center gap-2',
                    selectedStudent?.id === s.id
                      ? 'bg-[#14295F] text-white font-black'
                      : 'hover:bg-slate-50 font-bold text-slate-700'
                  )}
                >
                  <span className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-black bg-current/10 border border-current/10">
                    {s.name.charAt(0)}
                  </span>
                  <span className="truncate">{s.name}</span>
                  <ChevronRight className="h-3 w-3 ml-auto opacity-40" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 날짜 선택 */}
        <Card className="rounded-2xl border border-[#e2e8f8]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-black">날짜 선택</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs font-bold text-muted-foreground">날짜</Label>
              <Input
                type="date"
                value={dateKey}
                onChange={(e) => setDateKey(e.target.value)}
                className="mt-1 h-9 text-sm rounded-xl"
              />
            </div>
            {selectedStudent && (
              <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
                <span className="text-[#14295F] font-black">{selectedStudent.name}</span>
                {' '}·{' '}
                {format(parse(dateKey, 'yyyy-MM-dd', new Date()), 'yyyy년 MM월 dd일', { locale: ko })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 세션 목록 */}
      {selectedStudent && (
        <Card className="rounded-2xl border border-[#e2e8f8]">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-black">세션 목록</CardTitle>
              <CardDescription className="text-xs mt-0.5">{sessions.length}건</CardDescription>
            </div>
            {loadingSessions && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </CardHeader>
          <CardContent>
            {sessions.length === 0 && !loadingSessions && (
              <div className="text-center py-8 text-xs font-bold text-muted-foreground">
                해당 날짜에 세션이 없습니다
              </div>
            )}
            <div className="space-y-2">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-4 py-3',
                    s.closedReason
                      ? 'border-amber-200 bg-amber-50/60'
                      : 'border-[#e2e8f8] bg-[#f8faff]'
                  )}
                >
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-[#14295F]/5">
                    {s.closedReason ? (
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    ) : (
                      <Zap className="h-4 w-4 text-[#14295F]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-[#14295F]">{toHm(s.durationMinutes)}</span>
                      {s.closedReason && (
                        <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-700 text-[9px] font-black h-4 px-1.5">
                          자동종료
                        </Badge>
                      )}
                      {s.validationFlag && (
                        <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-600 text-[9px] font-black h-4 px-1.5">
                          보정됨
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] font-bold text-muted-foreground mt-0.5">
                      <Clock className="h-3 w-3 inline mr-0.5 align-middle" />
                      {tsToLabel(s.startTime)} → {tsToLabel(s.endTime)}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 rounded-lg hover:bg-blue-50 hover:text-blue-600"
                      onClick={() => {
                        setEditTarget(s);
                        setEditMinutes(String(s.durationMinutes));
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 rounded-lg hover:bg-rose-50 hover:text-rose-600"
                      onClick={() => setDeleteTarget(s)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 수정 다이얼로그 */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-black text-[#14295F]">세션 시간 수정</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              현재: <span className="font-black text-foreground">{toHm(editTarget?.durationMinutes ?? 0)}</span>
            </p>
            <div>
              <Label className="text-xs font-bold">새 집중 시간 (분, 0~360)</Label>
              <Input
                type="number"
                min={0}
                max={360}
                value={editMinutes}
                onChange={(e) => setEditMinutes(e.target.value)}
                className="mt-1 h-9 rounded-xl"
              />
            </div>
            <p className="text-[11px] font-bold text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
              수정 시 오늘 공부 합계 및 통계가 자동으로 재계산됩니다.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline" className="rounded-xl h-9 font-black">취소</Button>
            </DialogClose>
            <Button
              onClick={handleEditSave}
              disabled={saving}
              className="rounded-xl h-9 font-black bg-[#14295F] hover:bg-[#0f1f4a]"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-black text-rose-600">세션 삭제</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            <span className="font-black text-foreground">{toHm(deleteTarget?.durationMinutes ?? 0)}</span> 세션을 삭제합니다.
            이 작업은 되돌릴 수 없으며, 공부 합계에서 차감됩니다.
          </p>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline" className="rounded-xl h-9 font-black">취소</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-xl h-9 font-black"
            >
              {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
