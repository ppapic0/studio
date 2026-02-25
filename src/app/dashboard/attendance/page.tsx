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
import { mockAttendance } from '@/lib/data';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';

export default function AttendancePage() {
  const today = format(new Date(), 'MMMM dd, yyyy');

  const getBadgeVariant = (status: string) => {
    switch (status) {
      case 'Present':
        return 'default';
      case 'Absent':
        return 'destructive';
      case 'Late':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Student Attendance</CardTitle>
        <CardDescription>
          Manage and review attendance for {today}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Check-in Time</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockAttendance.map((student) => (
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
                  <Badge variant={getBadgeVariant(student.status) as any}>
                    {student.status}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {student.status === 'Present' || student.status === 'Late'
                    ? '9:05 AM'
                    : 'N/A'}
                </TableCell>
                <TableCell>
                  <Select defaultValue={student.status}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Set status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Present">Present</SelectItem>
                      <SelectItem value="Late">Late</SelectItem>
                      <SelectItem value="Absent">Absent</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
