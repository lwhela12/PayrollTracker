import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertTimecardSchema } from "@shared/schema";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { calculateHoursFromTimecard, calculateMileage, validateTimeEntry } from "@/lib/payrollUtils";
import { getDayOfWeek } from "@/lib/dateUtils";
import { Clock } from "lucide-react";

interface TimecardFormProps {
  employees: any[];
  currentPayPeriod?: any;
}

const timecardFormSchema = insertTimecardSchema.extend({
  timeIn: z.string().min(1, "Time in is required"),
  timeOut: z.string().min(1, "Time out is required"),
  workDate: z.string().min(1, "Work date is required"),
  employeeId: z.number().min(1, "Employee is required"),
}).omit({
  regularHours: true,
  overtimeHours: true,
  totalMiles: true,
});

type TimecardFormData = z.infer<typeof timecardFormSchema>;

export function TimecardForm({ employees, currentPayPeriod }: TimecardFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const form = useForm<TimecardFormData>({
    resolver: zodResolver(timecardFormSchema),
    defaultValues: {
      workDate: selectedDate,
      lunchMinutes: 30,
      ptoHours: "0",
      holidayHours: "0",
      startOdometer: undefined,
      endOdometer: undefined,
      notes: "",
      payPeriodId: currentPayPeriod?.id,
    },
  });

  const createTimecardMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/timecards", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Timecard entry saved successfully",
      });
      form.reset();
      queryClient.invalidateQueries(["/api/timecards", currentPayPeriod?.id]);
      queryClient.invalidateQueries(["/api/dashboard/stats"]);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TimecardFormData) => {
    if (!currentPayPeriod) {
      toast({
        title: "Error",
        description: "No active pay period found",
        variant: "destructive",
      });
      return;
    }

    // Validate time entry
    const timeValidation = validateTimeEntry(data.timeIn, data.timeOut);
    if (!timeValidation.isValid) {
      toast({
        title: "Invalid Time Entry",
        description: timeValidation.error,
        variant: "destructive",
      });
      return;
    }

    // Calculate hours
    const hoursCalculation = calculateHoursFromTimecard(
      data.timeIn,
      data.timeOut,
      data.lunchMinutes || 0
    );

    // Calculate mileage
    const totalMiles = calculateMileage(
      data.startOdometer || 0,
      data.endOdometer || 0
    );

    const timecardData = {
      ...data,
      regularHours: hoursCalculation.regularHours.toString(),
      overtimeHours: hoursCalculation.overtimeHours.toString(),
      totalMiles,
      payPeriodId: currentPayPeriod.id,
    };

    createTimecardMutation.mutate(timecardData);
  };

  const watchedTimeIn = form.watch("timeIn");
  const watchedTimeOut = form.watch("timeOut");
  const watchedLunchMinutes = form.watch("lunchMinutes");
  const watchedStartOdometer = form.watch("startOdometer");
  const watchedEndOdometer = form.watch("endOdometer");

  // Calculate preview hours
  const previewHours = calculateHoursFromTimecard(
    watchedTimeIn || "",
    watchedTimeOut || "",
    watchedLunchMinutes || 0
  );

  const previewMiles = calculateMileage(
    watchedStartOdometer || 0,
    watchedEndOdometer || 0
  );

  return (
    <Card className="payroll-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Quick Timecard Entry
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Enter time data for the current pay period
        </p>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="employeeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Employee</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    value={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an employee..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id.toString()}>
                          {emp.firstName} {emp.lastName} - {emp.employeeId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="workDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          setSelectedDate(e.target.value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div>
                <Label className="text-sm font-medium">Day of Week</Label>
                <Input 
                  value={selectedDate ? getDayOfWeek(selectedDate) : ""} 
                  className="bg-muted mt-2" 
                  readOnly 
                />
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="timeIn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time In</FormLabel>
                    <FormControl>
                      <Input type="text" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="timeOut"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time Out</FormLabel>
                    <FormControl>
                      <Input type="text" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lunchMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lunch (min)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        placeholder="30"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startOdometer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Odometer</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                        placeholder="Miles"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endOdometer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Odometer</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                        placeholder="Miles"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Hours Preview */}
            {(watchedTimeIn && watchedTimeOut) && (
              <div className="p-3 bg-muted/30 rounded-lg border">
                <div className="text-sm">
                  <div className="flex justify-between">
                    <span>Total Hours:</span>
                    <span className="font-medium">{previewHours.totalHours.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Regular Hours:</span>
                    <span>{previewHours.regularHours.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Overtime Hours:</span>
                    <span>{previewHours.overtimeHours.toFixed(2)}</span>
                  </div>
                  {previewMiles > 0 && (
                    <div className="flex justify-between">
                      <span>Miles:</span>
                      <span>{previewMiles}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Additional notes..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end space-x-3 pt-4">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => form.reset()}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="payroll-button-primary"
                disabled={createTimecardMutation.isPending || !currentPayPeriod}
              >
                {createTimecardMutation.isPending ? "Saving..." : "Save Entry"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
