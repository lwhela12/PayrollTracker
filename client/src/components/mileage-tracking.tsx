import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Car, Save, Calculator } from "lucide-react";

interface MileageTrackingProps {
  employeeId: number;
  payPeriodId: number;
  employeeName: string;
}

export function MileageTracking({ employeeId, payPeriodId, employeeName }: MileageTrackingProps) {
  const { toast } = useToast();
  const [startOdometer, setStartOdometer] = useState<string>("");
  const [endOdometer, setEndOdometer] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);

  // Fetch existing mileage tracking data
  const { data: mileageData, isLoading } = useQuery({
    queryKey: ["/api/mileage-tracking", employeeId, payPeriodId],
    queryFn: () => 
      fetch(`/api/mileage-tracking/employee/${employeeId}/pay-period/${payPeriodId}`, {
        credentials: "include"
      }).then(res => res.json())
  });

  // Update form fields when data is loaded
  useEffect(() => {
    if (mileageData) {
      setStartOdometer(mileageData.startOdometer?.toString() || "");
      setEndOdometer(mileageData.endOdometer?.toString() || "");
      setNotes(mileageData.notes || "");
    } else if (!isLoading && mileageData === null) {
      // No existing data, enable editing mode
      setIsEditing(true);
    }
  }, [mileageData, isLoading]);

  // Create or update mileage tracking
  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/mileage-tracking", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mileage-tracking", employeeId, payPeriodId] });
      toast({ title: "Mileage tracking saved successfully" });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error saving mileage tracking", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/mileage-tracking/${mileageData.id}`, "PUT", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mileage-tracking", employeeId, payPeriodId] });
      toast({ title: "Mileage tracking updated successfully" });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error updating mileage tracking", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const handleSave = () => {
    const data = {
      employeeId,
      payPeriodId,
      startOdometer: startOdometer ? parseInt(startOdometer) : undefined,
      endOdometer: endOdometer ? parseInt(endOdometer) : undefined,
      notes: notes.trim() || undefined
    };

    if (mileageData) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleCancel = () => {
    // Reset to saved values
    if (mileageData) {
      setStartOdometer(mileageData.startOdometer?.toString() || "");
      setEndOdometer(mileageData.endOdometer?.toString() || "");
      setNotes(mileageData.notes || "");
    } else {
      setStartOdometer("");
      setEndOdometer("");
      setNotes("");
    }
    setIsEditing(false);
  };

  const calculateMiles = () => {
    const start = parseInt(startOdometer);
    const end = parseInt(endOdometer);
    if (!isNaN(start) && !isNaN(end) && end >= start) {
      return end - start;
    }
    return 0;
  };

  const totalMiles = calculateMiles();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Car className="h-4 w-4" />
            Mileage - {employeeName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Car className="h-4 w-4" />
          Mileage - {employeeName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isEditing ? (
          // View mode
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <Label className="text-muted-foreground">Start Odometer</Label>
                <div className="font-medium">
                  {mileageData?.startOdometer ? mileageData.startOdometer.toLocaleString() : "Not set"}
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">End Odometer</Label>
                <div className="font-medium">
                  {mileageData?.endOdometer ? mileageData.endOdometer.toLocaleString() : "Not set"}
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Total Miles</Label>
                <div className="font-medium flex items-center gap-1">
                  <Calculator className="h-3 w-3" />
                  {mileageData?.totalMiles || 0} miles
                </div>
              </div>
            </div>
            
            {mileageData?.notes && (
              <div>
                <Label className="text-muted-foreground">Notes</Label>
                <div className="text-sm">{mileageData.notes}</div>
              </div>
            )}
            
            <Button 
              onClick={() => setIsEditing(true)} 
              variant="outline" 
              size="sm"
            >
              {mileageData ? "Edit" : "Add Mileage"}
            </Button>
          </div>
        ) : (
          // Edit mode
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startOdometer">Start Odometer</Label>
                <Input
                  id="startOdometer"
                  type="number"
                  value={startOdometer}
                  onChange={(e) => setStartOdometer(e.target.value)}
                  placeholder="Starting odometer reading"
                />
              </div>
              <div>
                <Label htmlFor="endOdometer">End Odometer</Label>
                <Input
                  id="endOdometer"
                  type="number"
                  value={endOdometer}
                  onChange={(e) => setEndOdometer(e.target.value)}
                  placeholder="Ending odometer reading"
                />
              </div>
            </div>
            
            {totalMiles > 0 && (
              <div className="bg-muted/50 p-3 rounded-md">
                <div className="text-sm font-medium flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  Calculated Miles: {totalMiles.toLocaleString()}
                </div>
              </div>
            )}
            
            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about the mileage..."
                rows={2}
              />
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={handleSave} 
                size="sm"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                <Save className="h-3 w-3 mr-1" />
                Save
              </Button>
              <Button 
                onClick={handleCancel} 
                variant="outline" 
                size="sm"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}