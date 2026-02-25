import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { BarChart, Users, ClipboardCheck, TrendingUp, Armchair, AlertTriangle, CheckCircle, BarChart as RechartsBarChartIcon } from 'lucide-react';
import { ResponsiveContainer, BarChart as RechartsBarChart, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const monthlyStatsData = [
    { month: 'Jan', attendance: 92, completion: 85 },
    { month: 'Feb', attendance: 94, completion: 88 },
    { month: 'Mar', attendance: 91, completion: 82 },
    { month: 'Apr', attendance: 95, completion: 90 },
    { month: 'May', attendance: 96, completion: 91 },
    { month: 'Jun', attendance: 93, completion: 87 },
];

export function AdminDashboard() {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Attendance Rate</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">94.5%</div>
            <p className="text-xs text-muted-foreground">+1.2% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Plan Completion</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">88.2%</div>
            <p className="text-xs text-muted-foreground">+3.1% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Risk Student Count</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8</div>
            <p className="text-xs text-muted-foreground">-2 from last week</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Seat Utilization</CardTitle>
            <Armchair className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">92%</div>
            <p className="text-xs text-muted-foreground">115 / 125 seats filled</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
            <CardTitle>Monthly Center Performance</CardTitle>
            <CardDescription>Key metrics over the last 6 months.</CardDescription>
        </CardHeader>
        <CardContent>
            <ResponsiveContainer width="100%" height={350}>
                <RechartsBarChart data={monthlyStatsData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                 <XAxis
                  dataKey="month"
                  stroke="hsl(var(--foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="hsl(var(--foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted))' }}
                  contentStyle={{ 
                    background: 'hsl(var(--background))',
                    borderColor: 'hsl(var(--border))'
                  }}
                />
                <Bar dataKey="attendance" name="Attendance Rate" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completion" name="Completion Rate" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                </RechartsBarChart>
            </ResponsiveContainer>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
            <CardHeader>
                <CardTitle>Re-enrollment Projections</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-center">
                    <TrendingUp className="text-green-500 h-8 w-8 mr-4"/>
                    <div>
                        <div className="text-2xl font-bold">95%</div>
                        <div className="text-sm text-muted-foreground">Projected for next quarter</div>
                    </div>
                </div>
                 <p className="text-xs text-muted-foreground mt-4">Based on current renewal intent data.</p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle>Subscription Status</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-center">
                    <CheckCircle className="text-success-foreground h-8 w-8 mr-4" style={{color: 'hsl(var(--chart-3))'}} />
                    <div>
                        <div className="text-2xl font-bold">Pro Tier</div>
                        <div className="text-sm text-muted-foreground">Expires in 45 days</div>
                    </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4">Max Students: 150, Max Teachers: 10</p>
            </CardContent>
        </Card>
      </div>
    </>
  );
}