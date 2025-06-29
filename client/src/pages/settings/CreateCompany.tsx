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
  weekStartsOn: z.coerce.number().min(0).max(6)
});

type FormData = z.infer<typeof schema>;

export default function CreateCompany() {
  const [, navigate] = useLocation();
  const { setEmployerId } = useCompany();
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", weekStartsOn: 0 }
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiRequest("POST", "/api/employers", data);
      return response;
    },
    onSuccess: (employer: any) => {
      toast({ title: "Company Created" });
      setEmployerId(employer.id);
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
                <Button type="button" variant="outline" onClick={() => navigate("/")}>Cancel</Button>
                <Button type="submit" disabled={mutation.isPending} className="payroll-button-primary">
                  Create
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
