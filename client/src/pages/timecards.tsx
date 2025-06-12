import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { BiweeklyTimecardForm } from "@/components/biweekly-timecard-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { getNextWednesday, createBiWeeklyPayPeriod } from "@/lib/dateUtils";
import { useToast } from "@/hooks/use-toast";

export default function Timecards() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedEmployerId, setSelectedEmployerId] = useState<number | null>(null);

  // Fetch employers
  const { data: employers = [] } = useQuery<any[]>({
    queryKey: ["/api/employers"],
    enabled: !!user,
  });

  // Set first employer as default
  useEffect(() => {
    if (employers && employers.length > 0 && !selectedEmployerId) {
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
    enabled: !!selectedEmployerId,
  });

  // Create pay period mutation
  const createPayPeriodMutation = useMutation({
    mutationFn: async (payPeriodData: any) => {
      return apiRequest("POST", "/api/pay-periods", payPeriodData);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Pay period created successfully",
      });
      // Invalidate all related queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pay-periods"] });
      queryClient.invalidateQueries({ queryKey: ["/api/timecards"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create pay period",
        variant: "destructive",
      });
    },
  });

  const handleCreatePayPeriod = () => {
    if (!selectedEmployerId) return;
    
    const nextWednesday = getNextWednesday();
    const payPeriod = createBiWeeklyPayPeriod(nextWednesday);
    
    createPayPeriodMutation.mutate({
      employerId: selectedEmployerId,
      startDate: payPeriod.startDate,
      endDate: payPeriod.endDate,
      isActive: true
    });
  };

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
              />
            ) : (
              <Card className="max-w-md mx-auto mt-8">
                <CardHeader className="text-center">
                  <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                    <Calendar className="w-6 h-6 text-blue-600" />
                  </div>
                  <CardTitle>No Active Pay Period</CardTitle>
                  <p className="text-muted-foreground">
                    No active pay period found. Please create a pay period first.
                  </p>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={handleCreatePayPeriod}
                    disabled={createPayPeriodMutation.isPending}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {createPayPeriodMutation.isPending ? "Creating..." : "Create Pay Period"}
                  </Button>
                </CardContent>
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