import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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

  const handleEmployeeClick = (employee: any) => {
    setSelectedEmployee(employee);
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