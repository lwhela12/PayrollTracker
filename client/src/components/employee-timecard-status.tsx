import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TimecardModal } from "./timecard-modal";
import { 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  User 
} from "lucide-react";

interface EmployeeTimecardStatusProps {
  employees: any[];
  currentPayPeriod?: any;
}

export function EmployeeTimecardStatus({ employees, currentPayPeriod }: EmployeeTimecardStatusProps) {
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [showTimecardModal, setShowTimecardModal] = useState(false);
  const queryClient = useQueryClient();

  // Fetch timecards for current pay period
  const { data: timecards = [] } = useQuery<any[]>({
    queryKey: ["/api/timecards", currentPayPeriod?.id],
    queryFn: () => currentPayPeriod?.id ? 
      fetch(`/api/timecards/pay-period/${currentPayPeriod.id}`, { credentials: 'include' }).then(res => res.json()) : 
      Promise.resolve([]),
    enabled: !!currentPayPeriod?.id,
  });

  const getEmployeeTimecardStatus = (employeeId: number) => {
    const employeeTimecards = timecards.filter((tc: any) => tc.employeeId === employeeId);
    
    if (employeeTimecards.length === 0) {
      return { status: "missing", label: "No timecards", color: "bg-red-100 text-red-800", icon: AlertCircle };
    }

    // Check if employee has timecards for all working days in the current pay period
    const payPeriodStart = new Date(currentPayPeriod?.startDate);
    const payPeriodEnd = new Date(currentPayPeriod?.endDate);
    const workingDays = [];
    
    for (let d = new Date(payPeriodStart); d <= payPeriodEnd; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Exclude weekends
        workingDays.push(new Date(d).toISOString().split('T')[0]);
      }
    }

    const timecardDates = employeeTimecards.map((tc: any) => tc.workDate);
    const missingDays = workingDays.filter(day => !timecardDates.includes(day));

    if (missingDays.length === 0) {
      const allApproved = employeeTimecards.every((tc: any) => tc.isApproved);
      if (allApproved) {
        return { status: "complete", label: "Complete", color: "bg-green-100 text-green-800", icon: CheckCircle };
      } else {
        return { status: "pending", label: "Pending approval", color: "bg-yellow-100 text-yellow-800", icon: Clock };
      }
    } else {
      return { status: "partial", label: `${missingDays.length} days missing`, color: "bg-orange-100 text-orange-800", icon: AlertCircle };
    }
  };

  // Mutation to create a new timecard
  const createTimecardMutation = useMutation({
    mutationFn: async (timecardData: any) => {
      return apiRequest("POST", "/api/timecards", timecardData);
    },
    onSuccess: () => {
      // Invalidate all timecard-related queries
      queryClient.invalidateQueries({ queryKey: ["/api/timecards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    },
    onError: (error) => {
      console.error("Timecard creation failed:", error);
    },
  });

  const handleEmployeeClick = async (employee: any) => {
    setSelectedEmployee(employee);
    
    // Check if employee has any timecards for current pay period
    const employeeTimecards = timecards.filter((tc: any) => tc.employeeId === employee.id);
    
    if (employeeTimecards.length === 0 && currentPayPeriod) {
      // Create a blank timecard for today's date
      const today = new Date().toISOString().split('T')[0];
      const newTimecard = {
        employeeId: employee.id,
        payPeriodId: currentPayPeriod.id,
        workDate: today,
        timeIn: null,
        timeOut: null,
        lunchMinutes: 0,
        regularHours: "0.00",
        overtimeHours: "0.00",
        ptoHours: "0.00",
        holidayHours: "0.00",
        startOdometer: null,
        endOdometer: null,
        totalMiles: 0,
        notes: "",
        isApproved: false
      };
      
      try {
        await createTimecardMutation.mutateAsync(newTimecard);
        // Wait a moment for cache invalidation to complete
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error("Failed to create timecard:", error);
        // Still open modal even if creation fails, so user can see the error state
      }
    }
    
    setShowTimecardModal(true);
  };

  if (!currentPayPeriod) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Employee Timecard Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            No active pay period found
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Employee Timecard Status
            </div>
            <Badge variant="outline" className="text-xs">
              {currentPayPeriod.startDate} - {currentPayPeriod.endDate}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {employees.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No employees found
            </p>
          ) : (
            employees.map((employee: any) => {
              const status = getEmployeeTimecardStatus(employee.id);
              const StatusIcon = status.icon;
              
              return (
                <div
                  key={employee.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => handleEmployeeClick(employee)}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="text-xs">
                        {employee.firstName[0]}{employee.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">
                        {employee.firstName} {employee.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {employee.position || "Employee"}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs ${status.color}`}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {status.label}
                    </Badge>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {selectedEmployee && (
        <TimecardModal
          isOpen={showTimecardModal}
          onClose={() => {
            setShowTimecardModal(false);
            setSelectedEmployee(null);
          }}
          employee={selectedEmployee}
          timecards={timecards.filter((tc: any) => tc.employeeId === selectedEmployee.id)}
          payPeriod={currentPayPeriod}
        />
      )}
    </>
  );
}