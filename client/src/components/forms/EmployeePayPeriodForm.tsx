import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { calculateHoursFromTimecard } from "@/lib/payrollUtils";
import { getDayOfWeek } from "@/lib/dateUtils";
import { useToast } from "@/hooks/use-toast";

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

  const { data: existingEntries = [] } = useQuery<any[]>({
    queryKey: ["/api/time-entries/employee", employeeId, start, end],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/time-entries/employee/${employeeId}?start=${start}&end=${end}`
      ).then((res) => res.json()),
    enabled: !!employeeId,
  });

  const { data: existingPtoEntries = [] } = useQuery<any[]>({
    queryKey: ["/api/pto-entries/employee", employeeId],
    queryFn: () =>
      apiRequest("GET", `/api/pto-entries/employee/${employeeId}`).then((res) => res.json()),
    enabled: !!employeeId,
  });

  const { data: existingMiscEntries = [] } = useQuery<any[]>({
    queryKey: ["/api/misc-hours-entries/employee", employeeId],
    queryFn: () =>
      apiRequest("GET", `/api/misc-hours-entries/employee/${employeeId}`).then((res) => res.json()),
    enabled: !!employeeId,
  });

  const { data: existingReimbEntries = [] } = useQuery<any[]>({
    queryKey: ["/api/reimbursement-entries/employee", employeeId],
    queryFn: () =>
      apiRequest("GET", `/api/reimbursement-entries/employee/${employeeId}`).then((res) => res.json()),
    enabled: !!employeeId,
  });

  const generateDays = () => {
    const startDate = new Date(start);
    const days: DayEntry[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      days.push({ date: dateStr, shifts: [{ timeIn: "", timeOut: "", lunch: 0 }] });
    }
    return days;
  };

  const [days, setDays] = useState<DayEntry[]>(generateDays());
  const [ptoHours, setPtoHours] = useState(0);
  const [holidayNonWorked, setHolidayNonWorked] = useState(0);
  const [holidayWorked, setHolidayWorked] = useState(0);
  const [milesDriven, setMilesDriven] = useState(0);
  const [reimbAmt, setReimbAmt] = useState(0);
  const [reimbDesc, setReimbDesc] = useState("");
  const [notes, setNotes] = useState("");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (existingEntries.length > 0) {
      setDays((prev) => {
        const map: Record<string, DayEntry> = {};
        prev.forEach((d) => (map[d.date] = { ...d, shifts: [] }));
        existingEntries.forEach((e: any) => {
          const date = e.timeIn.split("T")[0];
          if (!map[date]) {
            map[date] = { date, shifts: [] };
          }
          map[date].shifts.push({
            timeIn: e.timeIn.split("T")[1]?.slice(0, 5) || "",
            timeOut: e.timeOut?.split("T")[1]?.slice(0, 5) || "",
            lunch: e.lunchMinutes || 0,
          });
        });
        return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingEntries.length]);

  // Populate PTO hours from existing entries
  useEffect(() => {
    if (existingPtoEntries.length > 0) {
      const periodPto = existingPtoEntries.filter(p => 
        p.entryDate >= start && p.entryDate <= end
      ).reduce((sum, p) => sum + parseFloat(p.hours), 0);
      setPtoHours(periodPto);
    }
  }, [existingPtoEntries, start, end]);

  // Populate misc hours from existing entries
  useEffect(() => {
    if (existingMiscEntries.length > 0) {
      const periodMisc = existingMiscEntries.filter(m => 
        m.entryDate >= start && m.entryDate <= end
      );
      
      const holidayHours = periodMisc.filter(m => m.entryType === 'holiday')
        .reduce((sum, m) => sum + parseFloat(m.hours), 0);
      const holidayWorkedHours = periodMisc.filter(m => m.entryType === 'holiday-worked')
        .reduce((sum, m) => sum + parseFloat(m.hours), 0);
      
      setHolidayNonWorked(holidayHours);
      setHolidayWorked(holidayWorkedHours);
    }
  }, [existingMiscEntries, start, end]);

  // Populate reimbursement from existing entries
  useEffect(() => {
    if (existingReimbEntries.length > 0) {
      const periodReimb = existingReimbEntries.filter(r => 
        r.entryDate >= start && r.entryDate <= end
      );
      
      if (periodReimb.length > 0) {
        const reimbEntry = periodReimb[0]; // Get the first (most recent) entry
        const description = reimbEntry.description || "";
        const totalAmount = parseFloat(reimbEntry.amount);
        
        // Parse combined reimbursement entry
        let mileageAmount = 0;
        let otherAmount = totalAmount;
        let otherDesc = "";
        
        // Extract mileage info if present
        const mileageMatch = description.match(/Mileage: (\d+(?:\.\d+)?) miles \(\$(\d+(?:\.\d+)?)\)/);
        if (mileageMatch) {
          setMilesDriven(parseFloat(mileageMatch[1]));
          mileageAmount = parseFloat(mileageMatch[2]);
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
    }
  }, [existingReimbEntries, start, end]);

  // Debounced effect to refresh pay period summary when mileage/reimbursement changes
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (employee?.employerId && (milesDriven > 0 || reimbAmt > 0)) {
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats", employee.employerId] });
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeout);
  }, [milesDriven, reimbAmt, employee?.employerId, queryClient]);

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

  const calculateDayTotal = (day: DayEntry) => {
    return day.shifts.reduce((sum, s) => {
      const hrs = calculateHoursFromTimecard(s.timeIn, s.timeOut, s.lunch).totalHours;
      return sum + hrs;
    }, 0);
  };

  const totals = days.reduce(
    (acc, d) => {
      const dayTotal = calculateDayTotal(d);
      acc.totalHours += dayTotal;
      if (dayTotal > 8) {
        acc.overtime += dayTotal - 8;
        acc.regular += 8;
      } else {
        acc.regular += dayTotal;
      }
      return acc;
    },
    { regular: 0, overtime: 0, totalHours: 0 }
  );

  const saveTimeEntries = useMutation({
    mutationFn: async (payload: any) => {
      // Save time entries for each day with shifts
      for (const day of payload.days) {
        for (const shift of day.shifts) {
          if (shift.timeIn && shift.timeOut) {
            // Combine date and time into proper timestamps
            const timeInTimestamp = new Date(`${day.date}T${shift.timeIn}:00`);
            const timeOutTimestamp = new Date(`${day.date}T${shift.timeOut}:00`);
            
            await apiRequest("POST", "/api/time-entries", {
              employeeId: payload.employeeId,
              timeIn: timeInTimestamp.toISOString(),
              timeOut: timeOutTimestamp.toISOString(),
              lunchMinutes: shift.lunch,
              notes: payload.notes || ""
            });
          }
        }
      }

      // Delete existing entries in this pay period first to avoid duplicates
      const existingPtoForPeriod = existingPtoEntries.filter(p => 
        p.entryDate >= payload.payPeriod.start && p.entryDate <= payload.payPeriod.end
      );
      for (const pto of existingPtoForPeriod) {
        await apiRequest("DELETE", `/api/pto-entries/${pto.id}`);
      }

      const existingMiscForPeriod = existingMiscEntries.filter(m => 
        m.entryDate >= payload.payPeriod.start && m.entryDate <= payload.payPeriod.end
      );
      for (const misc of existingMiscForPeriod) {
        await apiRequest("DELETE", `/api/misc-hours-entries/${misc.id}`);
      }

      const existingReimbForPeriod = existingReimbEntries.filter(r => 
        r.entryDate >= payload.payPeriod.start && r.entryDate <= payload.payPeriod.end
      );
      for (const reimb of existingReimbForPeriod) {
        await apiRequest("DELETE", `/api/reimbursement-entries/${reimb.id}`);
      }

      // Save PTO entry if any
      if (payload.ptoHours > 0) {
        await apiRequest("POST", "/api/pto-entries", {
          employeeId: payload.employeeId,
          entryDate: payload.payPeriod.start,
          hours: payload.ptoHours.toString(),
          description: "PTO hours"
        });
      }

      // Save holiday non-worked entry if any
      if (payload.holidayNonWorked > 0) {
        await apiRequest("POST", "/api/misc-hours-entries", {
          employeeId: payload.employeeId,
          entryDate: payload.payPeriod.start,
          hours: payload.holidayNonWorked.toString(),
          entryType: "holiday",
          description: "Holiday (non-worked)"
        });
      }

      // Save holiday worked entry if any
      if (payload.holidayWorked > 0) {
        await apiRequest("POST", "/api/misc-hours-entries", {
          employeeId: payload.employeeId,
          entryDate: payload.payPeriod.start,
          hours: payload.holidayWorked.toString(),
          entryType: "holiday-worked",
          description: "Holiday worked"
        });
      }

      // Save combined reimbursement entry (includes mileage + other reimbursements)
      const mileageAmount = payload.milesDriven > 0 && employee ? 
        payload.milesDriven * parseFloat(employee.mileageRate || '0') : 0;
      const totalReimbursement = payload.reimbursement.amount + mileageAmount;
      
      if (totalReimbursement > 0) {
        let description = "";
        if (payload.milesDriven > 0 && employee) {
          description += `Mileage: ${payload.milesDriven} miles ($${mileageAmount.toFixed(2)})`;
        }
        if (payload.reimbursement.amount > 0) {
          if (description) description += "; ";
          description += payload.reimbursement.description || "Other reimbursement";
        }
        
        await apiRequest("POST", "/api/reimbursement-entries", {
          employeeId: payload.employeeId,
          entryDate: payload.payPeriod.start,
          amount: totalReimbursement.toString(),
          description: description || "Reimbursement"
        });
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Timecard data saved successfully",
      });
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries/employee", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["/api/pto-entries/employee", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["/api/misc-hours-entries/employee", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["/api/reimbursement-entries/employee", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["/api/timecards/pay-period"] });
      // Invalidate dashboard stats with employer ID to refresh pay period summary
      if (employee?.employerId) {
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats", employee.employerId] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save timecard data",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async () => {
    const payload = {
      employeeId,
      payPeriod,
      days,
      ptoHours,
      holidayNonWorked,
      holidayWorked,
      milesDriven,
      reimbursement: { amount: reimbAmt, description: reimbDesc },
      notes,
    };
    
    saveTimeEntries.mutate(payload);
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
            <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground mb-1">
              <span>Time In</span>
              <span>Time Out</span>
              <span>Lunch</span>
              <span>Total</span>
            </div>
            {day.shifts.map((shift, idx) => (
              <div key={idx} className="grid grid-cols-4 gap-2 mb-2">
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
                <div className="flex items-center text-sm">
                  {calculateHoursFromTimecard(shift.timeIn, shift.timeOut, shift.lunch).totalHours.toFixed(2)}h
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
              {employee && milesDriven > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  ${(milesDriven * parseFloat(employee.mileageRate || '0')).toFixed(2)} at ${parseFloat(employee.mileageRate || '0').toFixed(3)}/mile
                </div>
              )}
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
              {employee && milesDriven > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  + ${(milesDriven * parseFloat(employee.mileageRate || '0')).toFixed(2)} mileage (auto-added)
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
            {saveTimeEntries.isPending ? "Saving..." : "Save"}
          </Button>
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
          <div className="flex justify-between"><span>Reimb:</span><span>${reimbAmt.toFixed(2)}</span></div>
          <div className="flex justify-between font-semibold"><span>Total:</span><span>{(totals.totalHours + ptoHours + holidayNonWorked + holidayWorked).toFixed(2)}h</span></div>
        </div>
      </div>
    </div>
  );
}
