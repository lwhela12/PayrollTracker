import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { BiweeklyTimecardForm } from "@/components/biweekly-timecard-form";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/lib/dateUtils";

export default function Timecards() {
  const { user } = useAuth();
  // Extract employer and employee IDs directly from the browser URL search params
  const searchParams = new URLSearchParams(window.location.search);
  const employerParam = searchParams.get('employer');
  const initialEmployerId = employerParam ? parseInt(employerParam, 10) : null;
  const employeeParam = searchParams.get('employee');
  const initialPreSelectedEmployeeId = employeeParam ? parseInt(employeeParam, 10) : null;
  const [preSelectedEmployeeId] = useState<number | null>(initialPreSelectedEmployeeId);
  const [selectedEmployerId, setSelectedEmployerId] = useState<number | null>(initialEmployerId);
  const [selectedPayPeriodId, setSelectedPayPeriodId] = useState<string>("");

  // Fetch employers
  const { data: employers = [] } = useQuery<any[]>({
    queryKey: ["/api/employers"],
    enabled: !!user,
  });

  // If no employer in URL, default to the first employer once loaded
  useEffect(() => {
    if (selectedEmployerId == null && employers.length > 0) {
      setSelectedEmployerId(employers[0].id);
    }
  }, [employers, selectedEmployerId]);

  // Fetch employees for selected employer
  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["/api/employees", selectedEmployerId],
    queryFn: () => selectedEmployerId ? fetch(`/api/employees/${selectedEmployerId}`).then(res => res.json()) : Promise.resolve([]),
    enabled: !!selectedEmployerId,
  });

  // Fetch all pay periods for selected employer
  const { data: payPeriods = [] } = useQuery<any[]>({
    queryKey: ["/api/pay-periods", selectedEmployerId],
    queryFn: () =>
      selectedEmployerId
        ? fetch(`/api/pay-periods/${selectedEmployerId}`, { credentials: "include" }).then((res) => res.json())
        : Promise.resolve([]),
    enabled: !!selectedEmployerId,
  });

  // Set default selected pay period
  useEffect(() => {
    if (payPeriods.length > 0 && !selectedPayPeriodId) {
      const current = payPeriods.find((p: any) => p.isActive) || payPeriods[0];
      setSelectedPayPeriodId(current.id.toString());
    }
  }, [payPeriods, selectedPayPeriodId]);



  const selectedEmployer = employers?.find((emp: any) => emp.id === selectedEmployerId);
  const selectedPayPeriod = payPeriods.find((p: any) => p.id.toString() === selectedPayPeriodId);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        selectedEmployer={selectedEmployer}
        currentPayPeriod={selectedPayPeriod}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="Timecard Entry"
          description="Enter bi-weekly timecard data for employees"
          user={user}
        />
        
        <main className="flex-1 overflow-y-auto p-6">
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
          {selectedEmployerId ? (
            selectedPayPeriod ? (
              <BiweeklyTimecardForm
                employees={employees || []}
                currentPayPeriod={selectedPayPeriod}
                preSelectedEmployeeId={preSelectedEmployeeId}
              />
            ) : (
              <Card className="max-w-md mx-auto mt-8">
                <CardHeader className="text-center">
                  <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                    <Calendar className="w-6 h-6 text-blue-600" />
                  </div>
                  <CardTitle>Setting Up Pay Periods</CardTitle>
                  <p className="text-muted-foreground">
                    Pay periods are being generated automatically. Please refresh the page if this message persists.
                  </p>
                </CardHeader>
              </Card>
            )
          ) : (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">Please select a company to view timecards.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}