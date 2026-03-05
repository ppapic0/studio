
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
import { collection, query, orderBy, limit, where } from 'firebase/firestore';
import { format, subMonths } from 'date-fns';
import { LeaderboardEntry, WithId, StudentProfile, CenterMembership } from '@/lib/types';
import { 
  Loader2, 
  Trophy, 
  Medal, 
  Crown, 
  Star, 
  Flame, 
  History, 
  Zap, 
  User, 
  LayoutGrid,
  Filter,
  ChevronRight
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type LeaderboardTabProps = {
  title: string;
  description: string;
  entries: WithId<LeaderboardEntry>[] | null;
  myEntry: LeaderboardEntry | null;
  totalStudents: number;
  isLoading: boolean;
  metricType: 'lp';
  isMobile: boolean;
  studentsMap: Record<string, StudentProfile>;
  classNameFilter?: string | null;
};

function LeaderboardTab({ title, description, entries, myEntry, totalStudents, isLoading, metricType, isMobile, studentsMap, classNameFilter }: LeaderboardTabProps) {
  const filteredEntries = useMemo(() => {
    if (!entries) return [];
    let list = [...entries];
    if (classNameFilter) {
      list = list.filter(entry => entry.classNameSnapshot === classNameFilter);
    }
    // value 기준 내림차순 정렬 보장
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

  const formatRank = (idx: number) => {
    const rank = idx + 1;
    if (rank <= 3) return `${rank}위`;
    const denominator = classNameFilter ? filteredEntries.length : totalStudents;
    if (denominator < 10) return `${rank}위`;
    const percent = Math.max(1, Math.ceil((rank / (denominator || 1)) * 100));
    return `상위 ${percent}%`;
  };

  const formatName = (name: string) => {
    if (!name) return "익명 학생";
    return name.length > 1 ? name.charAt(0) + "*O" : name; 
  };

  const myFilteredRankIdx = useMemo(() => {
    if (!myEntry) return -1;
    return filteredEntries.findIndex(e => e.studentId === myEntry.studentId);
  }, [filteredEntries, myEntry]);

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
              <p className="font-black text-[10px] text-muted-foreground/40 uppercase tracking-widest italic">Authenticating Champions...</p>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-32 flex flex-col items-center gap-6">
              <div className="p-8 rounded-full bg-muted/20">
                <Trophy className="h-16 w-16 text-muted-foreground opacity-10" />
              </div>
              <p className="text-sm font-black text-muted-foreground/40 uppercase tracking-widest">해당 데이터가 없습니다.</p>
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
                      {idx === 0 && (
                        <div className="absolute -left-10 top-1/2 -translate-y-1/2 opacity-5 pointer-events-none">
                          <Crown className={cn(isMobile ? "h-24 w-24" : "h-40 w-40", "-rotate-12")} />
                        </div>
                      )}
                      
                      <div className={cn("flex items-center relative z-10 min-w-0", isMobile ? "gap-4" : "gap-12")}>
                        <div className="w-10 shrink-0 flex flex-col items-center justify-center gap-2">
                          {getRankBadge(idx)}
                          <span className="text-[8px] font-black opacity-20 uppercase tracking-widest">Rank</span>
                        </div>
                        
                        <div className="relative shrink-0">
                          <Avatar className={cn(
                            "border-4 border-white shadow-2xl transition-transform duration-700 group-hover:scale-110",
                            isMobile ? "h-14 w-14" : "h-24 w-24"
                          )}>
                            <AvatarFallback className="bg-primary/5 text-primary font-black text-xl">
                              {entry.displayNameSnapshot?.charAt(0) || "S"}
                            </AvatarFallback>
                          </Avatar>
                          {idx === 0 && (
                            <div className="absolute -top-2 -right-2">
                              <Flame className={cn(isMobile ? "h-5 w-5" : "h-8 w-8", "text-orange-500 fill-orange-500 animate-pulse")} />
                            </div>
                          )}
                        </div>

                        <div className="grid gap-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn("font-black tracking-tighter truncate", isMobile ? "text-lg" : "text-4xl")}>
                              {formatName(entry.displayNameSnapshot)}
                            </span>
                            <Badge className="bg-white/80 text-primary border-none shadow-sm font-black text-[8px] uppercase h-4 px-1.5">Verified</Badge>
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground font-bold">
                            <History className="h-3 w-3 opacity-40" />
                            <span className={cn("truncate", isMobile ? "text-[10px]" : "text-lg")}>{profile?.schoolName || entry.classNameSnapshot || "비공개 소속"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 relative z-10">
                        <div className={cn(
                          "font-black tabular-nums tracking-tighter leading-none drop-shadow-sm text-primary",
                          isMobile ? "text-xl" : "text-6xl",
                          idx === 0 && "text-amber-600"
                        )}>
                          {(entry.value || 0).toLocaleString()}<span className={cn("opacity-30 uppercase font-bold", isMobile ? "text-[10px] ml-1" : "text-2xl ml-1.5")}>lp</span>
                        </div>
                        <span className="text-[8px] font-black text-muted-foreground/30 uppercase tracking-[0.2em] mt-1.5 block">Achievement</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {others.length > 0 && (
                <div className="p-6 sm:p-12 border-t border-dashed bg-white/30">
                  <h4 className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em] mb-6 ml-2">All Runners</h4>
                  <div className="grid gap-3">
                    {others.map((entry, idx) => {
                      const profile = studentsMap[entry.studentId];
                      const rank = idx + 4;
                      return (
                        <div key={entry.id} className="flex items-center justify-between p-5 rounded-2xl bg-white border border-border/50 shadow-sm group hover:border-primary/20 transition-all">
                          <div className="flex items-center gap-4">
                            <div className="w-8 flex justify-center text-sm font-black text-muted-foreground/40">{rank}</div>
                            <Avatar className="h-10 w-10 border-2 border-white shadow-sm ring-1 ring-border/50">
                              <AvatarFallback className="bg-primary/5 text-primary font-black text-xs">{entry.displayNameSnapshot?.charAt(0) || "S"}</AvatarFallback>
                            </Avatar>
                            <div className="grid">
                              <span className="font-black text-sm">{formatName(entry.displayNameSnapshot)}</span>
                              <span className="text-[10px] font-bold text-muted-foreground/60">{profile?.schoolName || entry.classNameSnapshot || '비공개'}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-base font-black text-primary/80 tabular-nums">{(entry.value || 0).toLocaleString()}</span>
                            <span className="text-[8px] font-bold text-muted-foreground/40 ml-1 uppercase">lp</span>
                          </div>
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

      {myFilteredRankIdx !== -1 && (
        <Card className={cn(
          "border-none shadow-xl bg-primary text-primary-foreground overflow-hidden relative group",
          isMobile ? "rounded-[1.5rem] p-6" : "rounded-[2.5rem] p-10"
        )}>
          <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12 group-hover:scale-110 transition-transform">
            <User className={isMobile ? "h-24 w-24" : "h-40 w-40"} />
          </div>
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="h-16 w-16 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 flex flex-col items-center justify-center">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">My Pos</span>
                <span className="text-2xl font-black">{formatRank(myFilteredRankIdx)}</span>
              </div>
              <div className="grid">
                <span className="text-xs font-black uppercase tracking-widest opacity-60">{classNameFilter ? `${classNameFilter} 내 순위` : '나의 시즌 성적'}</span>
                <h3 className="text-2xl sm:text-3xl font-black tracking-tighter">더 높은 곳을 향해! 🚀</h3>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl sm:text-4xl font-black tabular-nums tracking-tighter">{(myEntry?.value || 0).toLocaleString()}<span className="text-sm sm:text-lg opacity-40 ml-1 uppercase">lp</span></div>
              <p className="text-[10px] font-bold opacity-60 mt-1 uppercase">Season Points Earned</p>
            </div>
          </div>
        </Card>
      )}
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
  const myClassName = activeMembership?.className;
  
  const targetDate = useMemo(() => {
    return seasonOffset === 0 ? new Date() : subMonths(new Date(), 1);
  }, [seasonOffset]);

  const periodKey = useMemo(() => format(targetDate, 'yyyy-MM'), [targetDate]);

  const membersQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'members'),
      where('role', '==', 'student'),
      where('status', '==', 'active')
    );
  }, [firestore, activeMembership]);
  const { data: studentMembers } = useCollection<CenterMembership>(membersQuery, { enabled: isMember });

  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return collection(firestore, 'centers', activeMembership.id, 'students');
  }, [firestore, activeMembership]);
  const { data: studentProfiles } = useCollection<StudentProfile>(studentsQuery, { enabled: isMember });

  const studentsMap = useMemo(() => {
    const map: Record<string, StudentProfile> = {};
    studentProfiles?.forEach(p => { map[p.id] = p; });
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

  const availableClasses = useMemo(() => {
    const classes = new Set<string>();
    studentMembers?.forEach(m => { if (m.className) classes.add(m.className); });
    if (myClassName) classes.add(myClassName);
    allLpEntries?.forEach(e => { if (e.classNameSnapshot) classes.add(e.classNameSnapshot); });
    return Array.from(classes).sort();
  }, [studentMembers, allLpEntries, myClassName]);

  useEffect(() => {
    if (myClassName && selectedClass === 'all') {
      setSelectedClass(myClassName);
    }
  }, [myClassName, selectedClass]);

  const myRankEntry = useMemo(() => {
    if (!allLpEntries || !user) return null;
    return allLpEntries.find(e => e.studentId === user.uid) || null;
  }, [allLpEntries, user]);

  const totalCount = studentMembers?.length || 0;

  if (!isMember) {
    return (
        <div className="max-w-4xl mx-auto py-20 px-4">
          <Alert className="rounded-[3rem] border-none shadow-2xl bg-white p-12 text-center flex flex-col items-center">
            <Trophy className="h-20 w-20 text-muted-foreground opacity-20 mb-6" />
            <AlertTitle className="text-3xl font-black mb-4 tracking-tighter uppercase">Access Restricted</AlertTitle>
            <AlertDescription className="text-lg font-bold text-muted-foreground/70">
              랭킹트랙을 확인하려면 먼저 센터에 가입해야 합니다.
            </AlertDescription>
          </Alert>
        </div>
    )
  }

  return (
    <div className={cn("flex flex-col mx-auto pb-20", isMobile ? "gap-6 px-1" : "gap-10 px-4 max-w-[1400px]")}>
      <header className={cn("flex flex-col gap-4 items-center text-center", isMobile ? "px-2" : "")}>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/5 border border-primary/10 shadow-sm">
          <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
          <span className="text-[9px] font-black uppercase tracking-[0.25em] text-primary/60">Season Hall of Fame</span>
          <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
        </div>
        <h1 className={cn("font-black tracking-tight flex items-center gap-3", isMobile ? "text-2xl" : "text-6xl")}>
          랭킹트랙
        </h1>
        
        <div className="flex gap-2 p-1.5 bg-white/50 backdrop-blur-md rounded-2xl border shadow-xl mt-2">
          <Button 
            onClick={() => setSeasonOffset(0)}
            className={cn(
              "rounded-xl h-10 px-4 sm:h-11 sm:px-6 font-black text-[10px] sm:text-xs transition-all",
              seasonOffset === 0 ? "bg-primary text-white shadow-lg" : "bg-transparent text-muted-foreground hover:bg-muted/50"
            )}
          >이번 시즌</Button>
          <Button 
            onClick={() => setSeasonOffset(-1)}
            className={cn(
              "rounded-xl h-10 px-4 sm:h-11 sm:px-6 font-black text-[10px] sm:text-xs transition-all",
              seasonOffset === -1 ? "bg-primary text-white shadow-lg" : "bg-transparent text-muted-foreground hover:bg-muted/50"
            )}
          >지난 시즌</Button>
        </div>

        <p className={cn("font-bold text-muted-foreground leading-relaxed mt-2", isMobile ? "text-xs max-w-xs" : "text-xl max-w-2xl")}>
          {format(targetDate, 'yyyy년 M월')} 시즌 실시간 랭킹입니다. <br/>
          누적 LP를 통해 여러분의 성장을 증명하세요.
        </p>
      </header>

      <Tabs value={rankingScope} onValueChange={(val: any) => setRankingScope(val)} className="w-full">
        <div className="flex flex-col items-center gap-6 mb-8">
          <TabsList className={cn(
            "grid grid-cols-2 bg-muted/30 p-1.5 rounded-[1.5rem] border border-border/50 shadow-inner w-full",
            isMobile ? "h-12 max-w-[240px]" : "h-20 max-w-md rounded-[2.5rem]"
          )}>
            <TabsTrigger value="total" className={cn(
              "font-black data-[state=active]:bg-white data-[state=active]:shadow-xl transition-all uppercase tracking-tighter gap-1.5",
              isMobile ? "text-[10px] rounded-xl" : "text-base rounded-[2rem] px-4"
            )}>
              <Zap className={cn(isMobile ? "h-3 w-3" : "h-4 w-4", "text-amber-500")} /> <span>전체 랭킹</span>
            </TabsTrigger>
            <TabsTrigger value="class" className={cn(
              "font-black data-[state=active]:bg-white data-[state=active]:shadow-xl transition-all uppercase tracking-tighter gap-1.5",
              isMobile ? "text-[10px] rounded-xl" : "text-base rounded-[2rem] px-4"
            )}>
              <LayoutGrid className={cn(isMobile ? "h-3 w-3" : "h-4 w-4", rankingScope === 'class' ? "text-primary" : "text-muted-foreground")} /> 
              <span>반별 랭킹</span>
            </TabsTrigger>
          </TabsList>

          {rankingScope === 'class' && (
            <div className="flex items-center gap-3 bg-white/80 backdrop-blur-xl p-2 rounded-2xl border shadow-lg animate-in fade-in zoom-in-95 duration-300">
              <Filter className="h-4 w-4 text-primary opacity-40 ml-2" />
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="h-10 w-[180px] sm:w-[220px] border-none bg-transparent font-black text-xs sm:text-sm focus:ring-0 shadow-none">
                  <SelectValue placeholder="조회할 반 선택" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl">
                  {availableClasses.map(c => (
                    <SelectItem key={c} value={c} className="font-black">
                      {c} {c === myClassName ? '(우리 반)' : ''}
                    </SelectItem>
                  ))}
                  {availableClasses.length === 0 && (
                    <p className="p-4 text-center text-xs font-bold opacity-40">배정된 반 정보가 없습니다.</p>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <TabsContent value="class" className="mt-0 animate-in fade-in zoom-in-95 duration-500">
          <LeaderboardTab
            title={selectedClass !== 'all' ? `${selectedClass} 랭킹` : '반별 랭킹'}
            description={selectedClass !== 'all' ? `${selectedClass} 학생들의 이번 시즌 성적입니다.` : '반을 선택하여 순위를 확인하세요.'}
            entries={allLpEntries}
            myEntry={myRankEntry}
            totalStudents={totalCount}
            isLoading={lpLoading}
            metricType="lp"
            isMobile={isMobile}
            studentsMap={studentsMap}
            classNameFilter={selectedClass === 'all' ? null : selectedClass}
          />
        </TabsContent>

        <TabsContent value="total" className="mt-0 animate-in fade-in zoom-in-95 duration-500">
          <LeaderboardTab
            title="전체 랭킹"
            description="센터 전체 학생 중 이번 시즌 가장 앞서가는 러너들입니다."
            entries={allLpEntries}
            myEntry={myRankEntry}
            totalStudents={totalCount}
            isLoading={lpLoading}
            metricType="lp"
            isMobile={isMobile}
            studentsMap={studentsMap}
          />
        </TabsContent>
      </Tabs>

      <footer className="pt-12 flex flex-col items-center gap-4 opacity-30">
        <div className="flex items-center gap-2 font-black text-[8px] sm:text-[10px] uppercase tracking-[0.4em]">
          Analytical Track Hall of Fame
        </div>
        <p className="text-[9px] font-bold max-w-md text-center leading-relaxed">
          성적은 실시간으로 업데이트되며, 개인정보 보호를 위해 성명은 마스킹 처리됩니다.
        </p>
      </footer>
    </div>
  );
}
