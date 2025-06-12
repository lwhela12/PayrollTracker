import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatDate, getDayOfWeek } from "@/lib/dateUtils";

interface BiweeklyTimecardFormProps {
  employees: any[];
  currentPayPeriod?: any;
  preSelectedEmployeeId?: number | null;
}

interface TimecardEntry {
  workDate: string;
  timeIn: string;
  timeOut: string;
  lunchMinutes: number;
  regularHours: number;
  overtimeHours: number;
  ptoHours: number;
  holidayHours: number;
  startOdometer: number | null;
  endOdometer: number | null;
  notes: string;
}

export function BiweeklyTimecardForm({ employees, currentPayPeriod, preSelectedEmployeeId }: BiweeklyTimecardFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(preSelectedEmployeeId || null);
  const [timecardData, setTimecardData] = useState<Record<string, TimecardEntry>>({});
  const [showEmployeeSelector, setShowEmployeeSelector] = useState(!preSelectedEmployeeId);

  // Update selected employee when preSelectedEmployeeId changes
  useEffect(() => {
    if (preSelectedEmployeeId && preSelectedEmployeeId !== selectedEmployeeId) {
      setSelectedEmployeeId(preSelectedEmployeeId);
      setShowEmployeeSelector(false);
    }
  }, [preSelectedEmployeeId, selectedEmployeeId]);

  // Handle employee selection change
  const handleEmployeeChange = (employeeId: number | null) => {
    setSelectedEmployeeId(employeeId);
    if (employeeId) {
      navigate(`/timecards?employee=${employeeId}`);
    } else {
      navigate('/timecards');
    }
  };

  // Generate 14 days for the pay period
  const generatePayPeriodDays = () => {
    if (!currentPayPeriod) return [];
    
    const startDate = new Date(currentPayPeriod.startDate);
    const days = [];
    
    for (let i = 0; i < 14; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push(date.toISOString().split('T')[0]);
    }
    
    return days;
  };

  const payPeriodDays = generatePayPeriodDays();

  const calculateHours = (timeIn: string, timeOut: string, lunchMinutes: number): number => {
    if (!timeIn || !timeOut) return 0;
    
    const startTime = new Date(`2000-01-01T${timeIn}`);
    const endTime = new Date(`2000-01-01T${timeOut}`);
    
    const diffMs = endTime.getTime() - startTime.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    return Math.max(0, diffHours - (lunchMinutes / 60));
  };

  const updateTimecardEntry = (date: string, field: keyof TimecardEntry, value: any) => {
    setTimecardData(prev => {
      const entry = prev[date] || {
        workDate: date,
        timeIn: '',
        timeOut: '',
        lunchMinutes: 0,
        regularHours: 0,
        overtimeHours: 0,
        ptoHours: 0,
        holidayHours: 0,
        startOdometer: null,
        endOdometer: null,
        notes: ''
      };

      const updatedEntry = { ...entry, [field]: value };

      // Auto-calculate hours when time in/out changes
      if (field === 'timeIn' || field === 'timeOut' || field === 'lunchMinutes') {
        const totalHours = calculateHours(updatedEntry.timeIn, updatedEntry.timeOut, updatedEntry.lunchMinutes);
        updatedEntry.regularHours = Math.min(8, totalHours);
        updatedEntry.overtimeHours = Math.max(0, totalHours - 8);
      }

      return { ...prev, [date]: updatedEntry };
    });
  };

  const submitTimecard = useMutation({
    mutationFn: async () => {
      if (!selectedEmployeeId || !currentPayPeriod) {
        throw new Error("Please select an employee and ensure a pay period is active");
      }

      const timecardEntries = Object.values(timecardData).filter(entry => 
        entry.timeIn || entry.timeOut || entry.regularHours > 0 || entry.overtimeHours > 0 || 
        entry.ptoHours > 0 || entry.holidayHours > 0
      );

      for (const entry of timecardEntries) {
        await apiRequest("POST", "/api/timecards", {
          employeeId: selectedEmployeeId,
          payPeriodId: currentPayPeriod.id,
          ...entry
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timecards"] });
      toast({
        title: "Success",
        description: "Timecard submitted successfully",
      });
      setTimecardData({});
      setSelectedEmployeeId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!currentPayPeriod) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">No active pay period found. Please create a pay period first.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bi-Weekly Timecard Entry</CardTitle>
        {preSelectedEmployeeId && (
          <div className="text-sm text-blue-600 mb-1">
            Dashboard → {employees.find(emp => emp.id === selectedEmployeeId)?.firstName} {employees.find(emp => emp.id === selectedEmployeeId)?.lastName} Timecard
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          Pay Period: {formatDate(currentPayPeriod.startDate)} - {formatDate(currentPayPeriod.endDate)}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Employee Selection */}
        <div>
          {showEmployeeSelector ? (
            <>
              <label className="block text-sm font-medium mb-2">Select Employee</label>
              <select
                value={selectedEmployeeId || ''}
                onChange={(e) => handleEmployeeChange(Number(e.target.value) || null)}
                className="w-full p-2 border rounded-md"
              >
                <option value="">Choose an employee...</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div>
                <p className="text-sm font-medium text-blue-900">Selected Employee</p>
                <p className="text-lg font-semibold text-blue-800">
                  {employees.find(emp => emp.id === selectedEmployeeId)?.firstName}{' '}
                  {employees.find(emp => emp.id === selectedEmployeeId)?.lastName}
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowEmployeeSelector(true)}
                className="text-blue-700 border-blue-300 hover:bg-blue-100"
              >
                Change Employee
              </Button>
            </div>
          )}
        </div>

        {selectedEmployeeId && (
          <div className="space-y-4">
            {/* Week 1 */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Week 1</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border p-2 text-left">Date</th>
                      <th className="border p-2 text-left">Day</th>
                      <th className="border p-2 text-left">Time In</th>
                      <th className="border p-2 text-left">Time Out</th>
                      <th className="border p-2 text-left">Lunch (min)</th>
                      <th className="border p-2 text-left">Regular</th>
                      <th className="border p-2 text-left">Overtime</th>
                      <th className="border p-2 text-left">PTO</th>
                      <th className="border p-2 text-left">Holiday</th>
                      <th className="border p-2 text-left">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payPeriodDays.slice(0, 7).map(date => {
                      const entry = timecardData[date] || {};
                      return (
                        <tr key={date}>
                          <td className="border p-2">{formatDate(date)}</td>
                          <td className="border p-2">{getDayOfWeek(date)}</td>
                          <td className="border p-2">
                            <Input
                              type="time"
                              value={entry.timeIn || ''}
                              onChange={(e) => updateTimecardEntry(date, 'timeIn', e.target.value)}
                              className="w-24"
                            />
                          </td>
                          <td className="border p-2">
                            <Input
                              type="time"
                              value={entry.timeOut || ''}
                              onChange={(e) => updateTimecardEntry(date, 'timeOut', e.target.value)}
                              className="w-24"
                            />
                          </td>
                          <td className="border p-2">
                            <Input
                              type="number"
                              value={entry.lunchMinutes || ''}
                              onChange={(e) => updateTimecardEntry(date, 'lunchMinutes', Number(e.target.value) || 0)}
                              className="w-20"
                              min="0"
                              max="120"
                            />
                          </td>
                          <td className="border p-2">
                            <Input
                              type="number"
                              step="0.25"
                              value={entry.regularHours || ''}
                              onChange={(e) => updateTimecardEntry(date, 'regularHours', Number(e.target.value) || 0)}
                              className="w-20"
                              min="0"
                              max="24"
                            />
                          </td>
                          <td className="border p-2">
                            <Input
                              type="number"
                              step="0.25"
                              value={entry.overtimeHours || ''}
                              onChange={(e) => updateTimecardEntry(date, 'overtimeHours', Number(e.target.value) || 0)}
                              className="w-20"
                              min="0"
                              max="24"
                            />
                          </td>
                          <td className="border p-2">
                            <Input
                              type="number"
                              step="0.25"
                              value={entry.ptoHours || ''}
                              onChange={(e) => updateTimecardEntry(date, 'ptoHours', Number(e.target.value) || 0)}
                              className="w-20"
                              min="0"
                              max="24"
                            />
                          </td>
                          <td className="border p-2">
                            <Input
                              type="number"
                              step="0.25"
                              value={entry.holidayHours || ''}
                              onChange={(e) => updateTimecardEntry(date, 'holidayHours', Number(e.target.value) || 0)}
                              className="w-20"
                              min="0"
                              max="24"
                            />
                          </td>
                          <td className="border p-2">
                            <Input
                              value={entry.notes || ''}
                              onChange={(e) => updateTimecardEntry(date, 'notes', e.target.value)}
                              className="w-32"
                              placeholder="Notes..."
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Week 2 */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Week 2</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border p-2 text-left">Date</th>
                      <th className="border p-2 text-left">Day</th>
                      <th className="border p-2 text-left">Time In</th>
                      <th className="border p-2 text-left">Time Out</th>
                      <th className="border p-2 text-left">Lunch (min)</th>
                      <th className="border p-2 text-left">Regular</th>
                      <th className="border p-2 text-left">Overtime</th>
                      <th className="border p-2 text-left">PTO</th>
                      <th className="border p-2 text-left">Holiday</th>
                      <th className="border p-2 text-left">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payPeriodDays.slice(7, 14).map(date => {
                      const entry = timecardData[date] || {};
                      return (
                        <tr key={date}>
                          <td className="border p-2">{formatDate(date)}</td>
                          <td className="border p-2">{getDayOfWeek(date)}</td>
                          <td className="border p-2">
                            <Input
                              type="time"
                              value={entry.timeIn || ''}
                              onChange={(e) => updateTimecardEntry(date, 'timeIn', e.target.value)}
                              className="w-24"
                            />
                          </td>
                          <td className="border p-2">
                            <Input
                              type="time"
                              value={entry.timeOut || ''}
                              onChange={(e) => updateTimecardEntry(date, 'timeOut', e.target.value)}
                              className="w-24"
                            />
                          </td>
                          <td className="border p-2">
                            <Input
                              type="number"
                              value={entry.lunchMinutes || ''}
                              onChange={(e) => updateTimecardEntry(date, 'lunchMinutes', Number(e.target.value) || 0)}
                              className="w-20"
                              min="0"
                              max="120"
                            />
                          </td>
                          <td className="border p-2">
                            <Input
                              type="number"
                              step="0.25"
                              value={entry.regularHours || ''}
                              onChange={(e) => updateTimecardEntry(date, 'regularHours', Number(e.target.value) || 0)}
                              className="w-20"
                              min="0"
                              max="24"
                            />
                          </td>
                          <td className="border p-2">
                            <Input
                              type="number"
                              step="0.25"
                              value={entry.overtimeHours || ''}
                              onChange={(e) => updateTimecardEntry(date, 'overtimeHours', Number(e.target.value) || 0)}
                              className="w-20"
                              min="0"
                              max="24"
                            />
                          </td>
                          <td className="border p-2">
                            <Input
                              type="number"
                              step="0.25"
                              value={entry.ptoHours || ''}
                              onChange={(e) => updateTimecardEntry(date, 'ptoHours', Number(e.target.value) || 0)}
                              className="w-20"
                              min="0"
                              max="24"
                            />
                          </td>
                          <td className="border p-2">
                            <Input
                              type="number"
                              step="0.25"
                              value={entry.holidayHours || ''}
                              onChange={(e) => updateTimecardEntry(date, 'holidayHours', Number(e.target.value) || 0)}
                              className="w-20"
                              min="0"
                              max="24"
                            />
                          </td>
                          <td className="border p-2">
                            <Input
                              value={entry.notes || ''}
                              onChange={(e) => updateTimecardEntry(date, 'notes', e.target.value)}
                              className="w-32"
                              placeholder="Notes..."
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-4">
              <Button
                onClick={() => submitTimecard.mutate()}
                disabled={submitTimecard.isPending}
                className="payroll-button-primary"
              >
                {submitTimecard.isPending ? "Submitting..." : "Submit Timecard"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}