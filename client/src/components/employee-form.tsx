import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertEmployeeSchema } from "@shared/schema";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

interface EmployeeFormProps {
  employerId: number;
  employee?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

const employeeFormSchema = insertEmployeeSchema.extend({
  hireDate: z.string().min(1, "Hire date is required"),
});

type EmployeeFormData = z.infer<typeof employeeFormSchema>;

export function EmployeeForm({ employerId, employee, onSuccess, onCancel }: EmployeeFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!employee;

  // Fetch employer data to get company name for position default
  const { data: employer } = useQuery<any>({
    queryKey: ["/api/employers", employerId],
    enabled: !!employerId,
  });

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      firstName: employee?.firstName || "",
      lastName: employee?.lastName || "",
      hireDate: employee?.hireDate || new Date().toISOString().split('T')[0],
      isActive: employee?.isActive ?? true,
      employerId,
    },
  });

  const createEmployeeMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('Creating employee with data:', data);
      const response = await apiRequest("POST", "/api/employees", data);
      console.log('Create employee response:', response);
      return response;
    },
    onSuccess: (data) => {
      console.log('Employee created successfully:', data);
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({
        title: "Success",
        description: "Employee created successfully",
      });
      onSuccess();
    },
    onError: (error: Error) => {
      console.error('Create employee error:', error);
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
        description: `Failed to create employee: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: async (data: any) => {
      const { id, ...updateData } = data;
      const response = await apiRequest("PATCH", `/api/employees/${id}`, updateData);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({
        title: "Success",
        description: "Employee updated successfully",
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
        description: "Failed to update employee",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EmployeeFormData) => {
    console.log('Form submitted with data:', data);
    console.log('Form validation errors:', form.formState.errors);
    console.log('Form is valid:', form.formState.isValid);
    
    const submissionData = {
      ...data,
      position: employer?.name || "Employee", // Default position to company name
    };
    console.log('Final submission data:', submissionData);

    if (isEditing) {
      updateEmployeeMutation.mutate({ id: employee.id, ...submissionData });
    } else {
      createEmployeeMutation.mutate(submissionData);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter first name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter last name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="hireDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Hire Date</FormLabel>
              <FormControl>
                <Input 
                  type="date" 
                  {...field} 
                  value={field.value || ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />



        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            className="payroll-button-primary"
            disabled={createEmployeeMutation.isPending || updateEmployeeMutation.isPending}
          >
            {createEmployeeMutation.isPending || updateEmployeeMutation.isPending 
              ? "Saving..." 
              : isEditing 
                ? "Update Employee" 
                : "Add Employee"
            }
          </Button>
        </div>
      </form>
    </Form>
  );
}