import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { EmployerForm } from "@/components/employer-form";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: employers = [] } = useQuery<any[]>({
    queryKey: ["/api/employers"],
    enabled: !!user,
  });

  const employer = employers[0];

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/employers"] });
    toast({ title: "Success", description: "Company profile updated" });
  };

  if (!employer) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar selectedEmployer={employer} user={user} />
      <div className="md:ml-48 min-h-screen">
        <Header
          title="Settings"
          description="Manage company settings"
          user={user}
        />
        <main className="p-4 md:p-6">
          <Card className="payroll-card max-w-2xl">
            <CardHeader>
              <CardTitle>Company Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <EmployerForm
                employer={employer}
                onSuccess={handleSuccess}
                onCancel={() => {}}
              />
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
