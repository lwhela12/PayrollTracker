import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertEmployerSchema } from "@shared/schema";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface EmployerFormProps {
  employer?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

const employerFormSchema = insertEmployerSchema;
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
      ownerId: employer?.ownerId || "",
    },
  });

  const createEmployerMutation = useMutation({
    mutationFn: async (data: any) => {
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
    mutationFn: async (data: any) => {
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
    if (isEditing) {
      updateEmployerMutation.mutate(data);
    } else {
      createEmployerMutation.mutate(data);
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
              <FormLabel>Company Name</FormLabel>
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
                  <Input {...field} value={field.value || ""} placeholder="(555) 123-4567" />
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
                  <Input {...field} value={field.value || ""} type="email" placeholder="contact@company.com" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="taxId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tax ID / EIN</FormLabel>
              <FormControl>
                <Input {...field} value={field.value || ""} placeholder="12-3456789" />
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