import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";
import { useCompany } from "@/context/company";
import React, { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const schema = z.object({
  name: z.string().min(1, "Company name is required"),
  weekStartsOn: z.coerce.number().min(0).max(6),
  payPeriodStartDate: z.string().min(1, "Payroll start date is required"),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  taxId: z.string().optional(),
  mileageRate: z.string().min(1, "Mileage rate is required"),
});

type FormData = z.infer<typeof schema>;

function getDayOfWeekName(dayNumber: number): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[dayNumber] || "";
}

export default function CompanySettings() {
  const [, navigate] = useLocation();
  const { employerId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showPayrollWarning, setShowPayrollWarning] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);

  const { data: employer } = useQuery<any>({
    queryKey: employerId ? [`/api/employers/${employerId}`] : [],
    enabled: !!employerId
  });

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      weekStartsOn: 0,
      payPeriodStartDate: "",
      address: "",
      phone: "",
      email: "",
      taxId: "",
      mileageRate: "0.655"
    }
  });

  // Update form values when data loads
  React.useEffect(() => {
    if (employer) {
      const formData = {
        name: employer.name || "",
        weekStartsOn: employer.weekStartsOn || 0,
        payPeriodStartDate: employer.payPeriodStartDate || "",
        address: employer.address || "",
        phone: employer.phone || "",
        email: employer.email || "",
        taxId: employer.taxId || "",
        mileageRate: employer.mileageRate?.toString() || "0.655"
      };
      form.reset(formData);
    }
  }, [employer, form]);

  const updateCompanyMutation = useMutation({
    mutationFn: async (values: FormData) => {
      if (!employerId) return;
      const submissionData = {
        ...values,
        mileageRate: parseFloat(values.mileageRate),
      };
      const response = await apiRequest("PUT", `/api/employers/${employerId}`, submissionData);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employers"] });
      queryClient.invalidateQueries({ queryKey: [`/api/employers/${employerId}`] });
      toast({ title: "Company Updated" });
      navigate("/settings");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const updateCompanyWithPayrollChangeMutation = useMutation({
    mutationFn: async (values: FormData) => {
      if (!employerId) return;
      const submissionData = {
        ...values,
        mileageRate: parseFloat(values.mileageRate),
      };
      const response = await apiRequest("PUT", `/api/employers/${employerId}/reset-payroll`, submissionData);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employers"] });
      queryClient.invalidateQueries({ queryKey: [`/api/employers/${employerId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/pay-periods", employerId] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats", employerId] });
      toast({ title: "Company Updated", description: "Payroll periods regenerated" });
      navigate("/settings");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const onSubmit = (values: FormData) => {
    // Check if payroll start date has changed
    const payrollDateChanged = employer?.payPeriodStartDate !== values.payPeriodStartDate;
    
    console.log('Payroll date check:', {
      original: employer?.payPeriodStartDate,
      new: values.payPeriodStartDate,
      changed: payrollDateChanged
    });
    
    if (payrollDateChanged) {
      console.log('Showing payroll warning dialog');
      setPendingFormData(values);
      setShowPayrollWarning(true);
    } else {
      console.log('No payroll date change, updating normally');
      updateCompanyMutation.mutate(values);
    }
  };

  const handleConfirmPayrollChange = () => {
    if (pendingFormData) {
      updateCompanyWithPayrollChangeMutation.mutate(pendingFormData);
    }
    setShowPayrollWarning(false);
    setPendingFormData(null);
  };

  const handleCancelPayrollChange = () => {
    setShowPayrollWarning(false);
    setPendingFormData(null);
  };

  if (!employerId) return null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="payroll-card w-full max-w-md">
        <CardHeader>
          <CardTitle>Edit Company</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField name="name" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField name="payPeriodStartDate" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Payroll Start Date</FormLabel>
                  <FormControl>
                    <Input 
                      type="date" 
                      {...field} 
                      onChange={(e) => {
                        field.onChange(e);
                        // Auto-calculate week start day
                        const date = new Date(e.target.value);
                        const dayOfWeek = date.getDay();
                        form.setValue('weekStartsOn', dayOfWeek);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-sm text-gray-500">
                    This determines when your pay periods start and end
                  </p>
                </FormItem>
              )} />

              <FormField name="weekStartsOn" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Week Starts On</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      value={getDayOfWeekName(parseInt(field.value?.toString() || "0"))}
                      readOnly
                      className="bg-gray-50 cursor-not-allowed"
                      placeholder="Select payroll start date first"
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-sm text-gray-500">
                    Week beginning day is automatically set based on your payroll start date
                  </p>
                </FormItem>
              )} />

              <FormField name="mileageRate" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Mileage Rate (per mile)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.001" 
                      {...field} 
                      placeholder="0.655"
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-sm text-gray-500">
                    Current IRS standard rate is $0.655 per mile
                  </p>
                </FormItem>
              )} />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => navigate("/settings")}>Cancel</Button>
                <Button 
                  type="submit" 
                  disabled={updateCompanyMutation.isPending || updateCompanyWithPayrollChangeMutation.isPending} 
                  className="payroll-button-primary"
                >
                  {(updateCompanyMutation.isPending || updateCompanyWithPayrollChangeMutation.isPending) ? "Saving..." : "Save"}
                </Button>
              </div>
            </form>
          </Form>

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
                  disabled={updateCompanyWithPayrollChangeMutation.isPending}
                >
                  {updateCompanyWithPayrollChangeMutation.isPending ? "Updating..." : "Yes, Continue"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
