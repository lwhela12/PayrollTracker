import { useRoute } from "wouter";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { EmployeePayPeriodForm } from "@/components/forms/EmployeePayPeriodForm";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

export default function TimecardEntry() {
  const { user } = useAuth();
  const [match, params] = useRoute("/timecard/employee/:employeeId/period/:start");
  if (!match) return <div>Invalid route</div>;
  const employeeId = parseInt(params.employeeId, 10);
  const start = params.start;
  const startDate = new Date(start);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 13);
  const payPeriod = { start: startDate.toISOString().split("T")[0], end: endDate.toISOString().split("T")[0] };

  const { data: employee } = useQuery<any>({
    queryKey: ["/api/employee", employeeId],
    queryFn: () => fetch(`/api/employees/${employeeId}`).then((r) => r.json()),
    enabled: !!employeeId,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="md:ml-64">
        <Header title="Timecard" description="Enter pay period data" user={user} />
        <main className="p-4 md:p-6 pt-16 md:pt-6">
          <h2 className="text-lg font-semibold mb-4">
            {employee ? `${employee.firstName} ${employee.lastName}` : "Employee"}
          </h2>
          <EmployeePayPeriodForm employeeId={employeeId} payPeriod={payPeriod} />
        </main>
      </div>
    </div>
  );
}
