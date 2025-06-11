import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { EmployeeForm } from "@/components/employee-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function Employees() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedEmployerId, setSelectedEmployerId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);

  // Fetch employers
  const { data: employers } = useQuery({
    queryKey: ["/api/employers"],
    enabled: !!user,
  });

  // Set first employer as default
  useEffect(() => {
    if (employers && employers.length > 0 && !selectedEmployerId) {
      setSelectedEmployerId(employers[0].id);
    }
  }, [employers, selectedEmployerId]);

  // Fetch employees
  const { data: employees, isLoading: employeesLoading } = useQuery({
    queryKey: ["/api/employees", selectedEmployerId],
    queryFn: () => selectedEmployerId ? fetch(`/api/employees/${selectedEmployerId}`).then(res => res.json()) : Promise.resolve([]),
    enabled: !!selectedEmployerId,
  });

  // Delete employee mutation
  const deleteEmployeeMutation = useMutation({
    mutationFn: async (employeeId: number) => {
      await apiRequest("DELETE", `/api/employees/${employeeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({
        title: "Success",
        description: "Employee deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter employees
  const filteredEmployees = employees?.filter((emp: any) =>
    `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.position || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.email || "").toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleEdit = (employee: any) => {
    setEditingEmployee(employee);
    setShowEmployeeForm(true);
  };

  const handleDelete = (employee: any) => {
    if (window.confirm(`Are you sure you want to delete ${employee.firstName} ${employee.lastName}?`)) {
      deleteEmployeeMutation.mutate(employee.id);
    }
  };

  const handleCloseForm = () => {
    setShowEmployeeForm(false);
    setEditingEmployee(null);
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

  return (
    <div className="flex h-screen bg-background">
      <Sidebar selectedEmployer={selectedEmployer} />
      
      <div className="flex-1 overflow-hidden">
        <Header 
          title="Employee Management"
          description="Manage your employee roster and information"
          user={user}
        />

        <div className="p-6 overflow-y-auto h-full">
          <Card className="payroll-card">
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
                  <Button 
                    className="payroll-button-primary"
                    onClick={() => setShowEmployeeForm(true)}
                  >
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
                      <th>Position</th>
                      <th>Contact</th>
                      <th>Hourly Rate</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeesLoading ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                        </td>
                      </tr>
                    ) : filteredEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-muted-foreground">
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
                          <td>{employee.position || "N/A"}</td>
                          <td>
                            <div className="text-sm">
                              {employee.email && <div>{employee.email}</div>}
                              {employee.phone && <div className="text-muted-foreground">{employee.phone}</div>}
                            </div>
                          </td>
                          <td>
                            {employee.hourlyRate ? `$${parseFloat(employee.hourlyRate).toFixed(2)}` : "N/A"}
                          </td>
                          <td>
                            <Badge 
                              variant={employee.isActive ? "default" : "secondary"}
                              className={employee.isActive ? "status-complete" : "status-badge"}
                            >
                              {employee.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td>
                            <div className="flex space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(employee)}
                                className="text-primary hover:text-primary/80"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(employee)}
                                className="text-destructive hover:text-destructive/80"
                                disabled={deleteEmployeeMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
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
        </div>
      </div>

      {/* Employee Form Dialog */}
      <Dialog open={showEmployeeForm} onOpenChange={setShowEmployeeForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingEmployee ? "Edit Employee" : "Add New Employee"}
            </DialogTitle>
          </DialogHeader>
          <EmployeeForm
            employerId={selectedEmployerId!}
            employee={editingEmployee}
            onSuccess={handleCloseForm}
            onCancel={handleCloseForm}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
