import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { insertEmployerSchema } from "@shared/schema";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function getDayOfWeekName(dayNumber: number): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[dayNumber] || "";
}

interface EmployerFormProps {
  employer?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

const employerFormSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Please enter a valid email").optional().or(z.literal("")),
  taxId: z.string().optional(),
  mileageRate: z.string().min(1, "Mileage rate is required"),
  payPeriodStartDate: z.string().optional(),
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
      address: employer?.address || "",
      phone: employer?.phone || "",
      email: employer?.email || "",
      taxId: employer?.taxId || "",
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
      const response = await apiRequest("POST", "/api/employers", data);
      return response.json();
    },
    onSuccess: (newEmployer) => {
      toast({
        title: "Success",
        description: "Company profile created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/employers"] });
      
      // Set the newly created company as the selected company
      if (newEmployer?.id && typeof window !== 'undefined') {
        localStorage.setItem('selectedEmployerId', newEmployer.id.toString());
      }
      
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

  const updateEmployerMutation = useMutation({
    mutationFn: async (data: EmployerFormData) => {
      const response = await apiRequest("PUT", `/api/employers/${employer.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Company profile updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/employers"] });
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

  const updateEmployerWithPayrollChangeMutation = useMutation({
    mutationFn: async (data: EmployerFormData) => {
      const response = await apiRequest("PUT", `/api/employers/${employer.id}/reset-payroll`, data);
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
    console.log('=== EMPLOYER FORM SUBMIT HANDLER CALLED ===');
    console.log('Form data:', data);
    console.log('Current employer:', employer);
    
    if (isEditing) {
      // Check if payroll start date has changed
      const payrollDateChanged = employer?.payPeriodStartDate !== data.payPeriodStartDate;
      
      console.log('Payroll date comparison:', {
        original: employer?.payPeriodStartDate,
        new: data.payPeriodStartDate,
        changed: payrollDateChanged
      });
      
      if (payrollDateChanged) {
        console.log('=== PAYROLL DATE CHANGED - SHOWING WARNING ===');
        setPendingFormData(data);
        setShowPayrollWarning(true);
      } else {
        console.log('=== NO PAYROLL CHANGE - NORMAL UPDATE ===');
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company Name *</FormLabel>
              <FormControl>
                <Input {...field} placeholder="ABC Company Inc." />
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
                <Textarea 
                  {...field} 
                  placeholder="123 Main St, City, State 12345"
                  className="resize-none"
                  rows={3}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="(555) 123-4567" />
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
                  <Input {...field} type="email" placeholder="contact@company.com" />
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
                <FormLabel>Tax ID / EIN</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="12-3456789" />
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
                <FormLabel>Mileage Rate (per mile) *</FormLabel>
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

        <FormField
          control={form.control}
          name="payPeriodStartDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pay Period Start Day</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  {...field}
                  value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="weekStartsOn"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Week Starts On</FormLabel>
              <FormControl>
                <Input 
                  {...field} 
                  value={getDayOfWeekName(parseInt(field.value || "0"))}
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
          )}
        />
        
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