'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { SharedRoutineDetail } from '@/components/dashboard/student-planner/shared-routine-detail';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAppContext } from '@/contexts/app-context';
import { useDoc, useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import {
  applyInteractionStateToRoutine,
  buildInitialRoutineSocialProfile,
  createRoutineInteractionStorageKey,
  createRoutineTemplateSaveRecord,
  findSharedRoutineById,
  readRoutineInteractionState,
  toggleRoutineInteraction,
  upsertSavedRoutineTemplate,
  writeRoutineInteractionState,
  buildProfileFromSharedRoutine,
  type RoutineSocialInteractionState,
} from '@/lib/routine-social';
import { buildInitialRoutineWorkspace } from '@/lib/routine-workspace';
import { type StudentProfile } from '@/lib/types';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

const emptyInteractionState: RoutineSocialInteractionState = {
  cheeredIds: [],
  referencedIds: [],
};

export default function SharedRoutineDetailPage() {
  const params = useParams<{ routineId: string }>();
  const routineId = Array.isArray(params?.routineId) ? params.routineId[0] : params?.routineId;
  const firestore = useFirestore();
  const { user } = useUser();
  const { activeMembership, activeStudentId } = useAppContext();
  const { toast } = useToast();
  const [interactionState, setInteractionState] = useState<RoutineSocialInteractionState>(emptyInteractionState);
  const studentUid = activeStudentId || user?.uid || null;

  const isStudent = activeMembership?.role === 'student';
  const studentProfileRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !studentUid) return null;
    return doc(firestore, 'centers', activeMembership.id, 'students', studentUid);
  }, [activeMembership, firestore, studentUid]);
  const { data: studentProfile, isLoading } = useDoc<StudentProfile>(studentProfileRef, { enabled: isStudent });

  const interactionStorageKey = useMemo(
    () => (user?.uid ? createRoutineInteractionStorageKey(user.uid) : ''),
    [user?.uid]
  );

  useEffect(() => {
    if (!interactionStorageKey) {
      setInteractionState(emptyInteractionState);
      return;
    }
    setInteractionState(readRoutineInteractionState(interactionStorageKey));
  }, [interactionStorageKey]);

  useEffect(() => {
    if (!interactionStorageKey) return;
    writeRoutineInteractionState(interactionStorageKey, interactionState);
  }, [interactionState, interactionStorageKey]);

  const socialProfile = useMemo(
    () =>
      buildInitialRoutineSocialProfile({
        studyProfile: studentProfile?.studyRoutineProfile,
        socialProfile: studentProfile?.routineSocialProfile,
        studentName: studentProfile?.name || activeMembership?.displayName || user?.displayName,
        gradeLabel: studentProfile?.grade,
      }),
    [
      activeMembership?.displayName,
      studentProfile?.grade,
      studentProfile?.name,
      studentProfile?.routineSocialProfile,
      studentProfile?.studyRoutineProfile,
      user?.displayName,
    ]
  );

  const sharedRoutine = useMemo(() => {
    if (!routineId) return null;
    const found = findSharedRoutineById(routineId, {
      studyProfile: studentProfile?.studyRoutineProfile,
      socialProfile,
      savedTemplates: studentProfile?.savedRoutineTemplates,
    });
    return found ? applyInteractionStateToRoutine(found, interactionState) : null;
  }, [interactionState, routineId, socialProfile, studentProfile?.savedRoutineTemplates, studentProfile?.studyRoutineProfile]);

  const handleApplyRoutine = async () => {
    if (!sharedRoutine || !studentProfileRef || !studentProfile?.studyRoutineProfile) {
      toast({
        variant: 'destructive',
        title: '먼저 내 루틴을 만들어주세요.',
        description: '온보딩 추천을 저장한 뒤 다른 루틴을 복사할 수 있어요.',
      });
      return;
    }

    const nextProfile = buildProfileFromSharedRoutine(studentProfile.studyRoutineProfile, sharedRoutine);
    const nextWorkspace = buildInitialRoutineWorkspace(nextProfile);
    const nextSavedTemplates = upsertSavedRoutineTemplate(
      studentProfile.savedRoutineTemplates,
      createRoutineTemplateSaveRecord(sharedRoutine, 'routine-detail')
    );

    await setDoc(
      studentProfileRef,
      {
        studyRoutineProfile: {
          ...nextProfile,
          updatedAt: serverTimestamp(),
        },
        studyRoutineWorkspace: {
          ...nextWorkspace,
          updatedAt: serverTimestamp(),
          lastOpenedAt: serverTimestamp(),
        },
        savedRoutineTemplates: nextSavedTemplates,
      },
      { merge: true }
    );

    toast({
      title: '내 루틴으로 저장했어요',
      description: '선택한 루틴이 오늘 루틴 홈으로 연결됩니다.',
    });
  };

  const handleSaveTemplate = async () => {
    if (!sharedRoutine || !studentProfileRef) return;
    const nextSavedTemplates = upsertSavedRoutineTemplate(
      studentProfile?.savedRoutineTemplates,
      createRoutineTemplateSaveRecord(sharedRoutine, 'routine-detail')
    );
    await setDoc(studentProfileRef, { savedRoutineTemplates: nextSavedTemplates }, { merge: true });
    toast({
      title: '참고 목록에 담았어요',
      description: '나중에 다시 보고 내 루틴에 복사할 수 있습니다.',
    });
  };

  const handleCheer = (targetRoutineId: string) => {
    if (!socialProfile.allowCheer) return;
    setInteractionState((current) => toggleRoutineInteraction(current, 'cheeredIds', targetRoutineId));
  };

  const handleReference = (targetRoutineId: string) => {
    setInteractionState((current) => toggleRoutineInteraction(current, 'referencedIds', targetRoutineId));
  };

  if (!isStudent) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <Card className="max-w-md rounded-[2rem]">
          <CardHeader>
            <CardTitle>학생 전용 화면</CardTitle>
            <CardDescription>루틴 상세는 학생 계정에서만 사용할 수 있어요.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  if (!sharedRoutine) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <Card className="max-w-md rounded-[2rem]">
          <CardContent className="space-y-2 p-6">
            <p className="text-[1.2rem] font-black tracking-[-0.03em] text-[#17326B]">루틴을 찾지 못했어요</p>
            <p className="text-[13px] font-semibold leading-6 text-[#5F7597]">
              공개 범위가 바뀌었거나, 참고 루틴이 더 이상 제공되지 않을 수 있어요.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <SharedRoutineDetail
      routine={sharedRoutine}
      onApplyRoutine={(_routine) => void handleApplyRoutine()}
      onSaveTemplate={(_routine) => void handleSaveTemplate()}
      onCheer={handleCheer}
      onReference={handleReference}
    />
  );
}
