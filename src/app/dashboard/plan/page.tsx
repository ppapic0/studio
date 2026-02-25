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
          <CardTitle>My Study Plan</CardTitle>
          <CardDescription>
            Your weekly goals and tasks. Stay focused and track your progress.
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
                <p className="text-sm text-muted-foreground">Add a new task to your plan</p>
              </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button className="ml-auto">Save Changes</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
