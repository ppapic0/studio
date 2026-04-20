'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { RoutineExploreHome } from '@/components/dashboard/student-planner/routine-explore-home';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAppContext } from '@/contexts/app-context';
import { useDoc, useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import {
  applyInteractionStateToRoutine,
  buildInitialRoutineSocialProfile,
  buildProfileFromSharedRoutine,
  buildRoutineExploreSections,
  createRoutineInteractionStorageKey,
  createRoutineTemplateSaveRecord,
  readRoutineInteractionState,
  toggleRoutineInteraction,
  upsertSavedRoutineTemplate,
  writeRoutineInteractionState,
  type RoutineSocialInteractionState,
} from '@/lib/routine-social';
import { buildInitialRoutineWorkspace } from '@/lib/routine-workspace';
import { type SharedRoutine, type StudentProfile } from '@/lib/types';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

const emptyInteractionState: RoutineSocialInteractionState = {
  cheeredIds: [],
  referencedIds: [],
};

export default function PlanRoutineExplorePage() {
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

  const exploreData = useMemo(() => {
    const base = buildRoutineExploreSections({
      studyProfile: studentProfile?.studyRoutineProfile,
      socialProfile,
      savedTemplates: studentProfile?.savedRoutineTemplates,
    });

    return {
      sections: base.sections.map((section) => ({
        ...section,
        items: section.items.map((routine) => applyInteractionStateToRoutine(routine, interactionState)),
      })),
    };
  }, [interactionState, socialProfile, studentProfile?.savedRoutineTemplates, studentProfile?.studyRoutineProfile]);

  const handleApplyRoutine = async (sharedRoutine: SharedRoutine) => {
    if (!studentProfileRef || !studentProfile?.studyRoutineProfile) {
      toast({
        variant: 'destructive',
        title: '먼저 내 루틴을 만들어주세요.',
        description: '온보딩 추천을 저장한 뒤 루틴을 복사할 수 있어요.',
      });
      return;
    }

    const nextProfile = buildProfileFromSharedRoutine(studentProfile.studyRoutineProfile, sharedRoutine);
    const nextWorkspace = buildInitialRoutineWorkspace(nextProfile);
    const nextSavedTemplates = upsertSavedRoutineTemplate(
      studentProfile.savedRoutineTemplates,
      createRoutineTemplateSaveRecord(sharedRoutine, 'explore-home')
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
      description: '선택한 루틴이 오늘 루틴 홈에 바로 반영됩니다.',
    });
  };

  const handleCheerRoutine = (routineId: string) => {
    if (!socialProfile.allowCheer) return;
    setInteractionState((current) => toggleRoutineInteraction(current, 'cheeredIds', routineId));
  };

  if (!isStudent) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <Card className="max-w-md rounded-[2rem]">
          <CardHeader>
            <CardTitle>학생 전용 화면</CardTitle>
            <CardDescription>루틴 탐색은 학생 계정에서만 사용할 수 있어요.</CardDescription>
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

  return (
    <RoutineExploreHome
      studentName={studentProfile?.name || activeMembership?.displayName || user?.displayName || '학생'}
      currentVisibility={socialProfile.visibility}
      savedTemplateCount={studentProfile?.savedRoutineTemplates?.length || 0}
      sectionList={exploreData.sections}
      onApplyRoutine={(routine) => void handleApplyRoutine(routine)}
      onCheerRoutine={handleCheerRoutine}
    />
  );
}
