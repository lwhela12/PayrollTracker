import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/lib/dateUtils";
import { formatCurrency } from "@/lib/payrollUtils";
import { useCompany } from "@/context/company";
import { useTimecardUpdates } from "@/context/timecard-updates";
import {
  Users,
  Clock,
  DollarSign,
  Plus,
} from "lucide-react";

export default function Timecards() {
  const { user } = useAuth();
  const { employerId: selectedEmployerId, setEmployerId: setSelectedEmployerId } = useCompany();
  const { getEmployeeUpdate } = useTimecardUpdates();
  const [selectedPayPeriodId, setSelectedPayPeriodId] = useState<string>("");

  const { data: employers = [] } = useQuery<any[]>({
    queryKey: ["/api/employers"],
    enabled: !!user,
  });

  useEffect(() => {
    if (employers.length > 0 && selectedEmployerId == null) {
      setSelectedEmployerId(employers[0].id);
    }
  }, [employers, selectedEmployerId]);

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["/api/employees", selectedEmployerId],
    queryFn: () =>
      selectedEmployerId ? fetch(`/api/employees/${selectedEmployerId}`).then((r) => r.json()) : Promise.resolve([]),
    enabled: !!selectedEmployerId,
  });

  const { data: payPeriods = [] } = useQuery<any[]>({
    queryKey: ["/api/pay-periods/relevant", selectedEmployerId],
    queryFn: () =>
      selectedEmployerId
        ? fetch(`/api/pay-periods/${selectedEmployerId}/relevant`, { credentials: "include" }).then((r) => r.json())
        : Promise.resolve([]),
    enabled: !!selectedEmployerId,
  });

  // Fetch dashboard stats for the selected employer and pay period
  const { data: dashboardStats = {} } = useQuery<any>({
    queryKey: ["/api/dashboard/stats", selectedEmployerId, selectedPayPeriodId],
    queryFn: () => selectedEmployerId && selectedPayPeriodId ? fetch(`/api/dashboard/stats/${selectedEmployerId}?payPeriodId=${selectedPayPeriodId}`, { credentials: 'include' }).then(res => res.json()) : Promise.resolve({}),
    enabled: !!selectedEmployerId && !!selectedPayPeriodId,
  });

  const selectedEmployer = employers.find((e: any) => e.id === selectedEmployerId);
  const selectedPayPeriod = payPeriods.find((p: any) => p.id.toString() === selectedPayPeriodId);
  const currentPayPeriod = dashboardStats?.currentPayPeriod;

  useEffect(() => {
    if (payPeriods.length > 0 && !selectedPayPeriodId) {
      // Check if we have a saved pay period to restore
      const savedPayPeriodStart = sessionStorage.getItem('selected-pay-period-start');
      if (savedPayPeriodStart) {
        // Find the pay period that matches the saved start date
        const matchingPeriod = payPeriods.find(p => p.startDate === savedPayPeriodStart);
        if (matchingPeriod) {
          setSelectedPayPeriodId(matchingPeriod.id.toString());
          // Clear the saved period after restoring
          sessionStorage.removeItem('selected-pay-period-start');
          return;
        }
      }
      
      // Default behavior if no saved period or no match found
      const defaultPeriod = currentPayPeriod ?? payPeriods[0];
      setSelectedPayPeriodId(defaultPeriod.id.toString());
    }
  }, [payPeriods, currentPayPeriod, selectedPayPeriodId]);

  // Restore scroll position when returning from timecard form
  useEffect(() => {
    const savedScrollPosition = sessionStorage.getItem('timecards-scroll-position');
    if (savedScrollPosition) {
      const scrollTop = parseInt(savedScrollPosition, 10);
      // Use setTimeout to ensure DOM is fully rendered
      setTimeout(() => {
        window.scrollTo(0, scrollTop);
        // Clear the saved position after restoring
        sessionStorage.removeItem('timecards-scroll-position');
      }, 100);
    }
  }, []);

  const { data: timecards = [] } = useQuery<any[]>({
    queryKey: ["/api/timecards/pay-period", selectedPayPeriodId],
    queryFn: () =>
      selectedPayPeriodId ? fetch(`/api/timecards/pay-period/${selectedPayPeriodId}`, { credentials: "include" }).then((r) => r.json()) : Promise.resolve([]),
    enabled: !!selectedPayPeriodId,
  });

  const [, setLocation] = useLocation();

  const handleNavigateToTimecard = (employeeId: number) => {
    if (!selectedPayPeriod) return;
    
    // Save current scroll position
    sessionStorage.setItem('timecards-scroll-position', window.scrollY.toString());
    
    // Save selected pay period for restoration
    sessionStorage.setItem('selected-pay-period-start', selectedPayPeriod.startDate);
    
    setLocation(
      `/timecard/employee/${employeeId}/period/${selectedPayPeriod.startDate}`,
    );
  };

  const stats = [
    {
      title: "Total Employees",
      value: employees.length || 0,
      icon: Users,
      color: "bg-blue-500",
    },
    {
      title: "Unsaved Timecards",
      value: dashboardStats?.pendingTimecards || 0,
      icon: Clock,
      color: "bg-orange-500",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        selectedEmployer={selectedEmployer}
        currentPayPeriod={currentPayPeriod}
        user={user}
      />
      
      <div className="md:ml-48 min-h-screen">
        <Header 
          title="Dashboard"
          description="Employee timecard management and overview"
          user={user}
        />
        
        <main className="p-4 md:p-6">
          <div className="w-full">
            {/* Pay Period Selector */}
            {payPeriods.length > 0 && (
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Pay Period</label>
                <Select value={selectedPayPeriodId} onValueChange={setSelectedPayPeriodId}>
                  <SelectTrigger className="w-[300px]">
                    <SelectValue placeholder="Select a pay period" />
                  </SelectTrigger>
                  <SelectContent>
                    {payPeriods.map((pp: any, index: number) => (
                      <SelectItem key={pp.id} value={pp.id.toString()}>
                        {formatDate(pp.startDate)} - {formatDate(pp.endDate)}
                        {index === 0 && " (Current)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
                  {selectedPayPeriod && (
                    <Badge variant="outline" className="text-xs">
                      {formatDate(selectedPayPeriod.startDate)} - {formatDate(selectedPayPeriod.endDate)}
                    </Badge>
                  )}
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
                              <th className="p-2 text-right">Regular Hours</th>
                              <th className="p-2 text-right">OT Hours</th>
                              <th className="p-2 text-right">PTO</th>
                              <th className="p-2 text-right">Holiday</th>
                              <th className="p-2 text-right">Holiday Worked</th>
                              <th className="p-2 text-right">Mileage</th>
                              <th className="p-2 text-right">Reimbursements</th>
                            </tr>
                          </thead>
                          <tbody>
                            {employees.map((employee: any) => {
                              const stats = dashboardStats.employeeStats?.find((s: any) => s.employeeId === employee.id) || {};
                              const updates = getEmployeeUpdate(employee.id);

                              const handleMouseEnter = () => {
                                if (!selectedPayPeriod) return;
                                queryClient.prefetchQuery({
                                  queryKey: [
                                    "/api/time-entries/employee",
                                    employee.id,
                                    selectedPayPeriod.startDate,
                                    selectedPayPeriod.endDate,
                                  ],
                                  queryFn: () =>
                                    apiRequest(
                                      "GET",
                                      `/api/time-entries/employee/${employee.id}?start=${selectedPayPeriod.startDate}&end=${selectedPayPeriod.endDate}`,
                                    ).then((res) => res.json()),
                                });

                                queryClient.prefetchQuery({
                                  queryKey: ["/api/pto-entries/employee", employee.id],
                                  queryFn: () =>
                                    apiRequest("GET", `/api/pto-entries/employee/${employee.id}`).then((res) => res.json()),
                                });

                                queryClient.prefetchQuery({
                                  queryKey: ["/api/misc-hours-entries/employee", employee.id],
                                  queryFn: () =>
                                    apiRequest("GET", `/api/misc-hours-entries/employee/${employee.id}`).then((res) => res.json()),
                                });

                                queryClient.prefetchQuery({
                                  queryKey: ["/api/reimbursement-entries/employee", employee.id],
                                  queryFn: () =>
                                    apiRequest("GET", `/api/reimbursement-entries/employee/${employee.id}`).then((res) => res.json()),
                                });

                                queryClient.prefetchQuery({
                                  queryKey: ["/api/employees", employee.id],
                                  queryFn: () =>
                                    apiRequest("GET", `/api/employees/${employee.id}`).then((res) => res.json()),
                                });
                              };
                              
                              // Combine saved data with real-time updates
                              const displayStats = {
                                ...stats,
                                mileage: updates?.mileage ?? stats.mileage ?? 0,
                                reimbursements: updates?.reimbursement ?? stats.reimbursements ?? 0,
                                ptoHours: updates?.ptoHours ?? stats.ptoHours ?? 0,
                                holidayHours: updates?.holidayHours ?? stats.holidayHours ?? 0,
                                holidayWorkedHours: updates?.holidayWorkedHours ?? stats.holidayWorkedHours ?? 0
                              };
                              const regularHours =
                                (displayStats.totalHours ?? 0) -
                                (displayStats.totalOvertimeHours ?? 0);
                              
                              return (
                                <tr
                                  key={employee.id}
                                  className="hover:bg-gray-50 cursor-pointer"
                                  onMouseEnter={handleMouseEnter}
                                  onClick={() => handleNavigateToTimecard(employee.id)}
                                >
                                  <td className="p-2">
                                    <div className="font-medium">{employee.firstName} {employee.lastName}</div>
                                    <div className="text-xs text-muted-foreground">{employee.position}</div>
                                  </td>
                                  <td className="p-2 text-right">{regularHours.toFixed(2)}</td>
                                  <td className="p-2 text-right text-orange-600 font-medium">{displayStats.totalOvertimeHours?.toFixed?.(2) ?? '0.00'}</td>
                                  <td className="p-2 text-right">{displayStats.ptoHours?.toFixed?.(2) ?? '0.00'}h</td>
                                  <td className="p-2 text-right">{displayStats.holidayHours?.toFixed?.(2) ?? '0.00'}h</td>
                                  <td className="p-2 text-right">{displayStats.holidayWorkedHours?.toFixed?.(2) ?? '0.00'}h</td>
                                  <td className="p-2 text-right">{displayStats.mileage ?? 0} mi</td>
                                  <td className="p-2 text-right">{formatCurrency(displayStats.reimbursements || 0)}</td>
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
                          const updates = getEmployeeUpdate(employee.id);

                          const handleMouseEnter = () => {
                            if (!selectedPayPeriod) return;
                            queryClient.prefetchQuery({
                              queryKey: [
                                "/api/time-entries/employee",
                                employee.id,
                                selectedPayPeriod.startDate,
                                selectedPayPeriod.endDate,
                              ],
                              queryFn: () =>
                                apiRequest(
                                  "GET",
                                  `/api/time-entries/employee/${employee.id}?start=${selectedPayPeriod.startDate}&end=${selectedPayPeriod.endDate}`,
                                ).then((res) => res.json()),
                            });

                            queryClient.prefetchQuery({
                              queryKey: ["/api/pto-entries/employee", employee.id],
                              queryFn: () =>
                                apiRequest("GET", `/api/pto-entries/employee/${employee.id}`).then((res) => res.json()),
                            });

                            queryClient.prefetchQuery({
                              queryKey: ["/api/misc-hours-entries/employee", employee.id],
                              queryFn: () =>
                                apiRequest("GET", `/api/misc-hours-entries/employee/${employee.id}`).then((res) => res.json()),
                            });

                            queryClient.prefetchQuery({
                              queryKey: ["/api/reimbursement-entries/employee", employee.id],
                              queryFn: () =>
                                apiRequest("GET", `/api/reimbursement-entries/employee/${employee.id}`).then((res) => res.json()),
                            });

                            queryClient.prefetchQuery({
                              queryKey: ["/api/employees", employee.id],
                              queryFn: () =>
                                apiRequest("GET", `/api/employees/${employee.id}`).then((res) => res.json()),
                            });
                          };
                          
                          // Combine saved data with real-time updates
                          const displayStats = {
                            ...stats,
                            mileage: updates?.mileage ?? stats.mileage ?? 0,
                            reimbursements: updates?.reimbursement ?? stats.reimbursements ?? 0,
                            ptoHours: updates?.ptoHours ?? stats.ptoHours ?? 0,
                            holidayHours: updates?.holidayHours ?? stats.holidayHours ?? 0,
                            holidayWorkedHours: updates?.holidayWorkedHours ?? stats.holidayWorkedHours ?? 0
                          };
                          const regularHours =
                            (displayStats.totalHours ?? 0) -
                            (displayStats.totalOvertimeHours ?? 0);
                          
                          return (
                            <Card
                              key={employee.id}
                              className="cursor-pointer hover:shadow-md transition-shadow"
                              onMouseEnter={handleMouseEnter}
                              onClick={() => handleNavigateToTimecard(employee.id)}
                            >
                              <CardContent className="p-4">
                                <div className="flex justify-between items-start mb-3">
                                  <div>
                                    <div className="font-medium">{employee.firstName} {employee.lastName}</div>
                                    <div className="text-xs text-muted-foreground">{employee.position}</div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-sm font-medium">{displayStats.totalHours?.toFixed?.(2) ?? '0.00'}h</div>
                                    <div className="text-xs text-muted-foreground">Total</div>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Reg:</span>
                                    <span>{regularHours.toFixed(2)}h</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">OT:</span>
                                    <span className="text-orange-600 font-medium">{displayStats.totalOvertimeHours?.toFixed?.(2) ?? '0.00'}h</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">PTO:</span>
                                    <span>{displayStats.ptoHours?.toFixed?.(2) ?? '0.00'}h</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Holiday:</span>
                                    <span>{displayStats.holidayHours?.toFixed?.(2) ?? '0.00'}h</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Holiday Worked:</span>
                                    <span>{displayStats.holidayWorkedHours?.toFixed?.(2) ?? '0.00'}h</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Miles:</span>
                                    <span>{displayStats.mileage ?? 0} mi</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Reimb:</span>
                                    <span>{formatCurrency(displayStats.reimbursements || 0)}</span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No employees found. 
                      <Link href="/employees" className="text-primary hover:underline ml-1">
                        Add your first employee
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