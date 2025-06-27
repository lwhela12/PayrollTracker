import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Calendar, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatDate } from "@/lib/dateUtils";
import { useCompany } from "@/context/company";
import { useLocation } from "wouter";

export default function Reports() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { employerId: selectedEmployerId, setEmployerId: setSelectedEmployerId } = useCompany();
  const [selectedPayPeriodId, setSelectedPayPeriodId] = useState<string>("");
  const [reportType, setReportType] = useState("payroll_summary");
  const [format, setFormat] = useState("pdf");

  // Fetch employers
  const { data: employers = [] } = useQuery<any[]>({
    queryKey: ["/api/employers"],
    enabled: !!user,
  });

  // Set first employer as default
  useEffect(() => {
    if (employers && employers.length > 0 && !selectedEmployerId) {
      setSelectedEmployerId(employers[0].id);
    }
  }, [employers, selectedEmployerId]);

  // Fetch pay periods
  const { data: payPeriods = [] } = useQuery<any[]>({
    queryKey: ["/api/pay-periods", selectedEmployerId],
    queryFn: async () => {
      const response = await fetch(`/api/pay-periods/${selectedEmployerId}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch pay periods');
      }
      return response.json();
    },
    enabled: !!selectedEmployerId,
  });

  // Fetch recent reports
  const { data: reports = [], isLoading: reportsLoading } = useQuery<any[]>({
    queryKey: ["/api/reports", selectedEmployerId],
    enabled: !!selectedEmployerId,
  });

  // Generate report mutation
  const generateReportMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/reports/generate", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Report generated successfully",
      });
      
      // Automatically download the report
      if (data.downloadUrl) {
        const link = document.createElement('a');
        link.href = data.downloadUrl;
        link.download = data.report.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      
      // Refresh reports list
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleGenerateReport = () => {
    if (!selectedEmployerId || !selectedPayPeriodId) {
      toast({
        title: "Error",
        description: "Please select a pay period",
        variant: "destructive",
      });
      return;
    }

    generateReportMutation.mutate({
      employerId: selectedEmployerId,
      payPeriodId: parseInt(selectedPayPeriodId),
      reportType,
      format,
    });
  };

  if (!employers || employers.length === 0) {
    const [, navigate] = useLocation();
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="payroll-card max-w-md mx-4">
          <CardHeader>
            <CardTitle>No Company Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              You need to set up your company profile first.
            </p>
            <Button
              className="payroll-button-primary w-full"
              onClick={() => navigate("/settings/create-company")}
            >
              Create Company Profile
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedEmployer = employers.find((emp: any) => emp.id === selectedEmployerId);
  const currentPayPeriod = payPeriods?.find((pp: any) => pp.isActive);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar selectedEmployer={selectedEmployer} currentPayPeriod={currentPayPeriod} user={user} />
      
      <div className="md:ml-64 min-h-screen">
        <Header 
          title="Report Generation"
          description="Generate and export payroll reports"
          user={user}
        />

        <main className="p-4 md:p-6 pt-20 md:pt-24">
          <div className="w-full">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Report Generation */}
              <Card className="payroll-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Generate New Report
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="mb-4 p-4 bg-muted/30 rounded-lg border-2 border-dashed border-border">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground text-center">
                    Professional payroll reports ready for export
                  </p>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Report Type</Label>
                    <Select value={reportType} onValueChange={setReportType}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="payroll_summary">Payroll Summary Report</SelectItem>
                        <SelectItem value="detailed_timecard">Detailed Timecard Report</SelectItem>
                        <SelectItem value="employee_hours">Employee Hours Report</SelectItem>
                        <SelectItem value="mileage_reimbursement">Mileage & Reimbursement Report</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">Pay Period</Label>
                    <Select value={selectedPayPeriodId} onValueChange={setSelectedPayPeriodId}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select pay period" />
                      </SelectTrigger>
                      <SelectContent>
                        {payPeriods?.map((pp: any) => (
                          <SelectItem key={pp.id} value={pp.id.toString()}>
                            {formatDate(pp.startDate)} - {formatDate(pp.endDate)}
                            {pp.isActive && " (Current)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium mb-3 block">Export Format</Label>
                    <RadioGroup value={format} onValueChange={setFormat} className="flex gap-6">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="pdf" id="pdf" />
                        <Label htmlFor="pdf" className="text-sm">PDF Report</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="excel" id="excel" />
                        <Label htmlFor="excel" className="text-sm">Excel Spreadsheet</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 pt-4">
                    <Button 
                      className="payroll-button-secondary flex items-center justify-center"
                      onClick={handleGenerateReport}
                      disabled={generateReportMutation.isPending || format !== "pdf"}
                    >
                      {generateReportMutation.isPending && format === "pdf" ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                          Generating...
                        </>
                      ) : (
                        <>
                          <FileText className="h-4 w-4 mr-2" />
                          Generate PDF
                        </>
                      )}
                    </Button>
                    <Button 
                      className="payroll-button-primary flex items-center justify-center"
                      onClick={handleGenerateReport}
                      disabled={generateReportMutation.isPending || format !== "excel"}
                    >
                      {generateReportMutation.isPending && format === "excel" ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                          Generating...
                        </>
                      ) : (
                        <>
                          <FileText className="h-4 w-4 mr-2" />
                          Export Excel
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Reports */}
            <Card className="payroll-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Recent Reports
                </CardTitle>
              </CardHeader>
              <CardContent>
                {reportsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : !reports || reports.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p>No reports generated yet</p>
                    <p className="text-sm">Generate your first report to get started</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reports.slice(0, 10).map((report: any) => (
                      <div 
                        key={report.id}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded ${
                            report.format === 'pdf' 
                              ? 'bg-red-100 text-red-600' 
                              : 'bg-green-100 text-green-600'
                          }`}>
                            <FileText className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium text-sm">{report.fileName}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatDate(report.createdAt)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {report.format.toUpperCase()}
                          </Badge>
                          <Button
                            variant="ghost" 
                            size="sm"
                            className="text-primary hover:text-primary/80"
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = `/api/reports/download/${report.id}`;
                              link.download = report.fileName;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
