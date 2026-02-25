import { Button } from '@/components/ui/button';
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
import { Badge } from '@/components/ui/badge';
import { mockInviteCodes } from '@/lib/data';
import { PlusCircle } from 'lucide-react';

export default function InviteCodesPage() {
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'Active':
        return 'default';
      case 'Expired':
        return 'destructive';
      case 'Exhausted':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Invite Codes</CardTitle>
          <CardDescription>
            Manage invite codes for onboarding new members.
          </CardDescription>
        </div>
        <Button size="sm" className="gap-1">
          <PlusCircle className="h-4 w-4" />
          Generate New Code
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Uses</TableHead>
              <TableHead>Expires At</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockInviteCodes.map((invite) => (
              <TableRow key={invite.code}>
                <TableCell className="font-mono">{invite.code}</TableCell>
                <TableCell>{invite.role}</TableCell>
                <TableCell>{invite.uses}</TableCell>
                <TableCell>{invite.expires}</TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(invite.status) as any}>
                    {invite.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
