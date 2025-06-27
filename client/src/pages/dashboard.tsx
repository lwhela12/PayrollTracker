import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

import {
  Users,
  Clock,
  DollarSign,
  Plus,
  
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/lib/dateUtils";
import { formatCurrency } from "@/lib/payrollUtils";

export default function Dashboard() {
  const { user } = useAuth();
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
    queryFn: () => selectedEmployerId ? fetch(`/api/dashboard/stats/${selectedEmployerId}`, { credentials: 'include' }).then(res => res.json()) : Promise.resolve({}),
    enabled: !!selectedEmployerId,
  });

  const selectedEmployer = employers.find((emp: any) => emp.id === selectedEmployerId);
  const currentPayPeriod = dashboardStats?.currentPayPeriod;

  const [, setLocation] = useLocation();

  const handleNavigateToTimecard = (employeeId: number) => {
    const payPeriodQuery = currentPayPeriod ? `&payPeriod=${currentPayPeriod.id}` : "";
    if (selectedEmployerId) {
      setLocation(
        `/timecards?employer=${selectedEmployerId}&employee=${employeeId}${payPeriodQuery}`
      );
    } else {
      setLocation(`/timecards?employee=${employeeId}${payPeriodQuery}`);
    }
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
      value: dashboardStats?.pendingTimecards || 0,
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
      value: dashboardStats?.payrollReady || 0,
      icon: DollarSign,
      color: "bg-purple-500",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        selectedEmployer={selectedEmployer}
        currentPayPeriod={currentPayPeriod}
        user={user}
      />
      
      <div className="md:ml-64">
        <Header 
          title="Dashboard"
          description="Overview of your payroll management"
          user={user}
        />
        
        <main className="p-4 md:p-6 pt-16 md:pt-6">
          <div className="w-full">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
              {stats.map((stat, index) => (
                <Card key={index}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </CardTitle>
                    <div className={`p-2 rounded-md ${stat.color}`}>
                      <stat.icon className="h-4 w-4 text-white" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl md:text-2xl font-bold">{stat.value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
              {/* Pay Period Summary */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Pay Period Summary
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
                    <>
                      {/* Desktop Table */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="p-2 text-left">Employee</th>
                              <th className="p-2 text-right">Total Hours</th>
                              <th className="p-2 text-right">OT Hours</th>
                              <th className="p-2 text-right">PTO</th>
                              <th className="p-2 text-right">Mileage</th>
                              <th className="p-2 text-right">Reimbursements</th>
                            </tr>
                          </thead>
                          <tbody>
                            {employees.map((employee: any) => {
                              const stats = dashboardStats.employeeStats?.find((s: any) => s.employeeId === employee.id) || {};
                              return (
                                <tr
                                  key={employee.id}
                                  className="hover:bg-gray-50 cursor-pointer"
                                  onClick={() => handleNavigateToTimecard(employee.id)}
                                >
                                  <td className="p-2">
                                    <div className="font-medium">{employee.firstName} {employee.lastName}</div>
                                    <div className="text-xs text-muted-foreground">{employee.position}</div>
                                  </td>
                                  <td className="p-2 text-right">{stats.totalHours?.toFixed?.(2) ?? '0.00'}</td>
                                  <td className="p-2 text-right text-orange-600 font-medium">{stats.totalOvertimeHours?.toFixed?.(2) ?? '0.00'}</td>
                                  <td className="p-2 text-right">{stats.ptoHours?.toFixed?.(2) ?? '0.00'}h</td>
                                  <td className="p-2 text-right">{stats.mileage ?? 0} mi</td>
                                  <td className="p-2 text-right">{formatCurrency(stats.reimbursements || 0)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Cards */}
                      <div className="md:hidden space-y-3">
                        {employees.map((employee: any) => {
                          const stats = dashboardStats.employeeStats?.find((s: any) => s.employeeId === employee.id) || {};
                          return (
                            <Card 
                              key={employee.id} 
                              className="cursor-pointer hover:shadow-md transition-shadow"
                              onClick={() => handleNavigateToTimecard(employee.id)}
                            >
                              <CardContent className="p-4">
                                <div className="flex justify-between items-start mb-3">
                                  <div>
                                    <div className="font-medium">{employee.firstName} {employee.lastName}</div>
                                    <div className="text-xs text-muted-foreground">{employee.position}</div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-sm font-medium">{stats.totalHours?.toFixed?.(2) ?? '0.00'}h</div>
                                    <div className="text-xs text-muted-foreground">Total</div>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">OT:</span>
                                    <span className="text-orange-600 font-medium">{stats.totalOvertimeHours?.toFixed?.(2) ?? '0.00'}h</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">PTO:</span>
                                    <span>{stats.ptoHours?.toFixed?.(2) ?? '0.00'}h</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Miles:</span>
                                    <span>{stats.mileage ?? 0} mi</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Reimb:</span>
                                    <span>{formatCurrency(stats.reimbursements || 0)}</span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </>
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
          </div>
        </main>
      </div>
    </div>
  );
}