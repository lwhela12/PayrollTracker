import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertEmployerSchema } from "@shared/schema";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useState } from "react";
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

interface CompanySettingsFormProps {
  employer: any;
  onSuccess: () => void;
  onCancel: () => void;
}

const companySettingsSchema = insertEmployerSchema.extend({
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
  mileageRate: z.string().min(1, "Mileage rate is required"),
});

type CompanySettingsFormData = z.infer<typeof companySettingsSchema>;

export function CompanySettingsForm({ employer, onSuccess, onCancel }: CompanySettingsFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showPayrollWarning, setShowPayrollWarning] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<CompanySettingsFormData | null>(null);

  const form = useForm<CompanySettingsFormData>({
    resolver: zodResolver(companySettingsSchema),
    defaultValues: {
      name: employer?.name || "",
      address: employer?.address || "",
      phone: employer?.phone || "",
      email: employer?.email || "",
      taxId: employer?.taxId || "",
      mileageRate: employer?.mileageRate?.toString() || "0.655",
      weekStartsOn: employer?.weekStartsOn || 0,
      payPeriodStartDate: employer?.payPeriodStartDate || "",
      ownerId: employer?.ownerId || "",
    },
  });

  console.log('Form initialized with employer data:', {
    employerId: employer?.id,
    originalPayPeriodStartDate: employer?.payPeriodStartDate,
    employer: employer
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PUT", `/api/employers/${employer.id}`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employers", employer.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/pay-periods", employer.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats", employer.id] });
      toast({
        title: "Success",
        description: "Company settings updated successfully",
      });
      onSuccess();
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update company settings",
        variant: "destructive",
      });
    },
  });

  const updateCompanyWithPayrollChangeMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PUT", `/api/employers/${employer.id}/reset-payroll`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employers", employer.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/pay-periods", employer.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats", employer.id] });
      toast({
        title: "Success",
        description: "Company settings updated and pay periods regenerated",
      });
      onSuccess();
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update company settings",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CompanySettingsFormData) => {
    const submissionData = {
      ...data,
      mileageRate: parseFloat(data.mileageRate),
    };

    // Check if payroll start date has changed
    const payrollDateChanged = employer?.payPeriodStartDate !== data.payPeriodStartDate;
    
    console.log('Payroll date check:', {
      original: employer?.payPeriodStartDate,
      new: data.payPeriodStartDate,
      changed: payrollDateChanged
    });
    
    if (payrollDateChanged) {
      console.log('Showing payroll warning dialog');
      setPendingFormData(data); // Store original form data, not converted
      setShowPayrollWarning(true);
    } else {
      console.log('No payroll date change, updating normally');
      updateCompanyMutation.mutate(submissionData);
    }
  };

  const handleConfirmPayrollChange = () => {
    if (pendingFormData) {
      const submissionData = {
        ...pendingFormData,
        mileageRate: parseFloat(pendingFormData.mileageRate),
      };
      updateCompanyWithPayrollChangeMutation.mutate(submissionData);
    }
    setShowPayrollWarning(false);
    setPendingFormData(null);
  };

  const handleCancelPayrollChange = () => {
    setShowPayrollWarning(false);
    setPendingFormData(null);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter company name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address</FormLabel>
              <FormControl>
                <Input placeholder="Enter company address" {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input placeholder="Enter phone number" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="Enter email address" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="taxId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tax ID</FormLabel>
                <FormControl>
                  <Input placeholder="Enter tax ID" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="mileageRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mileage Rate (per mile)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.001" 
                    placeholder="0.655" 
                    {...field} 
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={updateCompanyMutation.isPending || updateCompanyWithPayrollChangeMutation.isPending}
            className="payroll-button-primary"
          >
            {(updateCompanyMutation.isPending || updateCompanyWithPayrollChangeMutation.isPending) ? "Saving..." : "Save Settings"}
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
              disabled={updateCompanyWithPayrollChangeMutation.isPending}
            >
              {updateCompanyWithPayrollChangeMutation.isPending ? "Updating..." : "Yes, Continue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Form>
  );
}