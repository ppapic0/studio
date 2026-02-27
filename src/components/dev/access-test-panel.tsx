'use client';

import { useUser, useFirestore } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { addDoc, collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { Textarea } from '../ui/textarea';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export function AccessTestPanel() {
  const { user } = useUser();
  const { activeMembership } = useAppContext();
  const firestore = useFirestore();
  const [results, setResults] = useState<string[]>([]);
  
  const addResult = (text: string) => {
    setResults(prev => [`[${new Date().toLocaleTimeString()}] ${text}`, ...prev]);
  }

  const handleStudentWritePlan = async () => {
    if (!firestore || !user || !activeMembership) return;
    addResult(`🔄 학생 계획 항목 쓰기 시도...`);
    try {
      const weekKey = format(new Date(), "yyyy-'W'II");
      const planItemsRef = collection(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items');
      
      const data = {
        title: '새로운 테스트 계획 항목',
        done: false,
        weight: 1,
        dateKey: format(new Date(), 'yyyy-MM-dd'),
        centerId: activeMembership.id,
        studentId: user.uid,
        studyPlanWeekId: weekKey,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      addDoc(planItemsRef, data)
        .then(() => {
            addResult('✅ 성공: 학생 계획 항목 생성');
        })
        .catch(serverError => {
            const contextualError = new FirestorePermissionError({
                path: `${planItemsRef.path}/{newItemId}`,
                operation: 'create',
                requestResourceData: data,
            });
            errorEmitter.emit('permission-error', contextualError);
            addResult(`❌ 실패 (학생 계획): ${contextualError.message}`);
        });

    } catch(e: any) {
      addResult(`❌ 실패 (학생 계획 - 예외): ${e.message}`);
    }
  }
  
  const handleStudentWriteLog = async () => {
    if (!firestore || !user || !activeMembership) return;
    addResult(`🔄 학생 학습 로그 쓰기 시도...`);
    try {
        const dateKey = format(new Date(), 'yyyy-MM-dd');
        const dayLogRef = doc(firestore, 'centers', activeMembership.id, 'studyLogs', user.uid, 'days', dateKey);
        
        const data = {
            totalMinutes: 60,
            centerId: activeMembership.id,
            studentId: user.uid,
            dateKey: dateKey,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        setDoc(dayLogRef, data, { merge: true })
            .then(() => {
                addResult('✅ 성공: 학생 학습 로그 생성/업데이트');
            })
            .catch(serverError => {
                const contextualError = new FirestorePermissionError({
                    path: dayLogRef.path,
                    operation: 'write',
                    requestResourceData: data,
                });
                errorEmitter.emit('permission-error', contextualError);
                addResult(`❌ 실패 (학습 로그): ${contextualError.message}`);
            });
            
    } catch (e: any) {
        addResult(`❌ 실패 (학습 로그 - 예외): ${e.message}`);
    }
  }

  const handleTeacherWriteAttendance = async () => {
    if (!firestore || !user || !activeMembership) return;
    const someStudentId = 'student-test-uid'; 
    addResult(`🔄 교사 출석 기록 쓰기 시도 (대상 학생: ${someStudentId})...`);

    try {
        const dateKey = format(new Date(), 'yyyy-MM-dd');
        const attendanceRef = doc(firestore, 'centers', activeMembership.id, 'attendanceRecords', dateKey, 'students', someStudentId);
        
        const data = {
            status: 'confirmed_present',
            centerId: activeMembership.id,
            studentId: someStudentId,
            dateKey: dateKey,
            updatedAt: serverTimestamp(),
            confirmedByUserId: user.uid,
        };
        
        setDoc(attendanceRef, data, { merge: true })
            .then(() => {
                addResult('✅ 성공: 교사 출석 기록 생성');
            })
            .catch(serverError => {
                const contextualError = new FirestorePermissionError({
                    path: attendanceRef.path,
                    operation: 'write',
                    requestResourceData: data,
                });
                errorEmitter.emit('permission-error', contextualError);
                addResult(`❌ 실패 (교사 출석): ${contextualError.message}`);
            });
    } catch(e: any) {
        addResult(`❌ 실패 (교사 출석 - 예외): ${e.message}`);
    }
  }
  
  const renderStudentTests = () => (
    <div className="flex flex-col gap-2">
      <Button onClick={handleStudentWritePlan}>학생: 계획 항목 쓰기</Button>
      <Button onClick={handleStudentWriteLog}>학생: 학습 로그 쓰기</Button>
    </div>
  );

  const renderTeacherTests = () => (
     <div className="flex flex-col gap-2">
      <Button onClick={handleTeacherWriteAttendance}>교사/관리자: 출석 쓰기</Button>
    </div>
  );
  
  const renderAdminTests = () => (
    <div className="flex flex-col gap-2">
      <Button onClick={handleTeacherWriteAttendance}>교사/관리자: 출석 쓰기</Button>
    </div>
  );


  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>현재 세션 정보</CardTitle>
          <CardDescription>현재 로그인된 사용자와 활성 센터 멤버십 정보입니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><strong>UID:</strong> {user?.uid ?? 'N/A'}</p>
          <p><strong>이름:</strong> {user?.displayName ?? 'N/A'}</p>
          <p><strong>이메일:</strong> {user?.email ?? 'N/A'}</p>
          <hr className="my-2"/>
          <p><strong>센터 ID:</strong> {activeMembership?.id ?? 'N/A'}</p>
          <p><strong>역할:</strong> {activeMembership?.role ?? 'N/A'}</p>
          <p><strong>상태:</strong> {activeMembership?.status ?? 'N/A'}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>쓰기 권한 테스트</CardTitle>
          <CardDescription>역할에 맞는 버튼을 클릭하여 Firestore 쓰기 권한을 테스트하세요.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            {activeMembership?.role === 'student' && renderStudentTests()}
            {activeMembership?.role === 'teacher' && renderTeacherTests()}
            {activeMembership?.role === 'centerAdmin' && renderAdminTests()}
        </CardContent>
      </Card>
       <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>테스트 결과</CardTitle>
          <CardDescription>Firestore 작업의 성공 또는 실패 메시지가 여기에 표시됩니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            readOnly
            className="h-64 font-mono text-xs"
            value={results.join('\n')}
            placeholder="테스트 결과가 여기에 표시됩니다..."
          />
        </CardContent>
      </Card>
    </div>
  );
}