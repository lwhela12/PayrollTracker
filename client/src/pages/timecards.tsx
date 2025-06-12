import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { BiweeklyTimecardForm } from "@/components/biweekly-timecard-form";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

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

  // Fetch dashboard stats to get current pay period
  const { data: dashboardStats = {} } = useQuery<any>({
    queryKey: ["/api/dashboard/stats", selectedEmployerId],
    queryFn: () => selectedEmployerId
      ? fetch(`/api/dashboard/stats/${selectedEmployerId}`, { credentials: 'include' }).then(res => res.json())
      : Promise.resolve({}),
    enabled: !!selectedEmployerId,
  });



  const selectedEmployer = employers?.find((emp: any) => emp.id === selectedEmployerId);
  const currentPayPeriod = dashboardStats?.currentPayPeriod;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar 
        selectedEmployer={selectedEmployer} 
        currentPayPeriod={currentPayPeriod}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="Timecard Entry"
          description="Enter bi-weekly timecard data for employees"
          user={user}
        />
        
        <main className="flex-1 overflow-y-auto p-6">
          {selectedEmployerId ? (
            currentPayPeriod ? (
              <BiweeklyTimecardForm
                employees={employees || []}
                currentPayPeriod={currentPayPeriod}
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