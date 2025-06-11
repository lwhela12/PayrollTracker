import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Users, FileText, BarChart3 } from "lucide-react";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-primary">PayTracker Pro</h1>
            <p className="text-sm text-muted-foreground">Professional Payroll Management</p>
          </div>
          <Button onClick={handleLogin} className="payroll-button-primary">
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto text-center max-w-4xl">
          <h2 className="text-4xl font-bold mb-6">
            Streamline Your Payroll Process
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Digitize handwritten timecards, track employee hours, and generate professional 
            payroll reports with our comprehensive payroll management system.
          </p>
          <Button onClick={handleLogin} size="lg" className="payroll-button-primary">
            Get Started Today
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-6 bg-muted/30">
        <div className="container mx-auto">
          <h3 className="text-3xl font-bold text-center mb-12">
            Everything You Need for Payroll Management
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="payroll-card text-center">
              <CardHeader>
                <Users className="w-12 h-12 mx-auto text-primary mb-4" />
                <CardTitle>Employee Management</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Manage your employee roster with comprehensive profiles, 
                  departments, and compensation tracking.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="payroll-card text-center">
              <CardHeader>
                <Clock className="w-12 h-12 mx-auto text-primary mb-4" />
                <CardTitle>Time Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Digital timecard entry with automatic overtime calculations, 
                  mileage tracking, and bi-weekly pay periods.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="payroll-card text-center">
              <CardHeader>
                <FileText className="w-12 h-12 mx-auto text-primary mb-4" />
                <CardTitle>Professional Reports</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Generate PDF and Excel reports for payroll processing 
                  with detailed breakdowns and summaries.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="payroll-card text-center">
              <CardHeader>
                <BarChart3 className="w-12 h-12 mx-auto text-primary mb-4" />
                <CardTitle>Analytics Dashboard</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Real-time insights into payroll status, pending timecards, 
                  and employee performance metrics.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-6">
        <div className="container mx-auto text-center">
          <Card className="payroll-card max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl">Ready to Get Started?</CardTitle>
              <CardDescription>
                Join thousands of businesses using PayTracker Pro to streamline their payroll operations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleLogin} size="lg" className="payroll-button-primary">
                Sign In with Replit
              </Button>
              <p className="text-sm text-muted-foreground mt-4">
                Secure authentication powered by Replit
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-8 px-6">
        <div className="container mx-auto text-center">
          <p className="text-muted-foreground">
            © 2023 PayTracker Pro. Professional payroll management made simple.
          </p>
        </div>
      </footer>
    </div>
  );
}
