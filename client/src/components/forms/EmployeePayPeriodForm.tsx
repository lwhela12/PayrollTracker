import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { calculateHoursFromTimecard, TimeEntryLike } from "@/lib/payrollUtils";
import { getDayOfWeek } from "@/lib/dateUtils";
import { useToast } from "@/hooks/use-toast";
import { useTimecardUpdates } from "@/context/timecard-updates";

interface EmployeePayPeriodFormProps {
  employeeId: number;
  payPeriod: { start: string; end: string };
  employee?: any;
}

interface ShiftEntry {
  timeIn: string;
  timeOut: string;
  lunch: number;
}

interface DayEntry {
  date: string;
  shifts: ShiftEntry[];
}

export function EmployeePayPeriodForm({ employeeId, payPeriod, employee: propEmployee }: EmployeePayPeriodFormProps) {
  const { start, end } = payPeriod;

  // Use employee from props if provided, otherwise fetch
  const { data: fetchedEmployee } = useQuery<any>({
    queryKey: ["/api/employees", employeeId],
    queryFn: () =>
      apiRequest("GET", `/api/employees/${employeeId}`).then((res) => res.json()),
    enabled: !!employeeId && !propEmployee,
  });

  const employee = propEmployee || fetchedEmployee;

  // Fetch employer data to get company-level mileage rate
  const { data: employer } = useQuery<any>({
    queryKey: ["/api/employers", employee?.employerId],
    queryFn: () =>
      apiRequest("GET", `/api/employers/${employee?.employerId}`).then((res) => res.json()),
    enabled: !!employee?.employerId,
  });

  const { data: existingEntries = [] } = useQuery<any[]>({
    queryKey: ["/api/time-entries/employee", employeeId, start, end],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/time-entries/employee/${employeeId}?start=${start}&end=${end}`
      ).then((res) => res.json()),
    enabled: !!employeeId && !!start && !!end,
    staleTime: 30000, // Cache for 30 seconds to reduce redundant calls
    refetchOnMount: true,
  });

  const { data: existingPtoEntries = [] } = useQuery<any[]>({
    queryKey: ["/api/pto-entries/employee", employeeId],
    queryFn: () =>
      apiRequest("GET", `/api/pto-entries/employee/${employeeId}`).then((res) => res.json()),
    enabled: !!employeeId,
    staleTime: 60000, // Cache for 1 minute
  });

  const { data: existingMiscEntries = [] } = useQuery<any[]>({
    queryKey: ["/api/misc-hours-entries/employee", employeeId],
    queryFn: () =>
      apiRequest("GET", `/api/misc-hours-entries/employee/${employeeId}`).then((res) => res.json()),
    enabled: !!employeeId,
    staleTime: 60000, // Cache for 1 minute
  });

  const { data: existingReimbEntries = [] } = useQuery<any[]>({
    queryKey: ["/api/reimbursement-entries/employee", employeeId],
    queryFn: () =>
      apiRequest("GET", `/api/reimbursement-entries/employee/${employeeId}`).then((res) => res.json()),
    enabled: !!employeeId,
    staleTime: 60000, // Cache for 1 minute
  });

  const generateDays = useCallback(() => {
    const startDate = new Date(start);
    const days: DayEntry[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      days.push({ date: dateStr, shifts: [{ timeIn: "", timeOut: "", lunch: 0 }] });
    }
    return days;
  }, [start]);

  const [days, setDays] = useState<DayEntry[]>(() => {
    const startDate = new Date(start);
    const days: DayEntry[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      days.push({ date: dateStr, shifts: [{ timeIn: "", timeOut: "", lunch: 0 }] });
    }
    return days;
  });
  const [ptoHours, setPtoHours] = useState(0);
  const [holidayNonWorked, setHolidayNonWorked] = useState(0);
  const [holidayWorked, setHolidayWorked] = useState(0);
  const [milesDriven, setMilesDriven] = useState(0);
  const [miscHours, setMiscHours] = useState(0);
  const [reimbAmt, setReimbAmt] = useState(0);
  const [reimbDesc, setReimbDesc] = useState("");
  const [notes, setNotes] = useState("");

  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { updateEmployee, clearEmployee } = useTimecardUpdates();

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    // Always regenerate days structure when existingEntries changes
    const newDays = generateDays(); // Start with fresh 14-day structure
    
    if (existingEntries && existingEntries.length > 0) {
      // Process existing entries and map them to the correct dates
      existingEntries.forEach((e: any) => {
        if (!e || !e.timeIn) return; // Skip entries without timeIn
        
        try {
          const entryDate = e.timeIn.split("T")[0];
          const dayIndex = newDays.findIndex(d => d.date === entryDate);
          
          if (dayIndex >= 0) {
            // If this is the first shift for this day, replace the empty shift
            if (newDays[dayIndex].shifts.length === 1 && !newDays[dayIndex].shifts[0].timeIn) {
              newDays[dayIndex].shifts[0] = {
                timeIn: e.timeIn.split("T")[1]?.slice(0, 5) || "",
                timeOut: e.timeOut?.split("T")[1]?.slice(0, 5) || "",
                lunch: e.lunchMinutes || 0,
              };
            } else {
              // Add as additional shift
              newDays[dayIndex].shifts.push({
                timeIn: e.timeIn.split("T")[1]?.slice(0, 5) || "",
                timeOut: e.timeOut?.split("T")[1]?.slice(0, 5) || "",
                lunch: e.lunchMinutes || 0,
              });
            }
          }
        } catch (error) {
          console.warn('Failed to process time entry:', e, error);
        }
      });
    }
    
    setDays(newDays);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingEntries?.length, start, end, generateDays]); // Use length instead of full array

  // Populate PTO hours from existing entries
  useEffect(() => {
    if (existingPtoEntries && existingPtoEntries.length > 0) {
      try {
        const periodPto = existingPtoEntries.filter(p => 
          p && p.entryDate >= start && p.entryDate <= end
        ).reduce((sum, p) => sum + (parseFloat(p.hours) || 0), 0);
        setPtoHours(periodPto);
      } catch (error) {
        console.warn('Failed to process PTO entries:', error);
        setPtoHours(0);
      }
    } else {
      setPtoHours(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingPtoEntries?.length, start, end]);

  // Populate misc hours from existing entries
  useEffect(() => {
    if (existingMiscEntries && existingMiscEntries.length > 0) {
      try {
        const periodMisc = existingMiscEntries.filter(m => 
          m && m.entryDate >= start && m.entryDate <= end
        );
        
        const holidayHours = periodMisc.filter(m => m.entryType === 'holiday')
          .reduce((sum, m) => sum + (parseFloat(m.hours) || 0), 0);
        const holidayWorkedHours = periodMisc.filter(m => m.entryType === 'holiday-worked')
          .reduce((sum, m) => sum + (parseFloat(m.hours) || 0), 0);
        const miscHoursTotal = periodMisc.filter(m => m.entryType === 'misc')
          .reduce((sum, m) => sum + (parseFloat(m.hours) || 0), 0);
        
        setHolidayNonWorked(holidayHours);
        setHolidayWorked(holidayWorkedHours);
        setMiscHours(miscHoursTotal);
      } catch (error) {
        console.warn('Failed to process misc hours entries:', error);
        setHolidayNonWorked(0);
        setHolidayWorked(0);
        setMiscHours(0);
      }
    } else {
      setHolidayNonWorked(0);
      setHolidayWorked(0);
      setMiscHours(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingMiscEntries?.length, start, end]);

  // Populate reimbursement from existing entries
  useEffect(() => {
    if (existingReimbEntries && existingReimbEntries.length > 0) {
      try {
        const periodReimb = existingReimbEntries.filter(r => 
          r && r.entryDate >= start && r.entryDate <= end
        );
        
        if (periodReimb.length > 0) {
          const reimbEntry = periodReimb[0]; // Get the first (most recent) entry
          const description = reimbEntry.description || "";
          const totalAmount = parseFloat(reimbEntry.amount) || 0;
          
          // Parse combined reimbursement entry
          let mileageAmount = 0;
          let otherAmount = totalAmount;
          let otherDesc = "";
          
          // Extract mileage info if present
          const mileageMatch = description.match(/Mileage: (\d+(?:\.\d+)?) miles \(\$(\d+(?:\.\d+)?)\)/);
          if (mileageMatch) {
            setMilesDriven(parseFloat(mileageMatch[1]) || 0);
            mileageAmount = parseFloat(mileageMatch[2]) || 0;
            otherAmount = totalAmount - mileageAmount;
            
            // Extract other reimbursement description after the semicolon
            const parts = description.split('; ');
            if (parts.length > 1) {
              otherDesc = parts[1];
            }
          } else {
            // No mileage, treat entire amount as other reimbursement
            otherDesc = description;
          }
          
          // Set other reimbursement amount and description
          if (otherAmount > 0) {
            setReimbAmt(otherAmount);
            setReimbDesc(otherDesc);
          }
        }
      } catch (error) {
        console.warn('Failed to process reimbursement entries:', error);
        setMilesDriven(0);
        setReimbAmt(0);
        setReimbDesc("");
      }
    } else {
      setMilesDriven(0);
      setReimbAmt(0);
      setReimbDesc("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingReimbEntries?.length, start, end]);

  const calculateDayTotal = (day: DayEntry) => {
    return day.shifts.reduce((sum, s) => {
      const hrs = calculateHoursFromTimecard(s.timeIn, s.timeOut, s.lunch).totalHours;
      return sum + hrs;
    }, 0);
  };

  // Split days into two 7-day weeks and calculate overtime separately for each week
  const week1Days = days.slice(0, 7);
  const week2Days = days.slice(7, 14);
  
  const calculateWeeklyHours = (weekDays: DayEntry[]) => {
    const weekTotalHours = weekDays.reduce((sum, d) => sum + calculateDayTotal(d), 0);
    return {
      regularHours: Math.min(weekTotalHours, 40),
      overtimeHours: Math.max(0, weekTotalHours - 40)
    };
  };
  
  const week1 = calculateWeeklyHours(week1Days);
  const week2 = calculateWeeklyHours(week2Days);
  
  const totalRegularHours = week1.regularHours + week2.regularHours;
  const totalOvertimeHours = week1.overtimeHours + week2.overtimeHours;
  const totalWorkedHours = totalRegularHours + totalOvertimeHours;
  
  const totals = {
    regular: totalRegularHours + miscHours, // Add misc hours to regular hours
    overtime: totalOvertimeHours,
    totalHours: totalWorkedHours + miscHours
  };

  // Real-time updates to pay period summary when any values change
  useEffect(() => {
    if (employee && employer) {
      const mileageRate = parseFloat(employer.mileageRate || '0.655');
      const mileageAmount = milesDriven > 0 ? milesDriven * mileageRate : 0;
      const totalReimbursement = reimbAmt + mileageAmount;
      
      updateEmployee(employeeId, {
        totalHours: totals.totalHours + ptoHours + holidayNonWorked + holidayWorked,
        totalOvertimeHours: totals.overtime,
        mileage: milesDriven,
        reimbursement: totalReimbursement,
        ptoHours,
        holidayHours: holidayNonWorked,
        holidayWorkedHours: holidayWorked
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, milesDriven, reimbAmt, ptoHours, holidayNonWorked, holidayWorked, miscHours, employee, employer, employeeId, totals.totalHours, totals.overtime]);

  const addShift = (date: string) => {
    setDays((prev) =>
      prev.map((d) =>
        d.date === date ? { ...d, shifts: [...d.shifts, { timeIn: "", timeOut: "", lunch: 0 }] } : d
      )
    );
  };

  const updateShift = (date: string, index: number, field: keyof ShiftEntry, value: any) => {
    setDays((prev) =>
      prev.map((d) => {
        if (d.date !== date) return d;
        const shifts = d.shifts.map((s, i) => (i === index ? { ...s, [field]: value } : s));
        return { ...d, shifts };
      })
    );
  };

  const removeShift = (date: string, index: number) => {
    setDays((prev) =>
      prev.map((d) => {
        if (d.date !== date) return d;
        const shifts = d.shifts.filter((_, i) => i !== index);
        return {
          ...d,
          shifts: shifts.length > 0 ? shifts : [{ timeIn: "", timeOut: "", lunch: 0 }],
        };
      })
    );
  };

  const saveTimeEntries = useMutation({
    mutationFn: async (payload: any) => {
      try {
        const res = await apiRequest("POST", "/api/timecards/bulk-update", payload);
        if (!res.ok) {
          const errorData = await res.text();
          throw new Error(`Server error: ${errorData}`);
        }
        return res.json();
      } catch (error) {
        console.error("Mutation error:", error);
        throw error;
      }
    },
    onMutate: async (newData: any) => {
      if (!employee?.employerId) return { previousStats: undefined };

      await queryClient.cancelQueries({ queryKey: ["/api/dashboard/stats", employee.employerId] });
      const previousStats = queryClient.getQueryData<any>(["/api/dashboard/stats", employee.employerId]);

      if (previousStats) {
        try {
          const entryList: TimeEntryLike[] = [];
          
          // Safely process days and shifts
          if (newData.days && Array.isArray(newData.days)) {
            newData.days.forEach((d: any) => {
              if (d && d.shifts && Array.isArray(d.shifts)) {
                d.shifts.forEach((s: any) => {
                  if (s && s.timeIn && s.timeOut) {
                    entryList.push({
                      timeIn: `${d.date}T${s.timeIn}:00`,
                      timeOut: `${d.date}T${s.timeOut}:00`,
                      lunchMinutes: s.lunch || 0,
                    });
                  }
                });
              }
            });
          }

          // Calculate weekly hours using the same logic as the component
          const week1Entries = entryList.filter(e => {
            const entryDate = new Date(e.timeIn).toISOString().split('T')[0];
            const startDate = new Date(newData.payPeriod?.start || payPeriod.start);
            const week1End = new Date(startDate);
            week1End.setDate(startDate.getDate() + 6);
            return entryDate >= startDate.toISOString().split('T')[0] && entryDate <= week1End.toISOString().split('T')[0];
          });
          
          const week2Entries = entryList.filter(e => {
            const entryDate = new Date(e.timeIn).toISOString().split('T')[0];
            const startDate = new Date(newData.payPeriod?.start || payPeriod.start);
            const week2Start = new Date(startDate);
            week2Start.setDate(startDate.getDate() + 7);
            const week2End = new Date(startDate);
            week2End.setDate(startDate.getDate() + 13);
            return entryDate >= week2Start.toISOString().split('T')[0] && entryDate <= week2End.toISOString().split('T')[0];
          });
          
          const calculateWeekHours = (entries: TimeEntryLike[]) => {
            const totalHours = entries.reduce((sum, entry) => {
              const timeIn = new Date(entry.timeIn);
              const timeOut = new Date(entry.timeOut);
              let hours = (timeOut.getTime() - timeIn.getTime()) / (1000 * 60 * 60);
              if (entry.lunchMinutes) {
                hours -= entry.lunchMinutes / 60;
              }
              return sum + Math.max(0, hours);
            }, 0);
            return {
              regularHours: Math.min(totalHours, 40),
              overtimeHours: Math.max(0, totalHours - 40)
            };
          };
          
          const week1Hours = calculateWeekHours(week1Entries);
          const week2Hours = calculateWeekHours(week2Entries);
          const totalRegularHours = week1Hours.regularHours + week2Hours.regularHours;
          const totalOvertimeHours = week1Hours.overtimeHours + week2Hours.overtimeHours;

          const mileageRate = employer ? parseFloat(employer.mileageRate || '0.655') : 0.655;
          const optimistic = {
            employeeId,
            totalHours: (totalRegularHours || 0) + (newData.miscHours || 0) + (totalOvertimeHours || 0),
            totalOvertimeHours: totalOvertimeHours || 0,
            ptoHours: newData.ptoHours || 0,
            holidayHours: newData.holidayNonWorked || 0,
            holidayWorkedHours: newData.holidayWorked || 0,
            mileage: newData.milesDriven || 0,
            reimbursements: (newData.reimbursement?.amount || 0) + (newData.milesDriven || 0) * mileageRate,
          };

          queryClient.setQueryData<any>(["/api/dashboard/stats", employee.employerId], (old: any) => {
            if (!old || !old.employeeStats) return old;
            
            const employeeStats = [...(old.employeeStats || [])];
            const idx = employeeStats.findIndex((s: any) => s.employeeId === employeeId);
            
            if (idx >= 0) {
              employeeStats[idx] = optimistic;
            } else {
              employeeStats.push(optimistic);
            }
            
            return { ...old, employeeStats };
          });
        } catch (error) {
          console.error("Optimistic update error:", error);
          // Continue with mutation even if optimistic update fails
        }
      }

      return { previousStats };
    },
    onError: (err: any, _newData, context) => {
      console.error("Save timecard error:", err);
      if (context?.previousStats && employee?.employerId) {
        queryClient.setQueryData(["/api/dashboard/stats", employee.employerId], context.previousStats);
      }
      
      const errorMessage = err?.message || "Failed to save timecard data";
      toast({ 
        title: "Error", 
        description: `Failed to save. ${errorMessage}. Your changes have been reverted.`, 
        variant: "destructive" 
      });
    },
    onSuccess: async () => {
      toast({
        title: "Success",
        description: "Timecard data saved successfully",
      });

      // Store the current pay period for restoration
      if (payPeriod && payPeriod.start) {
        sessionStorage.setItem('selected-pay-period-start', payPeriod.start);
      }

      // Clear real-time updates immediately to avoid stale data
      clearEmployee(employeeId);

      // Navigate immediately - don't wait for query invalidations
      navigate("/");

      // Perform invalidations in background after navigation
      setTimeout(async () => {
        // Only invalidate the queries we actually need
        if (employee?.employerId) {
          await queryClient.invalidateQueries({
            queryKey: ["/api/dashboard/stats", employee.employerId],
          });
        }

        // Remove specific employee queries to force fresh data on next visit
        queryClient.removeQueries({
          queryKey: ["/api/time-entries/employee", employeeId],
        });
        
        queryClient.removeQueries({
          queryKey: ["/api/pto-entries/employee", employeeId],
        });
        
        queryClient.removeQueries({
          queryKey: ["/api/misc-hours-entries/employee", employeeId],
        });
        
        queryClient.removeQueries({
          queryKey: ["/api/reimbursement-entries/employee", employeeId],
        });
      }, 100);
    },
    onSettled: () => {
      if (employee?.employerId) {
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats", employee.employerId] });
      }
    },
  });

  const handleSubmit = async () => {
    try {
      // Validate required fields
      if (!employeeId) {
        toast({ title: "Error", description: "Employee ID is required", variant: "destructive" });
        return;
      }
      
      if (!payPeriod || !payPeriod.start || !payPeriod.end) {
        toast({ title: "Error", description: "Pay period is required", variant: "destructive" });
        return;
      }

      // Validate time entries
      let hasValidTimeEntries = false;
      for (const day of days) {
        for (const shift of day.shifts) {
          if (shift.timeIn && shift.timeOut) {
            hasValidTimeEntries = true;
            // Validate time format
            if (!/^\d{2}:\d{2}$/.test(shift.timeIn) || !/^\d{2}:\d{2}$/.test(shift.timeOut)) {
              toast({ 
                title: "Error", 
                description: `Invalid time format for ${day.date}. Please use HH:MM format.`, 
                variant: "destructive" 
              });
              return;
            }
          }
        }
      }

      const payload = {
        employeeId,
        payPeriod,
        days,
        ptoHours: Number(ptoHours) || 0,
        holidayNonWorked: Number(holidayNonWorked) || 0,
        holidayWorked: Number(holidayWorked) || 0,
        milesDriven: Number(milesDriven) || 0,
        miscHours: Number(miscHours) || 0,
        reimbursement: { 
          amount: Number(reimbAmt) || 0, 
          description: reimbDesc || "" 
        },
        notes: notes || "",
      };
      
      console.log("Submitting payload:", payload);
      saveTimeEntries.mutate(payload);
    } catch (error) {
      console.error("Submit validation error:", error);
      toast({ 
        title: "Error", 
        description: "Failed to validate timecard data. Please check your entries.", 
        variant: "destructive" 
      });
    }
  };

  return (
    <div className="flex gap-6">
      <div className="flex-1 space-y-3">
        {days.map((day) => (
          <div key={day.date} className="border p-3 rounded-md">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">
                {day.date}, {getDayOfWeek(day.date)}
              </span>
              <Button size="sm" variant="outline" onClick={() => addShift(day.date)}>
                + Add Shift
              </Button>
            </div>
            <div className="grid grid-cols-5 gap-2 text-xs font-medium text-muted-foreground mb-1">
              <span>Time In</span>
              <span>Time Out</span>
              <span>Lunch</span>
              <span>Total</span>
              <span></span>
            </div>
            {day.shifts.map((shift, idx) => (
              <div key={idx} className="grid grid-cols-5 gap-2 mb-2">
                <Input
                  type="time"
                  value={shift.timeIn}
                  onChange={(e) => updateShift(day.date, idx, "timeIn", e.target.value)}
                />
                <Input
                  type="time"
                  value={shift.timeOut}
                  onChange={(e) => updateShift(day.date, idx, "timeOut", e.target.value)}
                />
                <Input
                  type="number"
                  value={shift.lunch}
                  onChange={(e) => updateShift(day.date, idx, "lunch", parseInt(e.target.value) || 0)}
                  placeholder="Lunch"
                />
                <div className="flex items-center justify-between text-sm">
                  <span>{calculateHoursFromTimecard(shift.timeIn, shift.timeOut, shift.lunch).totalHours.toFixed(2)}h</span>
                  <Button size="sm" variant="ghost" onClick={() => removeShift(day.date, idx)} className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <div className="text-right text-sm font-medium">Daily Total: {calculateDayTotal(day).toFixed(2)}h</div>
          </div>
        ))}
        <div className="border p-3 rounded-md space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PTO Hours</label>
              <Input
                type="number"
                value={ptoHours}
                onChange={(e) => setPtoHours(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                step="0.25"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Holiday (Non-Worked)</label>
              <Input
                type="number"
                value={holidayNonWorked}
                onChange={(e) => setHolidayNonWorked(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                step="0.25"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Holiday (Worked)</label>
              <Input
                type="number"
                value={holidayWorked}
                onChange={(e) => setHolidayWorked(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                step="0.25"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Miles Driven</label>
              <Input
                type="number"
                value={milesDriven}
                onChange={(e) => setMilesDriven(parseFloat(e.target.value) || 0)}
                placeholder="0"
                step="1"
                min="0"
              />
              {employer && milesDriven > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  ${(milesDriven * parseFloat(employer.mileageRate || '0.655')).toFixed(2)} at ${parseFloat(employer.mileageRate || '0.655').toFixed(3)}/mile
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Misc. Hours</label>
              <Input
                type="number"
                value={miscHours}
                onChange={(e) => setMiscHours(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                step="0.25"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reimbursement Amount</label>
              <Input
                type="number"
                value={reimbAmt}
                onChange={(e) => setReimbAmt(parseFloat(e.target.value) || 0)}
                placeholder="$0.00"
                step="0.01"
                min="0"
              />
              {employer && milesDriven > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  + ${(milesDriven * parseFloat(employer.mileageRate || '0.655')).toFixed(2)} mileage (auto-added)
                </div>
              )}
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Reimbursement Description</label>
              <Input
                value={reimbDesc}
                onChange={(e) => setReimbDesc(e.target.value)}
                placeholder="Description of reimbursement"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <Input 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
              placeholder="Additional notes or comments" 
            />
          </div>
        </div>
        <div className="pt-4 text-right">
          <Button 
            onClick={handleSubmit} 
            className="payroll-button-primary"
            disabled={saveTimeEntries.isPending}
          >
            {saveTimeEntries.isPending ? "Saving & Returning..." : "Save"}
          </Button>
          {saveTimeEntries.isPending && (
            <p className="text-xs text-muted-foreground mt-2">
              Please wait while we save your timecard data...
            </p>
          )}
        </div>
      </div>
      <div className="w-48 sticky top-20 h-fit border p-3 rounded-md bg-muted">
        <p className="font-medium mb-2">Summary</p>
        <div className="text-sm space-y-1">
          <div className="flex justify-between"><span>Regular:</span><span>{totals.regular.toFixed(2)}h</span></div>
          <div className="flex justify-between"><span>Overtime:</span><span>{totals.overtime.toFixed(2)}h</span></div>
          <div className="flex justify-between"><span>PTO:</span><span>{ptoHours.toFixed(2)}h</span></div>
          <div className="flex justify-between"><span>Holiday:</span><span>{holidayNonWorked.toFixed(2)}h</span></div>
          <div className="flex justify-between"><span>Holiday Worked:</span><span>{holidayWorked.toFixed(2)}h</span></div>
          {milesDriven > 0 && employee && (
            <div className="flex justify-between"><span>Mileage:</span><span>{milesDriven} mi</span></div>
          )}
          <div className="flex justify-between">
            <span>Reimb:</span>
            <span>
              ${(reimbAmt + (employer && milesDriven > 0 ? milesDriven * parseFloat(employer.mileageRate || '0.655') : 0)).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between font-semibold"><span>Total Hours:</span><span>{(totals.totalHours + ptoHours + holidayNonWorked + holidayWorked).toFixed(2)}h</span></div>
        </div>
      </div>
    </div>
  );
}
