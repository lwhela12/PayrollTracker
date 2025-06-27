import { useRoute } from "wouter";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { EmployeePayPeriodForm } from "@/components/forms/EmployeePayPeriodForm";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/context/company";

export default function TimecardEntry() {
  const { user } = useAuth();
  const { employerId } = useCompany();
  const [match, params] = useRoute("/timecard/employee/:employeeId/period/:start");
  if (!match) return <div>Invalid route</div>;
  const employeeId = parseInt(params.employeeId, 10);
  const start = params.start;
  
  // Parse the date string properly - handle various date formats
  let startDate: Date;
  try {
    // Try parsing as ISO date first
    startDate = new Date(start);
    // If that fails, try adding time component
    if (isNaN(startDate.getTime())) {
      startDate = new Date(start + 'T00:00:00.000Z');
    }
    // Final fallback - manual parsing for YYYY-MM-DD format
    if (isNaN(startDate.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(start)) {
      const [year, month, day] = start.split('-').map(Number);
      startDate = new Date(year, month - 1, day); // month is 0-indexed
    }
  } catch (error) {
    return <div>Invalid date parameter: {start}</div>;
  }
  
  if (isNaN(startDate.getTime())) {
    return <div>Invalid date parameter: {start}</div>;
  }
  
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 13);
  const payPeriod = { start: startDate.toISOString().split("T")[0], end: endDate.toISOString().split("T")[0] };

  // Get all employers to find which one has this employee
  const { data: employers = [] } = useQuery<any[]>({
    queryKey: ["/api/employers"],
    enabled: !!user,
  });

  // Get employees for the current employer context
  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["/api/employees", employerId],
    queryFn: () => employerId ? fetch(`/api/employees/${employerId}`, { credentials: 'include' }).then((r) => r.json()) : Promise.resolve([]),
    enabled: !!employerId,
  });

  // Find the specific employee
  const employee = employees.find(emp => emp.id === employeeId);

  // Get current pay period for sidebar context
  const { data: currentPayPeriod } = useQuery<any>({
    queryKey: ["/api/pay-periods", employerId, "current"],
    queryFn: () => employerId ? fetch(`/api/pay-periods/${employerId}/current`, { credentials: 'include' }).then((r) => r.json()) : Promise.resolve(null),
    enabled: !!employerId,
  });

  const selectedEmployer = employers.find((e: any) => e.id === employerId);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar selectedEmployer={selectedEmployer} currentPayPeriod={currentPayPeriod} user={user} />
      <div className="md:ml-64">
        <Header title={employee ? `${employee.firstName} ${employee.lastName} - Timecard` : "Timecard"} description="Enter pay period data" user={user} />
        <main className="p-4 md:p-6 pt-16 md:pt-6">
          <h2 className="text-lg font-semibold mb-4">
            {employee ? `${employee.firstName} ${employee.lastName}` : "Loading..."}
          </h2>
          <EmployeePayPeriodForm employeeId={employeeId} payPeriod={payPeriod} />
        </main>
      </div>
    </div>
  );
}
