import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { TimecardModal } from "@/components/timecard-modal";
import { Badge } from "@/components/ui/badge";
import { Calendar, Search, Plus, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/lib/dateUtils";

export default function Timecards() {
  const { user } = useAuth();
  const [selectedEmployerId, setSelectedEmployerId] = useState<number | null>(null);
  const [selectedPayPeriodId, setSelectedPayPeriodId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTimecard, setSelectedTimecard] = useState<any>(null);
  const [showTimecardModal, setShowTimecardModal] = useState(false);

  // Fetch employers
  const { data: employers } = useQuery({
    queryKey: ["/api/employers"],
    enabled: !!user,
  });

  // Set first employer as default
  useState(() => {
    if (employers && employers.length > 0 && !selectedEmployerId) {
      setSelectedEmployerId(employers[0].id);
    }
  });

  // Fetch pay periods
  const { data: payPeriods } = useQuery({
    queryKey: ["/api/pay-periods", selectedEmployerId],
    enabled: !!selectedEmployerId,
  });

  // Set current pay period as default
  useState(() => {
    if (payPeriods && payPeriods.length > 0 && !selectedPayPeriodId) {
      const current = payPeriods.find((pp: any) => pp.isActive) || payPeriods[0];
      setSelectedPayPeriodId(current.id);
    }
  });

  // Fetch employees
  const { data: employees } = useQuery({
    queryKey: ["/api/employees", selectedEmployerId],
    enabled: !!selectedEmployerId,
  });

  // Fetch timecards for selected pay period
  const { data: timecards, isLoading: timecardsLoading } = useQuery({
    queryKey: ["/api/timecards/pay-period", selectedPayPeriodId],
    enabled: !!selectedPayPeriodId,
  });

  // Group timecards by employee
  const employeeTimecards = new Map();
  if (timecards && employees) {
    employees.forEach((emp: any) => {
      employeeTimecards.set(emp.id, {
        employee: emp,
        timecards: timecards.filter((tc: any) => tc.employeeId === emp.id),
      });
    });
  }

  // Filter employees based on search
  const filteredEmployeeIds = employees?.filter((emp: any) =>
    `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase())
  ).map((emp: any) => emp.id) || [];

  const getTimecardStatus = (employeeTimecards: any[]) => {
    if (employeeTimecards.length === 0) {
      return { status: "missing", label: "Missing", icon: AlertTriangle, variant: "destructive" };
    }
    
    const hasUnapproved = employeeTimecards.some(tc => !tc.isApproved);
    if (hasUnapproved) {
      return { status: "pending", label: "Pending", icon: Clock, variant: "secondary" };
    }
    
    return { status: "complete", label: "Complete", icon: CheckCircle, variant: "default" };
  };

  const calculateTotalHours = (employeeTimecards: any[]) => {
    return employeeTimecards.reduce((total, tc) => {
      return total + parseFloat(tc.regularHours || '0') + parseFloat(tc.overtimeHours || '0');
    }, 0);
  };

  const handleViewTimecard = (employeeData: any) => {
    const selectedPayPeriod = payPeriods?.find((pp: any) => pp.id === selectedPayPeriodId);
    setSelectedTimecard({
      employee: employeeData.employee,
      timecards: employeeData.timecards,
      payPeriod: selectedPayPeriod,
    });
    setShowTimecardModal(true);
  };

  if (!employers || employers.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="payroll-card max-w-md mx-4">
          <CardHeader>
            <CardTitle>No Company Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              You need to set up your company profile first.
            </p>
            <Button className="payroll-button-primary w-full">
              Create Company Profile
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedEmployer = employers.find((emp: any) => emp.id === selectedEmployerId);
  const selectedPayPeriod = payPeriods?.find((pp: any) => pp.id === selectedPayPeriodId);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar selectedEmployer={selectedEmployer} currentPayPeriod={selectedPayPeriod} />
      
      <div className="flex-1 overflow-hidden">
        <Header 
          title="Timecard Management"
          description="Review and manage employee timecards"
          user={user}
        />

        <div className="p-6 overflow-y-auto h-full">
          {/* Filters */}
          <Card className="payroll-card mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Input
                      placeholder="Search employees..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="w-64">
                  <Select 
                    value={selectedPayPeriodId?.toString()}
                    onValueChange={(value) => setSelectedPayPeriodId(parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select pay period" />
                    </SelectTrigger>
                    <SelectContent>
                      {payPeriods?.map((pp: any) => (
                        <SelectItem key={pp.id} value={pp.id.toString()}>
                          {formatDate(pp.startDate)} - {formatDate(pp.endDate)}
                          {pp.isActive && " (Current)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="payroll-button-primary">
                  <Plus className="h-4 w-4 mr-2" />
                  New Entry
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Timecard Overview */}
          <Card className="payroll-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Timecard Overview
                </CardTitle>
                {selectedPayPeriod && (
                  <Badge variant="outline">
                    {formatDate(selectedPayPeriod.startDate)} - {formatDate(selectedPayPeriod.endDate)}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="payroll-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Status</th>
                      <th>Total Hours</th>
                      <th>Regular Hours</th>
                      <th>Overtime Hours</th>
                      <th>Total Miles</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timecardsLoading ? (
                      <tr>
                        <td colSpan={8} className="text-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                        </td>
                      </tr>
                    ) : (
                      Array.from(employeeTimecards.entries())
                        .filter(([employeeId]) => 
                          searchTerm === "" || filteredEmployeeIds.includes(employeeId)
                        )
                        .map(([employeeId, data]: [number, any]) => {
                          const status = getTimecardStatus(data.timecards);
                          const totalHours = calculateTotalHours(data.timecards);
                          const regularHours = data.timecards.reduce((sum: number, tc: any) => 
                            sum + parseFloat(tc.regularHours || '0'), 0
                          );
                          const overtimeHours = data.timecards.reduce((sum: number, tc: any) => 
                            sum + parseFloat(tc.overtimeHours || '0'), 0
                          );
                          const totalMiles = data.timecards.reduce((sum: number, tc: any) => 
                            sum + parseInt(tc.totalMiles || '0'), 0
                          );
                          const StatusIcon = status.icon;

                          return (
                            <tr key={employeeId}>
                              <td>
                                <div>
                                  <div className="font-medium">
                                    {data.employee.firstName} {data.employee.lastName}
                                  </div>
                                  <div className="text-muted-foreground text-sm">
                                    {data.employee.employeeId}
                                  </div>
                                </div>
                              </td>
                              <td>{data.employee.department || "N/A"}</td>
                              <td>
                                <Badge variant={status.variant} className={`status-badge status-${status.status}`}>
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {status.label}
                                </Badge>
                              </td>
                              <td className="font-medium">{totalHours.toFixed(1)}</td>
                              <td>{regularHours.toFixed(1)}</td>
                              <td>{overtimeHours.toFixed(1)}</td>
                              <td>{totalMiles}</td>
                              <td>
                                <div className="flex space-x-2">
                                  <Button
                                    variant="link"
                                    size="sm"
                                    onClick={() => handleViewTimecard(data)}
                                    className="text-primary hover:text-primary/80"
                                  >
                                    View Details
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Timecard Modal */}
      {showTimecardModal && selectedTimecard && (
        <TimecardModal
          isOpen={showTimecardModal}
          onClose={() => setShowTimecardModal(false)}
          employee={selectedTimecard.employee}
          timecards={selectedTimecard.timecards}
          payPeriod={selectedTimecard.payPeriod}
        />
      )}
    </div>
  );
}
