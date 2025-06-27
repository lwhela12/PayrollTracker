import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { X, Edit, CheckCircle, Clock, AlertTriangle, Save, XCircle } from "lucide-react";
import { formatDate, getShortDayOfWeek, formatTime } from "@/lib/dateUtils";
import { calculateWeeklyHours, formatHours } from "@/lib/payrollUtils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TimecardModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: any;
  timecards: any[];
  payPeriod: any;
}

export function TimecardModal({ isOpen, onClose, employee, timecards, payPeriod }: TimecardModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isApproving, setIsApproving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTimecard, setEditingTimecard] = useState<any>(null);

  const weeklyTotals = calculateWeeklyHours(timecards);

  const approveTimecardsMutation = useMutation({
    mutationFn: async () => {
      const promises = timecards
        .filter(tc => !tc.isApproved)
        .map(tc => apiRequest("PUT", `/api/timecards/${tc.id}`, { isApproved: true }));
      
      await Promise.all(promises);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Timecards approved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/timecards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const saveTimecardMutation = useMutation({
    mutationFn: async (updatedTimecard: any) => {
      return apiRequest("PUT", `/api/timecards/${updatedTimecard.id}`, updatedTimecard);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Timecard updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/timecards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setIsEditing(false);
      setEditingTimecard(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEditClick = () => {
    if (timecards.length > 0) {
      setEditingTimecard({ ...timecards[0] });
      setIsEditing(true);
    }
  };

  const handleSaveClick = () => {
    if (editingTimecard) {
      saveTimecardMutation.mutate(editingTimecard);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingTimecard(null);
  };

  const handleFieldChange = (field: string, value: any) => {
    setEditingTimecard((prev: any) => ({
      ...prev,
      [field]: value
    }));
  };

  const getTimecardStatus = (timecard: any) => {
    if (timecard.isApproved) {
      return {
        icon: CheckCircle,
        label: "Approved",
        variant: "default" as const,
        className: "status-complete"
      };
    }
    return {
      icon: Clock,
      label: "Pending",
      variant: "secondary" as const,
      className: "status-pending"
    };
  };

  const hasUnapprovedTimecards = timecards.some(tc => !tc.isApproved);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">
              Timecard Details - {employee.firstName} {employee.lastName}
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Pay Period Header */}
          <Card className="payroll-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-primary">
                    Pay Period: {formatDate(payPeriod.startDate)} - {formatDate(payPeriod.endDate)}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Employee: {employee.firstName} {employee.lastName} ({employee.employeeId})
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">
                    {formatHours(weeklyTotals.totalHours)} hrs
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total Hours
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="payroll-card">
              <CardContent className="p-4 text-center">
                <div className="text-xl font-bold text-secondary">
                  {formatHours(weeklyTotals.totalRegularHours)}
                </div>
                <div className="text-sm text-muted-foreground">Regular Hours</div>
              </CardContent>
            </Card>
            
            <Card className="payroll-card">
              <CardContent className="p-4 text-center">
                <div className="text-xl font-bold text-accent">
                  {formatHours(weeklyTotals.totalOvertimeHours)}
                </div>
                <div className="text-sm text-muted-foreground">Overtime Hours</div>
              </CardContent>
            </Card>
            
            <Card className="payroll-card">
              <CardContent className="p-4 text-center">
                <div className="text-xl font-bold text-primary">
                  {timecards.reduce((sum, tc) => sum + (tc.totalMiles || 0), 0)}
                </div>
                <div className="text-sm text-muted-foreground">Total Miles</div>
              </CardContent>
            </Card>
            
            <Card className="payroll-card">
              <CardContent className="p-4 text-center">
                <div className="text-xl font-bold">
                  {timecards.filter(tc => tc.isApproved).length}/{timecards.length}
                </div>
                <div className="text-sm text-muted-foreground">Approved Days</div>
              </CardContent>
            </Card>
          </div>
          
          {/* Timecard Details Table */}
          <Card className="payroll-card">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="payroll-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Day</th>
                      <th>Time In</th>
                      <th>Time Out</th>
                      <th>Lunch</th>
                      <th>Regular Hours</th>
                      <th>OT Hours</th>
                      <th>Miles</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timecards.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-8 text-muted-foreground">
                          <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                          No timecard entries found for this pay period
                        </td>
                      </tr>
                    ) : (
                      timecards
                        .sort((a, b) => new Date(a.workDate).getTime() - new Date(b.workDate).getTime())
                        .map((timecard) => {
                          const status = getTimecardStatus(timecard);
                          const StatusIcon = status.icon;
                          
                          const isCurrentlyEditing = isEditing && editingTimecard?.id === timecard.id;
                          
                          return (
                            <tr key={timecard.id} className="hover:bg-muted/30">
                              <td className="font-medium">
                                {formatDate(timecard.workDate)}
                              </td>
                              <td>{getShortDayOfWeek(timecard.workDate)}</td>
                              <td>
                                {isCurrentlyEditing ? (
                                  <Input
                                    type="text"
                                    value={editingTimecard.timeIn || ""}
                                    onChange={(e) => handleFieldChange("timeIn", e.target.value)}
                                    className="w-24 h-8"
                                  />
                                ) : (
                                  timecard.timeIn ? formatTime(timecard.timeIn) : "-"
                                )}
                              </td>
                              <td>
                                {isCurrentlyEditing ? (
                                  <Input
                                    type="text"
                                    value={editingTimecard.timeOut || ""}
                                    onChange={(e) => handleFieldChange("timeOut", e.target.value)}
                                    className="w-24 h-8"
                                  />
                                ) : (
                                  timecard.timeOut ? formatTime(timecard.timeOut) : "-"
                                )}
                              </td>
                              <td>
                                {isCurrentlyEditing ? (
                                  <Input
                                    type="number"
                                    value={editingTimecard.lunchMinutes || 0}
                                    onChange={(e) => handleFieldChange("lunchMinutes", parseInt(e.target.value) || 0)}
                                    className="w-16 h-8"
                                    min="0"
                                  />
                                ) : (
                                  `${timecard.lunchMinutes || 0} min`
                                )}
                              </td>
                              <td className="font-medium">
                                {isCurrentlyEditing ? (
                                  <Input
                                    type="number"
                                    step="0.25"
                                    value={editingTimecard.regularHours || "0.00"}
                                    onChange={(e) => handleFieldChange("regularHours", e.target.value)}
                                    className="w-20 h-8"
                                    min="0"
                                  />
                                ) : (
                                  formatHours(parseFloat(timecard.regularHours || '0'))
                                )}
                              </td>
                              <td className="font-medium text-accent">
                                {isCurrentlyEditing ? (
                                  <Input
                                    type="number"
                                    step="0.25"
                                    value={editingTimecard.overtimeHours || "0.00"}
                                    onChange={(e) => handleFieldChange("overtimeHours", e.target.value)}
                                    className="w-20 h-8"
                                    min="0"
                                  />
                                ) : (
                                  formatHours(parseFloat(timecard.overtimeHours || '0'))
                                )}
                              </td>
                              <td>
                                {isCurrentlyEditing ? (
                                  <Input
                                    type="number"
                                    value={editingTimecard.totalMiles || 0}
                                    onChange={(e) => handleFieldChange("totalMiles", parseInt(e.target.value) || 0)}
                                    className="w-16 h-8"
                                    min="0"
                                  />
                                ) : (
                                  timecard.totalMiles || 0
                                )}
                              </td>
                              <td>
                                <Badge variant={status.variant} className={`status-badge ${status.className}`}>
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {status.label}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                  {timecards.length > 0 && (
                    <tfoot className="bg-muted/30">
                      <tr className="font-semibold">
                        <td colSpan={5} className="text-right">Totals:</td>
                        <td>{formatHours(weeklyTotals.totalRegularHours)}</td>
                        <td className="text-accent">{formatHours(weeklyTotals.totalOvertimeHours)}</td>
                        <td>{timecards.reduce((sum, tc) => sum + (tc.totalMiles || 0), 0)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>
          
          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            
            {isEditing ? (
              <>
                <Button 
                  variant="outline"
                  onClick={handleCancelEdit}
                  disabled={saveTimecardMutation.isPending}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button 
                  variant="default"
                  onClick={handleSaveClick}
                  disabled={saveTimecardMutation.isPending}
                >
                  {saveTimecardMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Button 
                variant="outline"
                className="text-primary hover:text-primary/80 border-primary hover:border-primary/80"
                onClick={handleEditClick}
                disabled={timecards.length === 0}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Timecard
              </Button>
            )}
            
            {hasUnapprovedTimecards && !isEditing && (
              <Button 
                className="payroll-button-secondary"
                onClick={() => approveTimecardsMutation.mutate()}
                disabled={approveTimecardsMutation.isPending}
              >
                {approveTimecardsMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve All
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
