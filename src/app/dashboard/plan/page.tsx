'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { PlusCircle, Loader2 } from 'lucide-react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, serverTimestamp, query, orderBy, addDoc, updateDoc, doc } from 'firebase/firestore';
import { format, getISOWeek } from 'date-fns';
import { type StudyPlanItem, type WithId } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function StudyPlanPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership } = useAppContext();

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isStudent = activeMembership?.role === 'student';
  const weekKey = `${format(new Date(), 'yyyy')}-W${getISOWeek(new Date())}`;

  const planItemsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !activeMembership) return null;
    return query(
      collection(
        firestore,
        'centers',
        activeMembership.id,
        'plans',
        user.uid,
        'weeks',
        weekKey,
        'items'
      ),
      orderBy('createdAt', 'asc')
    );
  }, [firestore, user, activeMembership, weekKey]);

  const { data: studyPlan, isLoading } = useCollection<StudyPlanItem>(planItemsQuery, { enabled: isStudent });

  const handleToggleTask = async (item: WithId<StudyPlanItem>) => {
    if (!firestore || !user || !activeMembership || !isStudent) return;
    const itemRef = doc(
      firestore,
      'centers',
      activeMembership.id,
      'plans',
      user.uid,
      'weeks',
      weekKey,
      'items',
      item.id
    );
    await updateDoc(itemRef, {
      done: !item.done,
      doneAt: !item.done ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
    });
  };

  const handleAddTask = async () => {
    if (!firestore || !user || !activeMembership || !newTaskTitle.trim() || !isStudent) return;
    
    setIsSubmitting(true);
    const itemsCollectionRef = collection(
      firestore,
      'centers',
      activeMembership.id,
      'plans',
      user.uid,
      'weeks',
      weekKey,
      'items'
    );
    
    try {
      await addDoc(itemsCollectionRef, {
        title: newTaskTitle,
        done: false,
        weight: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        studyPlanWeekId: weekKey,
        centerId: activeMembership.id,
        uid: user.uid,
      });
      setNewTaskTitle('');
    } catch (error) {
      console.error("Error adding new task:", error);
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="flex-1 w-full max-w-4xl mx-auto p-0 sm:p-2">
      <Card className="border-none sm:border shadow-none sm:shadow-sm">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-2xl font-bold">나의 학습 계획</CardTitle>
          <CardDescription className="text-sm">
            이번 주 목표와 과제입니다. 진행 상황을 체크해 보세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {!isStudent ? (
             <Alert variant="warning">
              <AlertTitle>학생 전용 페이지</AlertTitle>
              <AlertDescription>
                학생 계정으로 로그인해야 학습 계획을 관리할 수 있습니다.
              </AlertDescription>
            </Alert>
          ) : (
          <div className="grid gap-4 sm:gap-6 mt-4">
            {isLoading && (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
            {!isLoading && studyPlan?.map((task) => (
              <div
                key={task.id}
                className="flex items-center space-x-4 rounded-xl border p-4 sm:p-5 hover:bg-muted/30 transition-all group"
              >
                <Checkbox
                  id={task.id}
                  checked={task.done}
                  onCheckedChange={() => handleToggleTask(task)}
                  className="h-5 w-5 rounded-md"
                />
                <Label
                  htmlFor={task.id}
                  className={`flex-1 text-base sm:text-lg font-medium cursor-pointer transition-colors ${
                    task.done ? 'line-through text-muted-foreground' : 'text-foreground'
                  }`}
                >
                  {task.title}
                </Label>
              </div>
            ))}
             <div
                className="flex items-center space-x-3 rounded-xl border border-dashed p-3 sm:p-4 bg-muted/20"
              >
                <PlusCircle className="h-5 w-5 text-muted-foreground shrink-0" />
                <Input 
                  placeholder='새 과제 추가 (엔터 키 입력)'
                  className='border-0 shadow-none focus-visible:ring-0 text-sm sm:text-base bg-transparent px-0'
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                  disabled={isSubmitting}
                />
                <Button onClick={handleAddTask} size="sm" disabled={isSubmitting || !newTaskTitle.trim()} className="h-8">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin"/> : '추가'}
                </Button>
              </div>
          </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}