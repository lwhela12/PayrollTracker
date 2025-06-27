import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { calculateHoursFromTimecard } from "@/lib/payrollUtils";
import { getDayOfWeek } from "@/lib/dateUtils";

interface EmployeePayPeriodFormProps {
  employeeId: number;
  payPeriod: { start: string; end: string };
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

export function EmployeePayPeriodForm({ employeeId, payPeriod }: EmployeePayPeriodFormProps) {
  const { start, end } = payPeriod;

  const { data: existingEntries = [] } = useQuery<any[]>({
    queryKey: ["/api/time-entries/employee", employeeId, start, end],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/time-entries/employee/${employeeId}?start=${start}&end=${end}`
      ).then((res) => res.json()),
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
  const [reimbAmt, setReimbAmt] = useState(0);
  const [reimbDesc, setReimbDesc] = useState("");
  const [notes, setNotes] = useState("");

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

  const handleSubmit = async () => {
    const payload = {
      employeeId,
      payPeriod,
      days,
      ptoHours,
      holidayNonWorked,
      holidayWorked,
      reimbursement: { amount: reimbAmt, description: reimbDesc },
      notes,
    };
    console.log("submit", payload);
    // Placeholder for API submission
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
            <Input
              type="number"
              value={ptoHours}
              onChange={(e) => setPtoHours(parseFloat(e.target.value) || 0)}
              placeholder="PTO Hours"
            />
            <Input
              type="number"
              value={holidayNonWorked}
              onChange={(e) => setHolidayNonWorked(parseFloat(e.target.value) || 0)}
              placeholder="Holiday (Non-Worked)"
            />
            <Input
              type="number"
              value={holidayWorked}
              onChange={(e) => setHolidayWorked(parseFloat(e.target.value) || 0)}
              placeholder="Holiday (Worked)"
            />
            <Input
              type="number"
              value={reimbAmt}
              onChange={(e) => setReimbAmt(parseFloat(e.target.value) || 0)}
              placeholder="Reimbursement $"
            />
            <Input
              value={reimbDesc}
              onChange={(e) => setReimbDesc(e.target.value)}
              placeholder="Reimbursement Description"
            />
          </div>
          <div>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" />
          </div>
        </div>
        <div className="pt-4 text-right">
          <Button onClick={handleSubmit} className="payroll-button-primary">
            Save
          </Button>
        </div>
      </div>
      <div className="w-48 sticky top-20 h-fit border p-3 rounded-md bg-muted">
        <p className="font-medium mb-2">Summary</p>
        <div className="text-sm space-y-1">
          <div className="flex justify-between"><span>Regular:</span><span>{totals.regular.toFixed(2)}h</span></div>
          <div className="flex justify-between"><span>Overtime:</span><span>{totals.overtime.toFixed(2)}h</span></div>
          <div className="flex justify-between"><span>PTO:</span><span>{ptoHours.toFixed(2)}h</span></div>
          <div className="flex justify-between"><span>Holiday:</span><span>{(holidayNonWorked + holidayWorked).toFixed(2)}h</span></div>
          <div className="flex justify-between"><span>Reimb:</span><span>${reimbAmt.toFixed(2)}</span></div>
          <div className="flex justify-between font-semibold"><span>Total:</span><span>{(totals.totalHours + ptoHours + holidayNonWorked + holidayWorked).toFixed(2)}h</span></div>
        </div>
      </div>
    </div>
  );
}
