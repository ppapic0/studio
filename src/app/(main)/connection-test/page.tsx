'use client';

import { useState } from 'react';
import { useUser, useFunctions, useFirestore } from '@/firebase';
import { firebaseConfig } from '@/firebase/config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '@/contexts/app-context';
import { useRouter } from 'next/navigation';

export default function ConnectionTestPage() {
  const { user } = useUser();
  const functions = useFunctions();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const { memberships, setActiveMembership } = useAppContext();

  const [results, setResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingManually, setIsCheckingManually] = useState(false);

  // Form states for devJoinCenter
  const [centerId, setCenterId] = useState('center-1');
  const [role, setRole] = useState<'student' | 'teacher' | 'parent' | 'centerAdmin'>('student');
  const [linkedStudentId, setLinkedStudentId] = useState('');
  const [devSecret, setDevSecret] = useState('');

  // Form state for manual check
  const [manualCenterId, setManualCenterId] = useState('');

  const addResult = (text: string) => {
    setResults(prev => [`[${new Date().toLocaleTimeString()}] ${text}`, ...prev]);
  };

  const handleJoinCenter = async () => {
    if (!functions || !user) {
      addResult('❌ Firebase Functions or user not available.');
      return;
    }
    setIsLoading(true);
    addResult('🔄 Cloud Function 호출 시작: devJoinCenter...');
    try {
      const devJoinCenter = httpsCallable(functions, 'devJoinCenter');
      const result: any = await devJoinCenter({
        centerId,
        role,
        linkedStudentId,
        devSecret,
      });
      addResult(`✅ 성공: Cloud Function 호출 완료. 응답: ${JSON.stringify(result.data)}`);
      toast({
        title: '성공!',
        description: '센터에 가입되었습니다. 페이지를 새로고침하여 대시보드로 이동합니다.',
      });
      setTimeout(() => window.location.reload(), 2000);
    } catch (error: any)
      {
      addResult(`❌ 실패: Cloud Function 호출 중 오류 발생. ${error.code} - ${error.message}`);
      toast({
        variant: 'destructive',
        title: '오류',
        description: `센터 가입 실패: ${error.message}`,
      });
    }
    setIsLoading(false);
  };
  
  const handleManualCheck = async () => {
    if (!firestore || !user || !manualCenterId) {
      addResult('❌ Firestore, 사용자 또는 센터 ID를 사용할 수 없습니다.');
      return;
    }
    setIsCheckingManually(true);
    addResult(`🔄 수동 확인 시작: /centers/${manualCenterId}/members/${user.uid}`);
    try {
      const memberDocRef = doc(firestore, 'centers', manualCenterId, 'members', user.uid);
      const memberDocSnap = await getDoc(memberDocRef);

      if (memberDocSnap.exists()) {
        const memberData = memberDocSnap.data();
        addResult(`✅ 멤버십 문서 찾음. 상태: ${memberData.status}, 역할: ${memberData.role}`);

        if (memberData.status === 'active') {
          addResult('✅ 활성 멤버십 확인. 리버스 인덱스 생성 및 리디렉션 시도 중...');
          
          const userCenterDocRef = doc(firestore, 'userCenters', user.uid, 'centers', manualCenterId);
          
          await setDoc(userCenterDocRef, {
            role: memberData.role,
            status: memberData.status,
            joinedAt: memberData.joinedAt || serverTimestamp(),
          });
          
          addResult(`✅ 리버스 인덱스 문서 생성 완료: /userCenters/${user.uid}/centers/${manualCenterId}`);
          
          setActiveMembership({ id: manualCenterId, ...memberData } as any);
          
          toast({
            title: '멤버십 확인됨!',
            description: '대시보드로 이동합니다.',
          });
          // Use router push to navigate instead of full reload
          router.push('/dashboard');

        } else {
          addResult(`⚠️ 멤버십이 활성 상태가 아닙니다 (상태: ${memberData.status}).`);
        }
      } else {
        addResult('❌ 해당 센터에서 멤버십을 찾을 수 없습니다.');
      }
    } catch (error: any) {
      addResult(`❌ 수동 확인 중 오류 발생: ${error.message}`);
    }
    setIsCheckingManually(false);
  };

  return (
    <div className="flex flex-col min-h-screen items-center justify-center p-4 bg-background">
      <div className="w-full max-w-4xl space-y-6">
        <h1 className="text-3xl font-headline font-bold text-center">Firebase 연결 및 멤버십</h1>
        
        <Card>
          <CardHeader>
            <CardTitle>1. Firebase 연결 상태</CardTitle>
            <CardDescription>앱의 Firebase 프로젝트 연결 및 인증 상태입니다.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p><strong>프로젝트 ID:</strong> {firebaseConfig.projectId || '로드되지 않음'}</p>
            <p><strong>인증 상태:</strong> {user ? `로그인됨 (UID: ${user.uid})` : '로그아웃됨'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. 멤버십 상태</CardTitle>
            <CardDescription>
              `userCenters` 컬렉션에서 조회된 당신의 멤버십 정보입니다. 멤버십이 없다면 아래 방법 중 하나를 사용하여 센터에 가입하세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
             <p><strong>`/userCenters`에서 찾은 멤버십 수:</strong> {memberships?.length ?? 0}</p>
             {memberships && memberships.length > 0 && (
                <ul className="list-disc pl-5">
                    {memberships.map(m => <li key={m.id}>센터 ID: {m.id}, 역할: {m.role}</li>)}
                </ul>
             )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3-A. 수동으로 멤버십 확인</CardTitle>
            <CardDescription>
              {'테스트를 위해 Firestore에서 직접 `/centers/{centerId}/members/{uid}` 문서를 생성한 경우, 아래에서 센터 ID를 입력하여 멤버십을 활성화하세요.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="flex gap-2">
                <Input id="manualCenterId" value={manualCenterId} onChange={(e) => setManualCenterId(e.target.value)} placeholder="센터 ID 입력 (예: center-1)" />
                <Button onClick={handleManualCheck} disabled={isCheckingManually || !manualCenterId}>
                    {isCheckingManually ? '확인 중...' : '멤버십 확인'}
                </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3-B. (개발용) 테스트 센터에 가입</CardTitle>
            <CardDescription>
              아직 센터 멤버십이 없는 경우, `devJoinCenter` Cloud Function을 호출하여 테스트용 멤버십을 생성할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="centerId">센터 ID</Label>
                <Input id="centerId" value={centerId} onChange={(e) => setCenterId(e.target.value)} />
              </div>
               <div className="space-y-2">
                <Label htmlFor="role">역할</Label>
                <Select value={role} onValueChange={(value) => setRole(value as any)}>
                    <SelectTrigger id="role">
                      <SelectValue placeholder="역할을 선택하세요" />
                    </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">학생</SelectItem>
                    <SelectItem value="parent">학부모</SelectItem>
                    <SelectItem value="teacher">교사</SelectItem>
                    <SelectItem value="centerAdmin">센터 관리자</SelectItem>
                  </SelectContent>
                </Select>
              </div>
               {role === 'parent' && (
                <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="linkedStudentId">연결할 학생 UID (선택 사항)</Label>
                    <Input id="linkedStudentId" value={linkedStudentId} onChange={(e) => setLinkedStudentId(e.target.value)} placeholder="학부모 역할일 경우 입력"/>
                </div>
               )}
               <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="devSecret">개발용 비밀 키</Label>
                <Input id="devSecret" type="password" value={devSecret} onChange={(e) => setDevSecret(e.target.value)} placeholder=".env.local 및 Functions config의 DEV_SECRET"/>
              </div>
            </div>
             <div className="flex flex-wrap gap-2">
                <Button onClick={handleJoinCenter} disabled={isLoading || !user}>
                {isLoading ? '처리 중...' : 'devJoinCenter 기능 호출'}
                </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>결과 로그</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              readOnly
              className="h-48 font-mono text-xs"
              value={results.join('\n')}
              placeholder="테스트 결과가 여기에 표시됩니다..."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
