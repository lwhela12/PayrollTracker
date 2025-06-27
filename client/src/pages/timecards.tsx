import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/lib/dateUtils";

export default function Timecards() {
  const { user } = useAuth();
  const [selectedEmployerId, setSelectedEmployerId] = useState<number | null>(null);
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
    queryKey: ["/api/pay-periods", selectedEmployerId],
    queryFn: () =>
      selectedEmployerId ? fetch(`/api/pay-periods/${selectedEmployerId}`, { credentials: "include" }).then((r) => r.json()) : Promise.resolve([]),
    enabled: !!selectedEmployerId,
  });

  useEffect(() => {
    if (payPeriods.length > 0 && !selectedPayPeriodId) {
      const current = payPeriods.find((p: any) => p.isActive) || payPeriods[0];
      setSelectedPayPeriodId(current.id.toString());
    }
  }, [payPeriods, selectedPayPeriodId]);

  const { data: timecards = [] } = useQuery<any[]>({
    queryKey: ["/api/timecards/pay-period", selectedPayPeriodId],
    queryFn: () =>
      selectedPayPeriodId ? fetch(`/api/timecards/pay-period/${selectedPayPeriodId}`, { credentials: "include" }).then((r) => r.json()) : Promise.resolve([]),
    enabled: !!selectedPayPeriodId,
  });

  const selectedEmployer = employers.find((e: any) => e.id === selectedEmployerId);
  const selectedPayPeriod = payPeriods.find((p: any) => p.id.toString() === selectedPayPeriodId);

  const getTotalHours = (empId: number) => {
    const records = timecards.filter((t: any) => t.employeeId === empId);
    const hours = records.reduce(
      (sum: number, t: any) => sum + parseFloat(t.regularHours || 0) + parseFloat(t.overtimeHours || 0),
      0
    );
    return hours.toFixed(2);
  };

  const getStatus = (empId: number) => {
    const records = timecards.filter((t: any) => t.employeeId === empId);
    return records.length === 0 ? "Not Started" : "In Progress";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar selectedEmployer={selectedEmployer} currentPayPeriod={selectedPayPeriod} />
      <div className="md:ml-64">
        <Header title="Timecards" description="Select an employee to enter hours" user={user} />
        <main className="p-4 md:p-6 pt-16 md:pt-6">
          {payPeriods.length > 0 && (
            <Select value={selectedPayPeriodId} onValueChange={setSelectedPayPeriodId}>
              <SelectTrigger className="w-[280px] mb-4">
                <SelectValue placeholder="Select a pay period" />
              </SelectTrigger>
              <SelectContent>
                {payPeriods.map((pp: any) => (
                  <SelectItem key={pp.id} value={pp.id.toString()}>
                    {formatDate(pp.startDate)} - {formatDate(pp.endDate)}
                    {pp.isActive && " (Current)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {employees.length === 0 ? (
            <Card className="p-6 text-center">No employees found</Card>
          ) : (
            <div className="space-y-3">
              {employees.map((emp: any) => (
                <Link
                  key={emp.id}
                  href={`/timecard/employee/${emp.id}/period/${selectedPayPeriod?.startDate}`}
                  className="block"
                >
                  <Card className="cursor-pointer hover:bg-accent">
                    <CardHeader>
                      <CardTitle className="flex justify-between">
                        <span>
                          {emp.firstName} {emp.lastName}
                        </span>
                        <span className="text-sm text-muted-foreground">{getStatus(emp.id)}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-right">
                      {getTotalHours(emp.id)} hrs
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
