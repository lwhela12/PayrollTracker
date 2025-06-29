import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";
import { useCompany } from "@/context/company";

const schema = z.object({
  name: z.string().min(1, "Company name is required"),
  payPeriodStartDate: z.string().min(1, "Pay period start date is required"),
  weekStartsOn: z.coerce.number().min(0).max(6),
  mileageRate: z.string().default("0.655")
});

type FormData = z.infer<typeof schema>;

export default function CreateCompany() {
  const [, navigate] = useLocation();
  const { setEmployerId } = useCompany();
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { 
      name: "", 
      payPeriodStartDate: "", 
      weekStartsOn: 0,
      mileageRate: "0.655"
    }
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await apiRequest("POST", "/api/employers", data);
      return res.json();
    },
    onSuccess: async (newEmployer: any) => {
      toast({ title: "Company Created" });
      setEmployerId(newEmployer.id);
      
      // Also set in localStorage for consistency
      if (newEmployer?.id && typeof window !== 'undefined') {
        localStorage.setItem('selectedEmployerId', newEmployer.id.toString());
      }
      
      // Ensure pay periods are generated for the new employer
      try {
        await apiRequest("GET", `/api/pay-periods/${newEmployer.id}`);
      } catch (error) {
        console.warn("Pay periods may not be generated yet, but continuing to main screen");
      }
      
      navigate("/");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const onSubmit = (data: FormData) => mutation.mutate(data);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="payroll-card w-full max-w-md">
        <CardHeader>
          <CardTitle>Create Company</CardTitle>
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
                  <FormLabel>Pay Period Start Date *</FormLabel>
                  <FormControl>
                    <Input 
                      type="date" 
                      {...field} 
                      onChange={(e) => {
                        field.onChange(e);
                        // Auto-calculate week start day
                        if (e.target.value) {
                          const date = new Date(e.target.value + 'T00:00:00');
                          const dayOfWeek = date.getDay();
                          form.setValue('weekStartsOn', dayOfWeek);
                        }
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
                      value={(() => {
                        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                        return days[parseInt(field.value?.toString() || "0")] || "Select pay period start date first";
                      })()}
                      readOnly
                      className="bg-gray-50 cursor-not-allowed"
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-sm text-gray-500">
                    Week beginning day is automatically set based on your pay period start date
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
                <Button type="button" variant="outline" onClick={() => navigate("/")}>Cancel</Button>
                <Button type="submit" disabled={mutation.isPending} className="payroll-button-primary">
                  {mutation.isPending ? "Creating..." : "Create"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
