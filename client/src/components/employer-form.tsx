
import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface EmployerFormProps {
  employer?: any;
  onSuccess: (employer?: any) => void;
  onCancel: () => void;
}

const employerFormSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  mileageRate: z.string().min(1, "Mileage rate is required"),
  payPeriodStartDate: z.string().min(1, "Pay period start date is required"),
  weekStartsOn: z.string().optional(),
});

type EmployerFormData = z.infer<typeof employerFormSchema>;

export function EmployerForm({ employer, onSuccess, onCancel }: EmployerFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!employer;
  const [showPayrollWarning, setShowPayrollWarning] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<EmployerFormData | null>(null);

  const form = useForm<EmployerFormData>({
    resolver: zodResolver(employerFormSchema),
    defaultValues: {
      name: employer?.name || "",
      mileageRate: employer?.mileageRate?.toString() || "0.655",
      payPeriodStartDate: employer?.payPeriodStartDate || "",
      weekStartsOn: employer?.weekStartsOn?.toString() || "0",
    },
  });

  // Watch for payroll start date changes to automatically update week start day
  const payPeriodStartDate = form.watch("payPeriodStartDate");

  const getDayOfWeekName = (dayNum: number): string => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[dayNum] || "Unknown";
  };

  // Update week start day when payroll start date changes
  React.useEffect(() => {
    if (payPeriodStartDate) {
      const date = new Date(payPeriodStartDate + 'T00:00:00');
      const dayOfWeek = date.getDay();
      form.setValue("weekStartsOn", dayOfWeek.toString());
    }
  }, [payPeriodStartDate, form]);

  const createEmployerMutation = useMutation({
    mutationFn: async (data: EmployerFormData) => {
      console.log('=== CREATING EMPLOYER WITH DATA ===', data);
      const response = await apiRequest("POST", "/api/employers", {
        ...data,
        weekStartsOn: parseInt(data.weekStartsOn || "0"),
        // Set empty defaults for optional fields
        address: "",
        phone: "",
        email: "",
        taxId: "",
      });
      const employer = await response.json();
      console.log('=== EMPLOYER CREATED ===', employer);
      return employer;
    },
    onSuccess: (employer) => {
      console.log('=== CREATE MUTATION SUCCESS ===', employer);
      toast({
        title: "Success",
        description: "Company profile created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/employers"] });
      onSuccess(employer);
    },
    onError: (error: Error) => {
      console.error('=== CREATE MUTATION ERROR ===', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateEmployerMutation = useMutation({
    mutationFn: async (data: EmployerFormData) => {
      const response = await apiRequest("PUT", `/api/employers/${employer.id}`, {
        ...data,
        weekStartsOn: parseInt(data.weekStartsOn || "0"),
      });
      return response.json();
    },
    onSuccess: (updatedEmployer) => {
      toast({
        title: "Success",
        description: "Company profile updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/employers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pay-periods", employer.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats", employer.id] });
      onSuccess(updatedEmployer);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateEmployerWithPayrollChangeMutation = useMutation({
    mutationFn: async (data: EmployerFormData) => {
      const response = await apiRequest("PUT", `/api/employers/${employer.id}/reset-payroll`, {
        ...data,
        weekStartsOn: parseInt(data.weekStartsOn || "0"),
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Company profile updated and pay periods regenerated",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/employers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pay-periods", employer.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats", employer.id] });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EmployerFormData) => {
    console.log('=== EMPLOYER FORM SUBMIT ===', { data, isEditing, employer });

    if (isEditing) {
      // Check if payroll start date has changed
      const payrollDateChanged = employer?.payPeriodStartDate !== data.payPeriodStartDate;

      if (payrollDateChanged) {
        setPendingFormData(data);
        setShowPayrollWarning(true);
      } else {
        updateEmployerMutation.mutate(data);
      }
    } else {
      createEmployerMutation.mutate(data);
    }
  };

  const handleConfirmPayrollChange = () => {
    if (pendingFormData) {
      updateEmployerWithPayrollChangeMutation.mutate(pendingFormData);
    }
    setShowPayrollWarning(false);
    setPendingFormData(null);
  };

  const handleCancelPayrollChange = () => {
    setShowPayrollWarning(false);
    setPendingFormData(null);
  };

  const isLoading = createEmployerMutation.isPending || updateEmployerMutation.isPending || updateEmployerWithPayrollChangeMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company Name *</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Enter your company name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="payPeriodStartDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pay Period Start Date *</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  {...field}
                  value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                />
              </FormControl>
              <FormMessage />
              <p className="text-sm text-gray-500">
                This determines when your weekly pay periods begin
              </p>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="mileageRate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mileage Rate (per mile) *</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  step="0.001" 
                  placeholder="0.655" 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
              <p className="text-sm text-gray-500">
                Current IRS standard rate is $0.655 per mile
              </p>
            </FormItem>
          )}
        />

        {payPeriodStartDate && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>Week starts on:</strong> {getDayOfWeekName(new Date(payPeriodStartDate + 'T00:00:00').getDay())}
            </p>
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-6">
          <Button 
            type="button" 
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            type="submit"
            className="payroll-button-primary"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                {isEditing ? "Updating..." : "Creating..."}
              </>
            ) : (
              isEditing ? "Update Company" : "Create Company"
            )}
          </Button>
        </div>
      </form>

      <AlertDialog open={showPayrollWarning} onOpenChange={setShowPayrollWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Warning: Payroll Date Change</AlertDialogTitle>
            <AlertDialogDescription>
              You changed the payroll date so any existing entries for this payroll will be cleared. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelPayrollChange}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmPayrollChange}
              disabled={updateEmployerWithPayrollChangeMutation.isPending}
            >
              {updateEmployerWithPayrollChangeMutation.isPending ? "Updating..." : "Yes, Continue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Form>
  );
}
