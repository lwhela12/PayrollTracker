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

  const { data } = useQuery<any>({
    queryKey: ["/api/employers", employerId],
    enabled: !!employerId
  });

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    values: data ? { 
      name: data.name || "", 
      weekStartsOn: data.weekStartsOn || 0,
      payPeriodStartDate: data.payPeriodStartDate || "",
      address: data.address || "",
      phone: data.phone || "",
      email: data.email || "",
      taxId: data.taxId || "",
      mileageRate: data.mileageRate?.toString() || "0.655"
    } : { 
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

  const mutation = useMutation({
    mutationFn: async (values: FormData) => {
      if (!employerId) return;
      const res = await apiRequest("PUT", `/api/employers/${employerId}`, values);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Company Updated" });
      navigate("/settings");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const onSubmit = (vals: FormData) => mutation.mutate(vals);

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
              <FormField name="weekStartsOn" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Week Starts On</FormLabel>
                  <FormControl>
                    <select {...field} className="border rounded p-2 w-full">
                      <option value={0}>Sunday</option>
                      <option value={1}>Monday</option>
                      <option value={2}>Tuesday</option>
                      <option value={3}>Wednesday</option>
                      <option value={4}>Thursday</option>
                      <option value={5}>Friday</option>
                      <option value={6}>Saturday</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => navigate("/settings")}>Cancel</Button>
                <Button type="submit" disabled={mutation.isPending} className="payroll-button-primary">
                  Save
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
