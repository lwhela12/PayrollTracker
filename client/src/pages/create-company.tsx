import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmployerForm } from "@/components/employer-form";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useCompany } from "@/context/company";
import { useQueryClient } from "@tanstack/react-query";

export default function CreateCompany() {
  const [, setLocation] = useLocation();
  const { setEmployerId } = useCompany();
  const queryClient = useQueryClient();

  const handleSuccess = async (employer: any) => {
    console.log('=== COMPANY CREATION SUCCESS ===');
    console.log('Employer data received:', employer);
    console.log('Employer ID:', employer?.id);
    
    if (!employer || !employer.id) {
      console.error('=== ERROR: No employer ID received ===');
      return;
    }
    
    // Set the newly created company in context
    console.log('=== SETTING EMPLOYER ID IN CONTEXT ===', employer.id);
    setEmployerId(employer.id);
    
    // Invalidate relevant queries to ensure fresh data
    await queryClient.invalidateQueries({ queryKey: ["/api/employers"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/pay-periods", employer.id] });
    await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats", employer.id] });
    
    // Force refetch of employer data to ensure it's available
    await queryClient.prefetchQuery({
      queryKey: ["/api/employers"],
      queryFn: async () => {
        const response = await fetch("/api/employers");
        return response.json();
      }
    });
    
    // Navigate to the dashboard immediately
    console.log('=== NAVIGATING TO DASHBOARD ===');
    setLocation("/");
  };

  const handleCancel = () => {
    // Navigate back to the home page
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </div>

        <Card className="payroll-card">
          <CardHeader>
            <CardTitle className="text-2xl">Create Company Profile</CardTitle>
            <p className="text-muted-foreground">
              Set up your company information to get started with payroll tracking.
            </p>
          </CardHeader>
          <CardContent>
            <EmployerForm
              onSuccess={handleSuccess}
              onCancel={handleCancel}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}