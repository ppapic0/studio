
'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { format, subMonths } from 'date-fns';
import { LeaderboardEntry, WithId, StudentProfile, CenterMembership, AttendanceCurrent } from '@/lib/types';
import { 
  Loader2, 
  Trophy, 
  Medal, 
  Crown, 
  Star, 
  Flame, 
  History, 
  Zap, 
  LayoutGrid,
  Filter,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

function isEnrolledMemberStatus(status: unknown): boolean {
  if (typeof status !== 'string') return true;
  const normalized = status.trim().toLowerCase();
  if (!normalized) return true;
  return normalized === 'active';
}

function isSyntheticStudentId(studentId: unknown): boolean {
  if (typeof studentId !== 'string') return true;
  const normalized = studentId.trim().toLowerCase();
  if (!normalized) return true;
  return normalized.startsWith('test-') || normalized.startsWith('seed-') || normalized.startsWith('mock-') || normalized.includes('dummy');
}

type LeaderboardTabProps = {
  title: string;
  description: string;
  entries: WithId<LeaderboardEntry>[] | null;
  isLoading: boolean;
  metricType: 'lp';
  isMobile: boolean;
  studentsMap: Record<string, StudentProfile>;
  classNameFilter?: string | null;
};

function LeaderboardTab({ title, description, entries, isLoading, isMobile, studentsMap, classNameFilter }: LeaderboardTabProps) {
  const filteredEntries = useMemo(() => {
    if (!entries) return [];
    // 1. 랭킹 항목 기준 목록
    let list = entries;
    
    // 2. 반 필터링
    if (classNameFilter) {
      list = list.filter(entry => entry.classNameSnapshot === classNameFilter);
    }
    
    // 3. 값 기준 정렬
    return list.sort((a, b) => b.value - a.value);
  }, [entries, classNameFilter]);

  const topThree = useMemo(() => filteredEntries.slice(0, 3), [filteredEntries]);
  const others = useMemo(() => filteredEntries.slice(3), [filteredEntries]);

  const getRankBadge = (idx: number) => {
    switch(idx) {
      case 0: return <div className="bg-gradient-to-br from-yellow-300 to-amber-500 p-2 rounded-full shadow-lg"><Crown className="h-5 w-5 text-white" /></div>;
      case 1: return <div className="bg-gradient-to-br from-slate-200 to-slate-400 p-2 rounded-full shadow-lg"><Medal className="h-5 w-5 text-white" /></div>;
      case 2: return <div className="bg-gradient-to-br from-orange-300 to-orange-600 p-2 rounded-full shadow-lg"><Star className="h-5 w-5 text-white" /></div>;
      default: return null;
    }
  };

  const formatName = (name: string) => {
    if (!name) return "익명 학생";
    return name.length > 1 ? name.charAt(0) + "*O" : name; 
  };

  return (
    <div className="space-y-6">
      <Card className={cn(
        "border-none shadow-2xl overflow-hidden bg-white/80 backdrop-blur-xl ring-1 ring-border/50",
        isMobile ? "rounded-[2rem]" : "rounded-[3.5rem]"
      )}>
        <CardHeader className={cn(
          "bg-gradient-to-b from-muted/30 to-transparent relative border-b",
          isMobile ? "p-6" : "p-12"
        )}>
          <div className="absolute top-8 right-8 opacity-5 rotate-12">
            <Zap className={cn(isMobile ? "h-20 w-24" : "h-40 w-40", "text-amber-500")} />
          </div>
          <div className="flex items-center gap-6 relative z-10">
            <div className={cn(
              "rounded-[1.5rem] shadow-xl shrink-0 flex items-center justify-center p-4 bg-amber-50 text-amber-600",
              isMobile ? "h-12 w-12" : "h-20 w-20"
            )}>
              <Trophy className={cn(isMobile ? "h-6 w-6" : "h-10 w-10")} />
            </div>
            <div className="space-y-1">
              <CardTitle className={cn("font-black tracking-tighter uppercase leading-none", isMobile ? "text-xl" : "text-5xl")}>
                {classNameFilter ? `${classNameFilter} 챔피언` : title}
              </CardTitle>
              <CardDescription className={cn("font-bold text-muted-foreground/80", isMobile ? "text-[10px]" : "text-xl")}>{description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className={cn("p-0 bg-[#fafafa]/50")}>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
              <p className="font-black text-[10px] text-muted-foreground/40 tracking-widest italic whitespace-nowrap">랭킹 데이터를 불러오는 중...</p>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-32 flex flex-col items-center gap-6">
              <div className="p-8 rounded-full bg-muted/20">
                <Trophy className="h-16 w-16 text-muted-foreground opacity-10" />
              </div>
              <p className="text-sm font-black text-muted-foreground/40 uppercase tracking-widest">현재 시즌 기록이 없습니다.</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-muted/10">
                {topThree.map((entry, idx) => {
                  const profile = studentsMap[entry.studentId];
                  return (
                    <div key={entry.id} className={cn(
                      "flex items-center justify-between transition-all duration-500 group relative overflow-hidden",
                      isMobile ? "p-6" : "p-12",
                      idx === 0 ? "bg-amber-50/20" : idx === 1 ? "bg-slate-50/20" : "bg-orange-50/20"
                    )}>
                      <div className={cn("flex items-center relative z-10 min-w-0", isMobile ? "gap-4" : "gap-12")}>
                        <div className="w-10 shrink-0 flex flex-col items-center justify-center gap-2">
                          {getRankBadge(idx)}
                          <span className="text-[8px] font-black opacity-20 tracking-widest whitespace-nowrap">순위</span>
                        </div>
                        <div className="relative shrink-0">
                          <Avatar className={cn(
                            "border-4 border-white shadow-2xl transition-transform duration-700 group-hover:scale-110",
                            isMobile ? "h-14 w-14" : "h-24 w-24"
                          )}>
                            <AvatarFallback className="bg-primary/5 text-primary font-black text-xl">{entry.displayNameSnapshot?.charAt(0) || "S"}</AvatarFallback>
                          </Avatar>
                          {idx === 0 && <div className="absolute -top-2 -right-2"><Flame className={cn(isMobile ? "h-5 w-5" : "h-8 w-8", "text-orange-500 fill-orange-500 animate-pulse")} /></div>}
                        </div>
                        <div className="grid gap-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn("font-black tracking-tighter truncate", isMobile ? "text-lg" : "text-4xl")}>{formatName(entry.displayNameSnapshot)}</span>
                            <Badge className="bg-white/80 text-primary border-none shadow-sm font-black text-[8px] h-4 px-1.5 whitespace-nowrap">재원생</Badge>
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground font-bold">
                            <History className="h-3 w-3 opacity-40" />
                            <span className={cn("truncate", isMobile ? "text-[10px]" : "text-lg")}>{profile?.schoolName || entry.classNameSnapshot || "센터 소속"}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 relative z-10">
                        <div className={cn("font-black tabular-nums tracking-tighter leading-none text-primary", isMobile ? "text-xl" : "text-6xl", idx === 0 && "text-amber-600")}>{(entry.value || 0).toLocaleString()}<span className={cn("opacity-30 font-bold whitespace-nowrap", isMobile ? "text-[10px] ml-1" : "text-2xl ml-1.5")}>점</span></div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {others.length > 0 && (
                <div className="p-6 sm:p-12 border-t border-dashed bg-white/30">
                  <div className="grid gap-3">
                    {others.map((entry, idx) => {
                      const profile = studentsMap[entry.studentId];
                      const rank = idx + 4;
                      return (
                        <div key={entry.id} className="flex items-center justify-between p-5 rounded-2xl bg-white border border-border/50 shadow-sm group hover:border-primary/20 transition-all">
                          <div className="flex items-center gap-4">
                            <div className="w-8 flex justify-center text-sm font-black text-muted-foreground/40">{rank}</div>
                            <Avatar className="h-10 w-10 border-2 border-white shadow-sm ring-1 ring-border/50"><AvatarFallback className="bg-primary/5 text-primary font-black text-xs">{entry.displayNameSnapshot?.charAt(0) || "S"}</AvatarFallback></Avatar>
                            <div className="grid"><span className="font-black text-sm">{formatName(entry.displayNameSnapshot)}</span><span className="text-[10px] font-bold text-muted-foreground/60">{profile?.schoolName || entry.classNameSnapshot || '센터'}</span></div>
                          </div>
                          <div className="text-right"><span className="text-base font-black text-primary/80 tabular-nums">{(entry.value || 0).toLocaleString()}</span><span className="text-[8px] font-bold text-muted-foreground/40 ml-1 whitespace-nowrap">점</span></div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function LeaderboardsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { activeMembership, viewMode } = useAppContext();
  
  const [seasonOffset, setSeasonOffset] = useState<0 | -1>(0); 
  const [rankingScope, setRankingScope] = useState<'class' | 'total'>('total');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  
  const isMember = !!activeMembership;
  const isMobile = viewMode === 'mobile';
  const userRole = activeMembership?.role;
  const canReadMemberRoster =
    userRole === 'student' || userRole === 'teacher' || userRole === 'centerAdmin' || userRole === 'owner';
  const canReadStudentProfiles = userRole === 'teacher' || userRole === 'centerAdmin' || userRole === 'owner';
  
  const targetDate = useMemo(() => seasonOffset === 0 ? new Date() : subMonths(new Date(), 1), [seasonOffset]);
  const periodKey = useMemo(() => format(targetDate, 'yyyy-MM'), [targetDate]);

  // 1. 현재 재원(active) 학생 멤버 목록
  const membersQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !canReadMemberRoster) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'members'),
      where('role', '==', 'student'),
      where('status', '==', 'active')
    );
  }, [firestore, activeMembership, canReadMemberRoster]);
  const {
    data: studentMembers,
    isLoading: membersLoading,
    error: membersError,
  } = useCollection<CenterMembership>(membersQuery, { enabled: isMember && canReadMemberRoster });

  const activeStudentIds = useMemo(() => {
    if (!canReadMemberRoster || membersLoading) return null;
    if (!studentMembers) return null;

    return new Set(
      studentMembers
        .filter((member) => isEnrolledMemberStatus((member as any).status))
        .map((member) => member.id)
    );
  }, [canReadMemberRoster, membersLoading, studentMembers]);

  // 2. 실제 좌석 배정 학생 목록
  const attendanceCurrentQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return collection(firestore, 'centers', activeMembership.id, 'attendanceCurrent');
  }, [firestore, activeMembership]);
  const {
    data: attendanceCurrent,
    isLoading: attendanceLoading,
    error: attendanceError,
  } = useCollection<AttendanceCurrent>(attendanceCurrentQuery, { enabled: isMember });

  const assignedStudentIds = useMemo(() => {
    if (!attendanceCurrent) return null;
    const ids = attendanceCurrent
      .map((seat) => (typeof seat.studentId === 'string' ? seat.studentId.trim() : ''))
      .filter((id) => id.length > 0 && !isSyntheticStudentId(id));
    return new Set(ids);
  }, [attendanceCurrent]);

  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !canReadStudentProfiles) return null;
    return collection(firestore, 'centers', activeMembership.id, 'students');
  }, [firestore, activeMembership, canReadStudentProfiles]);
  const {
    data: studentProfiles,
    isLoading: profilesLoading,
    error: profilesError,
  } = useCollection<StudentProfile>(studentsQuery, { enabled: isMember && canReadStudentProfiles });

  const studentsMap = useMemo(() => {
    const map: Record<string, StudentProfile> = {};
    studentProfiles?.forEach((profile) => {
      map[profile.id] = profile;
    });
    return map;
  }, [studentProfiles]);

  const lpQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'leaderboards', `${periodKey}_lp`, 'entries'),
      orderBy('value', 'desc')
    );
  }, [firestore, activeMembership, periodKey]);
  const { data: allLpEntries, isLoading: lpLoading } = useCollection<LeaderboardEntry>(lpQuery, { enabled: isMember });

  const visibleLpEntries = useMemo(() => {
    if (!allLpEntries) return null;

    if (attendanceError) return [];
    if (assignedStudentIds === null) return [];
    if (assignedStudentIds.size === 0) return [];

    let filtered = allLpEntries.filter(
      (entry) => !isSyntheticStudentId(entry.studentId) && assignedStudentIds.has(entry.studentId)
    );

    if (canReadMemberRoster) {
      if (membersError) return [];
      if (activeStudentIds === null) return [];
      filtered = filtered.filter((entry) => activeStudentIds.has(entry.studentId));
    }

    if (canReadStudentProfiles) {
      if (profilesError) return [];
      if (profilesLoading) return [];
      filtered = filtered.filter((entry) => !!studentsMap[entry.studentId]);
    }

    return filtered;
  }, [
    allLpEntries,
    attendanceError,
    assignedStudentIds,
    canReadMemberRoster,
    membersError,
    activeStudentIds,
    canReadStudentProfiles,
    profilesError,
    profilesLoading,
    studentsMap,
  ]);

  const boardLoading =
    lpLoading ||
    attendanceLoading ||
    (canReadMemberRoster && membersLoading) ||
    (canReadStudentProfiles && profilesLoading);

  const availableClasses = useMemo(() => {
    const classes = new Set<string>();

    if (visibleLpEntries && visibleLpEntries.length > 0) {
      visibleLpEntries.forEach((entry) => {
        if (entry.classNameSnapshot) classes.add(entry.classNameSnapshot);
      });
    } else if (studentMembers && studentMembers.length > 0) {
      studentMembers
        .filter((member) => isEnrolledMemberStatus((member as any).status))
        .forEach((member) => {
          if (member.className) classes.add(member.className);
        });
    } else {
      allLpEntries?.forEach((entry) => {
        if (entry.classNameSnapshot) classes.add(entry.classNameSnapshot);
      });
    }

    return ['all', ...Array.from(classes).sort()];
  }, [visibleLpEntries, studentMembers, allLpEntries]);

  if (!isMember) return null;

  return (
    <div className={cn("flex flex-col mx-auto pb-20", isMobile ? "gap-6 px-1" : "gap-10 px-4 max-w-[1400px]")}>
      <header className={cn("flex flex-col gap-4 items-center text-center", isMobile ? "px-2" : "")}>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/5 border border-primary/10 shadow-sm">
          <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
          <span className="text-[9px] font-black tracking-[0.25em] text-primary/60 whitespace-nowrap">실시간 시즌 랭킹</span>
          <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
        </div>
        <h1 className={cn("font-black tracking-tight", isMobile ? "text-3xl" : "text-6xl")}>랭킹트랙</h1>
        <div className="flex gap-2 p-1.5 bg-white/50 backdrop-blur-md rounded-2xl border shadow-xl">
          <Button onClick={() => setSeasonOffset(0)} className={cn("rounded-xl h-10 px-4 font-black text-xs transition-all", seasonOffset === 0 ? "bg-primary text-white shadow-lg" : "bg-transparent text-muted-foreground")}>이번 시즌</Button>
          <Button onClick={() => setSeasonOffset(-1)} className={cn("rounded-xl h-10 px-4 font-black text-xs transition-all", seasonOffset === -1 ? "bg-primary text-white shadow-lg" : "bg-transparent text-muted-foreground")}>지난 시즌</Button>
        </div>
        <p className={cn("font-bold text-muted-foreground leading-relaxed", isMobile ? "text-xs max-w-xs" : "text-xl max-w-2xl")}>
          {format(targetDate, 'yyyy년 M월')} 시즌 실시간 랭킹입니다. <br/>
          퇴원생을 제외한 재원생 중 누적 포인트를 통해 여러분의 성장을 증명하세요.
        </p>
      </header>

      <Tabs value={rankingScope} onValueChange={(val: any) => setRankingScope(val)} className="w-full">
        <div className="flex flex-col items-center gap-6 mb-8">
          <TabsList className={cn("grid grid-cols-2 bg-muted/30 p-1.5 rounded-[1.5rem] border border-border/50 shadow-inner w-full h-16 max-w-md")}>
            <TabsTrigger value="total" className="font-black data-[state=active]:bg-white data-[state=active]:shadow-xl transition-all uppercase tracking-tighter gap-1.5 rounded-[1.25rem]"><Zap className="h-4 w-4 text-amber-500" /> <span>전체 랭킹</span></TabsTrigger>
            <TabsTrigger value="class" className="font-black data-[state=active]:bg-white data-[state=active]:shadow-xl transition-all uppercase tracking-tighter gap-1.5 rounded-[1.25rem]"><LayoutGrid className="h-4 w-4" /> <span>반별 랭킹</span></TabsTrigger>
          </TabsList>
          {rankingScope === 'class' && (
            <div className="flex items-center gap-3 bg-white/80 backdrop-blur-xl p-2 rounded-2xl border shadow-lg animate-in fade-in duration-300">
              <Filter className="h-4 w-4 text-primary opacity-40 ml-2" />
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="h-10 w-[220px] border-none bg-transparent font-black text-sm focus:ring-0 shadow-none"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl">{availableClasses.map(c => <SelectItem key={c} value={c} className="font-black">{c === 'all' ? '전체 반' : c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </div>
        <TabsContent value="class" className="mt-0 animate-in fade-in duration-500">
          <LeaderboardTab title={selectedClass !== 'all' ? `${selectedClass} 랭킹` : '반별 랭킹'} description={`${selectedClass} 학생들의 성적입니다.`} entries={visibleLpEntries} isLoading={boardLoading} metricType="lp" isMobile={isMobile} studentsMap={studentsMap} classNameFilter={selectedClass === 'all' ? null : selectedClass} />
        </TabsContent>
        <TabsContent value="total" className="mt-0 animate-in fade-in duration-500">
          <LeaderboardTab title="전체 랭킹" description="센터 전체 학생 중 이번 시즌 가장 앞서가는 러너들입니다." entries={visibleLpEntries} isLoading={boardLoading} metricType="lp" isMobile={isMobile} studentsMap={studentsMap} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
