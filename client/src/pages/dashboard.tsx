import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { TimecardForm } from "@/components/timecard-form";
import { TimecardModal } from "@/components/timecard-modal";
import { EmployerForm } from "@/components/employer-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, Timer, CheckCircle, FileText, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedEmployerId, setSelectedEmployerId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTimecard, setSelectedTimecard] = useState<any>(null);
  const [showTimecardModal, setShowTimecardModal] = useState(false);
  const [employerDialogOpen, setEmployerDialogOpen] = useState(false);

  // Fetch employers
  const { data: employers, isLoading: employersLoading } = useQuery({
    queryKey: ["/api/employers"],
    enabled: !!user,
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
      }
    },
  });

  // Set first employer as default
  useEffect(() => {
    if (employers && employers.length > 0 && !selectedEmployerId) {
      setSelectedEmployerId(employers[0].id);
    }
  }, [employers, selectedEmployerId]);

  // Fetch employees for selected employer
  const { data: employees, isLoading: employeesLoading } = useQuery({
    queryKey: ["/api/employees", selectedEmployerId],
    enabled: !!selectedEmployerId,
  });

  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/dashboard/stats", selectedEmployerId],
    enabled: !!selectedEmployerId,
  });

  // Filter employees based on search
  const filteredEmployees = employees?.filter((emp: any) =>
    `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleViewTimecard = async (employee: any) => {
    if (stats?.currentPayPeriod) {
      try {
        const response = await fetch(`/api/timecards/employee/${employee.id}?payPeriodId=${stats.currentPayPeriod.id}`, {
          credentials: "include",
        });
        const timecards = await response.json();
        setSelectedTimecard({ employee, timecards, payPeriod: stats.currentPayPeriod });
        setShowTimecardModal(true);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load timecard data",
          variant: "destructive",
        });
      }
    }
  };

  if (employersLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!employers || employers.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="payroll-card max-w-md mx-4">
          <CardHeader>
            <CardTitle>Welcome to PayTracker Pro</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              You need to set up your company profile first.
            </p>
            <p className="text-xs text-red-500 mb-2">
              Debug: Dialog state = {employerDialogOpen ? 'true' : 'false'}
            </p>
            <Button 
              className="payroll-button-primary w-full"
              onClick={() => {
                console.log("Create Company Profile button clicked");
                setEmployerDialogOpen(true);
                console.log("Dialog state set to true");
              }}
            >
              Create Company Profile
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedEmployer = employers.find((emp: any) => emp.id === selectedEmployerId);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar 
        selectedEmployer={selectedEmployer}
        currentPayPeriod={stats?.currentPayPeriod}
      />
      
      <div className="flex-1 overflow-hidden">
        <Header 
          title="Dashboard"
          description="Manage your payroll tracking and reporting"
          user={user}
        />

        <div className="p-6 overflow-y-auto h-full">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="payroll-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Employees</p>
                    <p className="text-2xl font-bold">
                      {statsLoading ? "..." : stats?.totalEmployees || 0}
                    </p>
                  </div>
                  <div className="bg-primary/10 p-3 rounded-lg">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="payroll-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Timecards Pending</p>
                    <p className="text-2xl font-bold text-accent">
                      {statsLoading ? "..." : stats?.pendingTimecards || 0}
                    </p>
                  </div>
                  <div className="bg-accent/10 p-3 rounded-lg">
                    <Clock className="h-6 w-6 text-accent" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="payroll-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Hours (Period)</p>
                    <p className="text-2xl font-bold text-secondary">
                      {statsLoading ? "..." : stats?.totalHours || "0.0"}
                    </p>
                  </div>
                  <div className="bg-secondary/10 p-3 rounded-lg">
                    <Timer className="h-6 w-6 text-secondary" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="payroll-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Payroll Ready</p>
                    <p className="text-2xl font-bold text-secondary">
                      {statsLoading ? "..." : stats?.payrollReady || 0}
                    </p>
                  </div>
                  <div className="bg-secondary/10 p-3 rounded-lg">
                    <CheckCircle className="h-6 w-6 text-secondary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Employee Roster Section */}
          <Card className="payroll-card mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Employee Roster</CardTitle>
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <Input
                      placeholder="Search employees..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-64"
                    />
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                  <Button className="payroll-button-primary">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Employee
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="payroll-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Timecard Status</th>
                      <th>Hours This Period</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeesLoading ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                        </td>
                      </tr>
                    ) : filteredEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-muted-foreground">
                          {searchTerm ? "No employees found matching your search." : "No employees added yet."}
                        </td>
                      </tr>
                    ) : (
                      filteredEmployees.map((employee: any) => (
                        <tr key={employee.id}>
                          <td>
                            <div>
                              <div className="font-medium">
                                {employee.firstName} {employee.lastName}
                              </div>
                              <div className="text-muted-foreground text-sm">
                                {employee.employeeId}
                              </div>
                            </div>
                          </td>
                          <td>{employee.department || "N/A"}</td>
                          <td>
                            <Badge variant="secondary" className="status-badge status-pending">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                          </td>
                          <td>0.0</td>
                          <td>
                            <div className="flex space-x-2">
                              <Button
                                variant="link"
                                size="sm"
                                onClick={() => handleViewTimecard(employee)}
                                className="text-primary hover:text-primary/80"
                              >
                                View
                              </Button>
                              <Button
                                variant="link"
                                size="sm"
                                className="text-muted-foreground hover:text-foreground"
                              >
                                Edit
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TimecardForm 
              employees={employees || []}
              currentPayPeriod={stats?.currentPayPeriod}
            />
            
            <Card className="payroll-card">
              <CardHeader>
                <CardTitle>Generate Reports</CardTitle>
                <p className="text-sm text-muted-foreground">Export payroll data for processing</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="mb-4 p-4 bg-muted/30 rounded-lg border-2 border-dashed border-border">
                  <FileText className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground text-center">
                    Professional payroll reports ready for export
                  </p>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Report Type</label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose report type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="payroll_summary">Payroll Summary Report</SelectItem>
                        <SelectItem value="detailed_timecard">Detailed Timecard Report</SelectItem>
                        <SelectItem value="employee_hours">Employee Hours Report</SelectItem>
                        <SelectItem value="mileage_reimbursement">Mileage & Reimbursement Report</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Pay Period</label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select pay period" />
                      </SelectTrigger>
                      <SelectContent>
                        {stats?.currentPayPeriod && (
                          <SelectItem value={stats.currentPayPeriod.id.toString()}>
                            Current Period ({stats.currentPayPeriod.startDate} - {stats.currentPayPeriod.endDate})
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 pt-4">
                    <Button className="payroll-button-secondary flex items-center justify-center">
                      <FileText className="h-4 w-4 mr-2" />
                      Generate PDF
                    </Button>
                    <Button className="payroll-button-primary flex items-center justify-center">
                      <FileText className="h-4 w-4 mr-2" />
                      Export Excel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
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

      {/* Employer Creation Dialog */}
      {employerDialogOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-semibold mb-4">Create Company Profile</h2>
            <EmployerForm
              onSuccess={() => {
                console.log("Employer form success");
                setEmployerDialogOpen(false);
              }}
              onCancel={() => {
                console.log("Employer form cancelled");
                setEmployerDialogOpen(false);
              }}
            />
          </div>
        </div>
      )}
      
      <Dialog 
        open={employerDialogOpen} 
        onOpenChange={(open) => {
          console.log("Dialog open state changed to:", open);
          setEmployerDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Company Profile</DialogTitle>
          </DialogHeader>
          <EmployerForm
            onSuccess={() => {
              console.log("Employer form success");
              setEmployerDialogOpen(false);
            }}
            onCancel={() => {
              console.log("Employer form cancelled");
              setEmployerDialogOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
