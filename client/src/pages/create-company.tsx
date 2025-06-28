import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmployerForm } from "@/components/employer-form";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function CreateCompany() {
  const [, setLocation] = useLocation();

  const handleSuccess = () => {
    // Navigate back to the home page after successful creation
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