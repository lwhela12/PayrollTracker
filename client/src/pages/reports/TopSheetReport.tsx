import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/context/company";

export default function TopSheetReport() {
  const { user } = useAuth();
  const { employerId } = useCompany();
  const [payPeriodId, setPayPeriodId] = useState<string>("");

  const { data: employers = [] } = useQuery<any[]>({
    queryKey: ["/api/employers"],
    enabled: !!user,
  });

  const { data: payPeriods = [] } = useQuery<any[]>({
    queryKey: ["/api/pay-periods", employerId],
    enabled: !!employerId,
  });

  const { data: report } = useQuery<any>({
    queryKey: ["/api/reports/top-sheet", employerId, payPeriodId],
    enabled: !!employerId && !!payPeriodId,
  });

  const exportCsv = () => {
    if (!report) return;
    const headers = ["Employee Name","Regular","Overtime","PTO","Holiday Non-Worked","Holiday Worked","Reimbursement"];
    const rows = report.rows.map((r:any) => [r.name,r.regularHours,r.overtimeHours,r.ptoHours,r.holidayNonWorkedHours,r.holidayWorkedHours,r.reimbursement]);
    rows.push(["Totals",report.totals.regularHours,report.totals.overtimeHours,report.totals.ptoHours,report.totals.holidayNonWorkedHours,report.totals.holidayWorkedHours,report.totals.reimbursement]);
    const csv = [headers.join(','),...rows.map(r=>r.join(','))].join('\n');
    const blob = new Blob([csv],{type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'top_sheet.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedEmployer = employers.find((e:any)=>e.id===employerId);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar selectedEmployer={selectedEmployer} user={user} />
      <div className="md:ml-48">
        <Header title="Top Sheet" description="Payroll summary" user={user} />
        <main className="p-4 md:p-6 pt-16 md:pt-6 space-y-4">
          <Card className="payroll-card">
            <CardHeader>
              <CardTitle>Select Pay Period</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={payPeriodId} onValueChange={setPayPeriodId}>
                <SelectTrigger className="w-60">
                  <SelectValue placeholder="Choose period" />
                </SelectTrigger>
                <SelectContent>
                  {payPeriods.map((pp:any)=> (
                    <SelectItem key={pp.id} value={pp.id.toString()}>
                      {pp.startDate} - {pp.endDate}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {report && (
                <div className="overflow-x-auto">
                  <table className="payroll-table">
                    <thead>
                      <tr>
                        <th>Employee Name</th>
                        <th>Regular Hours</th>
                        <th>Overtime Hours</th>
                        <th>PTO Hours</th>
                        <th>Holiday (Non-Worked)</th>
                        <th>Holiday (Worked)</th>
                        <th>Reimbursement ($)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.rows.map((r:any)=> (
                        <tr key={r.id}>
                          <td>{r.name}</td>
                          <td>{r.regularHours.toFixed(2)}</td>
                          <td>{r.overtimeHours.toFixed(2)}</td>
                          <td>{r.ptoHours.toFixed(2)}</td>
                          <td>{r.holidayNonWorkedHours.toFixed(2)}</td>
                          <td>{r.holidayWorkedHours.toFixed(2)}</td>
                          <td>${r.reimbursement.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="font-medium">
                        <td>Totals</td>
                        <td>{report.totals.regularHours.toFixed(2)}</td>
                        <td>{report.totals.overtimeHours.toFixed(2)}</td>
                        <td>{report.totals.ptoHours.toFixed(2)}</td>
                        <td>{report.totals.holidayNonWorkedHours.toFixed(2)}</td>
                        <td>{report.totals.holidayWorkedHours.toFixed(2)}</td>
                        <td>${report.totals.reimbursement.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                  <div className="pt-4 text-right">
                    <Button className="payroll-button-primary" onClick={exportCsv}>Export to CSV</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
