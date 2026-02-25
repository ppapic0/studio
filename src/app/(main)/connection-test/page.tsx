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
import { doc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export default function ConnectionTestPage() {
  const { user } = useUser();
  const functions = useFunctions();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [results, setResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [centerId, setCenterId] = useState('center-1');
  const [role, setRole] = useState<'student' | 'teacher' | 'parent' | 'centerAdmin'>('student');
  const [linkedStudentId, setLinkedStudentId] = useState('');
  const [devSecret, setDevSecret] = useState('');

  const addResult = (text: string) => {
    setResults(prev => [`[${new Date().toLocaleTimeString()}] ${text}`, ...prev]);
  };

  const handleReadProfile = async () => {
    if (!firestore || !user) {
      addResult('❌ Firestore or user not available.');
      return;
    }
    setIsLoading(true);
    addResult('🔄 Firestore 읽기 테스트 시작: /users/{uid}...');
    try {
      const userDocRef = doc(firestore, 'users', user.uid);
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        addResult(`✅ 성공: 사용자 프로필 읽기 완료. 데이터: ${JSON.stringify(docSnap.data())}`);
      } else {
        addResult('⚠️ 경고: 사용자 프로필 문서가 존재하지 않습니다. 회원가입 시 생성되어야 합니다.');
      }
    } catch (error: any) {
      addResult(`❌ 실패: Firestore 읽기 중 오류 발생. ${error.message}`);
    }
    setIsLoading(false);
  };

  const handleJoinCenter = async () => {
    if (!functions) {
      addResult('❌ Firebase Functions not available.');
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
    } catch (error: any) {
      addResult(`❌ 실패: Cloud Function 호출 중 오류 발생. ${error.code} - ${error.message}`);
      toast({
        variant: 'destructive',
        title: '오류',
        description: `센터 가입 실패: ${error.message}`,
      });
    }
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col min-h-screen items-center justify-center p-4 bg-background">
      <div className="w-full max-w-4xl space-y-6">
        <h1 className="text-3xl font-headline font-bold text-center">Firebase 연결 테스트</h1>
        
        <Card>
          <CardHeader>
            <CardTitle>1. Firebase 구성</CardTitle>
            <CardDescription>앱에 로드된 Firebase 프로젝트 구성 정보입니다.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p><strong>프로젝트 ID:</strong> {firebaseConfig.projectId || 'Not Loaded'}</p>
            <p><strong>인증 도메인:</strong> {firebaseConfig.authDomain || 'Not Loaded'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Firebase 인증</CardTitle>
            <CardDescription>현재 인증된 사용자 정보입니다.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p><strong>상태:</strong> {user ? '로그인됨' : '로그아웃됨'}</p>
            <p><strong>UID:</strong> {user?.uid || 'N/A'}</p>
            <p><strong>이메일:</strong> {user?.email || 'N/A'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. Firestore 및 Cloud Functions 테스트</CardTitle>
            <CardDescription>
              아직 센터 멤버십이 없는 경우, 아래 양식을 사용하여 개발용으로 센터에 가입하세요.
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
                <Button onClick={handleReadProfile} disabled={isLoading || !user} variant="outline">
                Firestore 읽기 테스트
                </Button>
                <Button onClick={handleJoinCenter} disabled={isLoading || !user}>
                {isLoading ? '처리 중...' : 'devJoinCenter 기능 호출'}
                </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>테스트 결과</CardTitle>
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
