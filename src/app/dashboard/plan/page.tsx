import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { mockStudyPlan } from '@/lib/data';
import { PlusCircle } from 'lucide-react';

export default function StudyPlanPage() {
  return (
    <div className="grid flex-1 items-start gap-4">
      <Card>
        <CardHeader>
          <CardTitle>나의 학습 계획</CardTitle>
          <CardDescription>
            주간 목표와 과제입니다. 집중하고 진행 상황을 추적하세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            {mockStudyPlan.map((task) => (
              <div
                key={task.id}
                className="flex items-center space-x-4 rounded-md border p-4"
              >
                <Checkbox id={task.id} defaultChecked={task.done} />
                <Label
                  htmlFor={task.id}
                  className={`flex-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${
                    task.done ? 'line-through text-muted-foreground' : ''
                  }`}
                >
                  {task.title}
                </Label>
              </div>
            ))}
             <div
                className="flex items-center space-x-4 rounded-md border border-dashed p-4"
              >
                <PlusCircle className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">계획에 새 과제 추가하기</p>
              </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button className="ml-auto">변경사항 저장</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
