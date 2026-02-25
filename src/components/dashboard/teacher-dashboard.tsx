import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { mockAtRiskStudents, mockAttendance } from '@/lib/data';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import Link from 'next/link';
import { ArrowUpRight, UserCheck, UserX } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

export function TeacherDashboard() {
  const missingAttendance = mockAttendance.filter(a => a.status === 'Absent' || a.status === 'Late').slice(0, 3);
  return (
    <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2">
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Students</CardDescription>
            <CardTitle className="text-4xl">125</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              +5 since last month
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>At-Risk Students</CardDescription>
            <CardTitle className="text-4xl text-destructive-foreground dark:text-destructive">
              {mockAtRiskStudents.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              -1 from last week
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Attendance Today</CardDescription>
            <CardTitle className="text-4xl">96%</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              {mockAttendance.filter(a => a.status !== 'Present').length} absent/late
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Interventions</CardDescription>
            <CardTitle className="text-4xl">5</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              Pending review
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center">
            <div className="grid gap-2">
                <CardTitle>AI-Identified At-Risk Students</CardTitle>
                <CardDescription>
                Students showing signs of disengagement or underperformance.
                </CardDescription>
            </div>
            <Button asChild size="sm" className="ml-auto gap-1">
                <Link href="#">
                View All
                <ArrowUpRight className="h-4 w-4" />
                </Link>
            </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Risk Factor</TableHead>
                <TableHead className="hidden md:table-cell">Reason</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockAtRiskStudents.map(({ student, risk, reason }) => (
                <TableRow key={student.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="hidden h-9 w-9 sm:flex">
                        <AvatarImage src={student.avatarUrl} alt="Avatar" />
                        <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="font-medium">{student.name}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-destructive text-destructive-foreground dark:text-destructive">
                      {risk}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {reason}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">
                      Intervene
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
            <CardHeader className="flex flex-row items-center">
                <div className="grid gap-2">
                    <CardTitle>Missing Attendance</CardTitle>
                    <CardDescription>
                    Students marked absent or late today.
                    </CardDescription>
                </div>
                 <Button asChild size="sm" className="ml-auto gap-1">
                    <Link href="/dashboard/attendance">
                    Go to Attendance
                    <ArrowUpRight className="h-4 w-4" />
                    </Link>
                </Button>
            </CardHeader>
            <CardContent>
                {missingAttendance.map(student => (
                    <div key={student.id} className="flex items-center gap-4 mb-4">
                        <Avatar className="hidden h-9 w-9 sm:flex">
                        <AvatarImage src={student.avatarUrl} alt="Avatar" />
                        <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                        <div className="grid gap-1">
                            <p className="text-sm font-medium leading-none">{student.name}</p>
                            <p className="text-sm text-muted-foreground">{student.status}</p>
                        </div>
                        <div className="ml-auto font-medium">
                            <Button variant="outline" size="sm">Adjust</Button>
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
        <Card>
             <CardHeader>
                <CardTitle>Intervention Queue</CardTitle>
                <CardDescription>
                AI-suggested interventions awaiting your review.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
                <Alert className="alert-warning">
                    <UserX className="h-4 w-4" />
                    <AlertTitle>Low Completion</AlertTitle>
                    <AlertDescription>
                        <strong>Chloe Kim:</strong> Suggest simplifying study plan.
                    </AlertDescription>
                </Alert>
                 <Alert className="alert-warning">
                    <UserX className="h-4 w-4" />
                    <AlertTitle>High Absence</AlertTitle>
                    <AlertDescription>
                       <strong>Leo Martinez:</strong> Recommend a check-in conversation.
                    </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
      </div>

    </div>
  );
}
