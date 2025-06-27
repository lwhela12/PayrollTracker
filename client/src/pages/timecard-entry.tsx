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
  const startDate = new Date(start);
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
