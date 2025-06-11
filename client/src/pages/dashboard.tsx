import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { 
  Users, 
  Clock, 
  DollarSign, 
  FileText, 
  Plus,
  Calendar,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatDate, getPayPeriodProgress } from "@/lib/dateUtils";
import { formatCurrency } from "@/lib/payrollUtils";

export default function Dashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [selectedEmployerId, setSelectedEmployerId] = useState<number | null>(null);

  // Fetch employers
  const { data: employers = [] } = useQuery<any[]>({
    queryKey: ["/api/employers"],
    enabled: !!user,
  });

  // Set first employer as default
  useEffect(() => {
    if (employers.length > 0 && !selectedEmployerId) {
      setSelectedEmployerId(employers[0].id);
    }
  }, [employers, selectedEmployerId]);

  // Fetch employees for selected employer
  const { data: employees = [] } = useQuery({
    queryKey: ["/api/employees", selectedEmployerId],
    queryFn: () => selectedEmployerId ? fetch(`/api/employees/${selectedEmployerId}`, { credentials: 'include' }).then(res => res.json()) : Promise.resolve([]),
    enabled: !!selectedEmployerId,
  });

  // Fetch dashboard stats
  const { data: dashboardStats = {} } = useQuery<any>({
    queryKey: ["/api/dashboard/stats", selectedEmployerId],
    enabled: !!selectedEmployerId,
  });

  // Fetch timecards for current pay period
  const { data: timecards = [] } = useQuery<any[]>({
    queryKey: ["/api/timecards", dashboardStats?.currentPayPeriod?.id],
    queryFn: () => dashboardStats?.currentPayPeriod?.id ? 
      fetch(`/api/timecards/pay-period/${dashboardStats.currentPayPeriod.id}`, { credentials: 'include' }).then(res => res.json()) : 
      Promise.resolve([]),
    enabled: !!dashboardStats?.currentPayPeriod?.id,
  });

  const selectedEmployer = employers.find((emp: any) => emp.id === selectedEmployerId);
  const currentPayPeriod = dashboardStats?.currentPayPeriod;

  // Calculate timecard status for each employee
  const getEmployeeTimecardStatus = (employeeId: number) => {
    const employeeTimecards = timecards.filter((tc: any) => tc.employeeId === employeeId);
    if (employeeTimecards.length === 0) return "missing";
    
    // Check if employee has timecards for current pay period
    const hasRecentTimecard = employeeTimecards.some((tc: any) => {
      const timecardDate = new Date(tc.workDate);
      const payPeriodStart = new Date(currentPayPeriod?.startDate);
      const payPeriodEnd = new Date(currentPayPeriod?.endDate);
      return timecardDate >= payPeriodStart && timecardDate <= payPeriodEnd;
    });
    
    return hasRecentTimecard ? "complete" : "partial";
  };

  const handleNavigateToTimecard = (employeeId: number) => {
    navigate(`/timecards?employee=${employeeId}`);
  };

  const stats = [
    {
      title: "Total Employees",
      value: employees.length || 0,
      icon: Users,
      color: "bg-blue-500",
    },
    {
      title: "Pending Timecards",
      value: employees.filter((emp: any) => getEmployeeTimecardStatus(emp.id) !== "complete").length || 0,
      icon: Clock,
      color: "bg-orange-500",
    },
    {
      title: "Total Hours",
      value: dashboardStats?.totalHours || 0,
      icon: Clock,
      color: "bg-green-500",
    },
    {
      title: "Payroll Ready",
      value: dashboardStats?.payrollReady ? "Yes" : "No",
      icon: DollarSign,
      color: "bg-purple-500",
    },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar 
        selectedEmployer={selectedEmployer} 
        currentPayPeriod={currentPayPeriod}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="Dashboard"
          description="Overview of your payroll management"
          user={user}
        />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {stats.map((stat, index) => (
                <Card key={index}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </CardTitle>
                    <div className={`p-2 rounded-md ${stat.color}`}>
                      <stat.icon className="h-4 w-4 text-white" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Current Pay Period */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Current Pay Period
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {currentPayPeriod ? (
                    <div className="space-y-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Period:</span>
                        <span className="font-medium">
                          {formatDate(currentPayPeriod.startDate)} - {formatDate(currentPayPeriod.endDate)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Pay Date:</span>
                        <span className="font-medium">{formatDate(currentPayPeriod.payDate)}</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Progress:</span>
                          <span className="font-medium">
                            {getPayPeriodProgress(currentPayPeriod.startDate, currentPayPeriod.endDate).percentage}%
                          </span>
                        </div>
                        <Progress 
                          value={getPayPeriodProgress(currentPayPeriod.startDate, currentPayPeriod.endDate).percentage} 
                          className="h-2" 
                        />
                      </div>
                      <Badge variant={currentPayPeriod.status === 'active' ? 'default' : 'secondary'}>
                        {currentPayPeriod.status}
                      </Badge>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground mb-4">No active pay period found</p>
                      <Link href="/timecards">
                        <Button size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Create Pay Period
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Timecard Entry */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Quick Timecard Entry
                  </CardTitle>
                  <Link href="/employees">
                    <Button size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Employee
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {employees.length > 0 ? (
                    <div className="space-y-3">
                      {employees.map((employee: any) => {
                        const status = getEmployeeTimecardStatus(employee.id);
                        return (
                          <div
                            key={employee.id}
                            className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                            onClick={() => handleNavigateToTimecard(employee.id)}
                          >
                            <div className="flex items-center space-x-3">
                              <div className="flex-1">
                                <p className="font-medium">
                                  {employee.firstName} {employee.lastName}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {employee.position}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              {status === "complete" ? (
                                <Badge variant="default" className="bg-green-100 text-green-800">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Complete
                                </Badge>
                              ) : status === "partial" ? (
                                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Partial
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="bg-red-100 text-red-800">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Missing
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground mb-4">No employees found</p>
                      <Link href="/employees">
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          Add First Employee
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {timecards.slice(0, 5).map((timecard: any, index: number) => {
                    const employee = employees.find((emp: any) => emp.id === timecard.employeeId);
                    return (
                      <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0">
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <div>
                            <p className="font-medium">
                              {employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown Employee'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Submitted timecard for {formatDate(timecard.workDate)}
                            </p>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {timecard.regularHours + timecard.overtimeHours}h
                        </div>
                      </div>
                    );
                  })}
                  {timecards.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      No recent timecard activity
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}