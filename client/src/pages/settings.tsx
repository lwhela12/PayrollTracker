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
    <div className="flex h-screen bg-background">
      <Sidebar selectedEmployer={employer} user={user} />
      <div className="flex-1 overflow-hidden">
        <Header
          title="Settings"
          description="Manage company settings"
          user={user}
        />
        <div className="p-6 overflow-y-auto h-full">
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
        </div>
      </div>
    </div>
  );
}
