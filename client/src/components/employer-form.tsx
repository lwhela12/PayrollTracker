import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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

  const createEmployerMutation = useMutation({
    mutationFn: async (data: EmployerFormData) => {
      const response = await apiRequest("POST", "/api/employers", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Company profile created successfully",
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

  const onSubmit = (data: EmployerFormData) => {
    const submissionData = {
      ...data,
      mileageRate: data.mileageRate ? parseFloat(data.mileageRate.toString()) : 0.655,
      weekStartsOn: data.weekStartsOn ? parseInt(data.weekStartsOn.toString()) : 0,
    };
    
    if (isEditing) {
      updateEmployerMutation.mutate(submissionData);
    } else {
      createEmployerMutation.mutate(submissionData);
    }
  };

  const isLoading = createEmployerMutation.isPending || updateEmployerMutation.isPending;

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
                <select {...field} className="border rounded p-2 w-full">
                  <option value="0">Sunday</option>
                  <option value="1">Monday</option>
                  <option value="2">Tuesday</option>
                  <option value="3">Wednesday</option>
                  <option value="4">Thursday</option>
                  <option value="5">Friday</option>
                  <option value="6">Saturday</option>
                </select>
              </FormControl>
              <FormMessage />
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
    </Form>
  );
}