import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, FileText, Eye, Lock, Users, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary-hover to-primary/80 text-primary-foreground py-20 md:py-32">
        <div className="container relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              Fighting Corruption Through Transparency
            </h1>
            <p className="text-lg md:text-xl text-primary-foreground/90">
              Report corruption safely, ensure accountability, and build a transparent society. Your voice matters.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link to="/submit">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  Report an Issue
                </Button>
              </Link>
              <Link to="/submit?anonymous=true">
                <Button size="lg" variant="outline" className="w-full sm:w-auto bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary">
                  Report Anonymously
                </Button>
              </Link>
              <Link to="/verify">
                <Button size="lg" variant="outline" className="w-full sm:w-auto bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary">
                  Verify Complaint
                </Button>
              </Link>
            </div>
            <div className="mt-8 pt-8 border-t border-primary-foreground/20">
              <p className="text-sm mb-3 text-primary-foreground/80">Government Officials</p>
              <Link to="/gov">
                <Button size="lg" variant="outline" className="bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary">
                  Access Government Portal
                </Button>
              </Link>
            </div>
          </div>
        </div>
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:50px_50px]" />
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How Corrupt Watch Works</h2>
            <p className="text-lg text-muted-foreground">
              A secure, transparent platform for reporting and tracking corruption cases
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <Shield className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Secure Reporting</CardTitle>
                <CardDescription>
                  Submit complaints with complete privacy and security. Your identity is protected.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <FileText className="h-10 w-10 text-secondary mb-2" />
                <CardTitle>Evidence-Backed</CardTitle>
                <CardDescription>
                  Upload photos, videos, and documents. All evidence is cryptographically hashed for authenticity.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Eye className="h-10 w-10 text-accent mb-2" />
                <CardTitle>Full Transparency</CardTitle>
                <CardDescription>
                  Track your complaint status in real-time. Every action is logged and verifiable.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Lock className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Tamper-Proof</CardTitle>
                <CardDescription>
                  Blockchain-like audit trail ensures no complaint can be altered or deleted without trace.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Users className="h-10 w-10 text-secondary mb-2" />
                <CardTitle>Direct Government Access</CardTitle>
                <CardDescription>
                  Complaints are automatically routed to relevant authorities for prompt action.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <TrendingUp className="h-10 w-10 text-accent mb-2" />
                <CardTitle>Analytics & Insights</CardTitle>
                <CardDescription>
                  Track corruption trends, hotspots, and resolution rates across regions.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container">
          <Card className="bg-gradient-to-r from-primary to-primary-hover text-primary-foreground">
            <CardContent className="p-12">
              <div className="max-w-2xl mx-auto text-center space-y-6">
                <h2 className="text-3xl md:text-4xl font-bold">
                  Ready to Make a Difference?
                </h2>
                <p className="text-lg text-primary-foreground/90">
                  Join thousands of citizens fighting corruption and ensuring accountability in government.
                </p>
                <Link to="/auth">
                  <Button size="lg" variant="secondary">
                    Get Started Now
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <span className="font-semibold">Corrupt Watch</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 Corrupt Watch. Ensuring transparency and accountability.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
