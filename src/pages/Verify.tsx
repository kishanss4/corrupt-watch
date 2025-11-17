import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/Navbar";
import { Search, Shield, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface ComplaintData {
  id: string;
  title: string;
  category: string;
  status: string;
  created_at: string;
  location: string;
  complaint_hash: string;
}

export default function Verify() {
  const [searchParams] = useSearchParams();
  const [complaintId, setComplaintId] = useState(searchParams.get("id") || "");
  const [complaint, setComplaint] = useState<ComplaintData | null>(null);
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (!complaintId.trim()) {
      toast.error("Please enter a complaint ID or tracking code");
      return;
    }

    setLoading(true);
    try {
      // Try to find by ID first, then by tracking code
      let query = supabase
        .from("complaints")
        .select("id, title, category, status, created_at, location, complaint_hash");

      // Check if it's a tracking code format (CW-XXXX-XXXX)
      const isTrackingCode = /^CW-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(complaintId.trim());
      
      if (isTrackingCode) {
        query = query.eq("tracking_code", complaintId.trim().toUpperCase());
      } else {
        query = query.eq("id", complaintId.trim());
      }

      const { data, error } = await query.maybeSingle();

      if (error || !data) {
        toast.error("Complaint not found. Please check your ID or tracking code.");
        setComplaint(null);
      } else {
        setComplaint(data);
        toast.success("Complaint verified successfully");
      }
    } catch (error) {
      toast.error("Failed to verify complaint");
      setComplaint(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-2">Verify Complaint</h1>
            <p className="text-muted-foreground">
              Enter a complaint ID or tracking code to verify its authenticity and check its status
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Complaint Lookup</CardTitle>
              <CardDescription>
                All complaints are cryptographically secured and publicly verifiable
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="complaint-id">Complaint ID or Tracking Code</Label>
                <div className="flex gap-2">
                  <Input
                    id="complaint-id"
                    placeholder="Enter ID or tracking code (e.g., CW-A7B9-K2M4)..."
                    value={complaintId}
                    onChange={(e) => setComplaintId(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                  />
                  <Button onClick={handleVerify} disabled={loading}>
                    <Search className="h-4 w-4 mr-2" />
                    {loading ? "Verifying..." : "Verify"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use your tracking code (CW-XXXX-XXXX) for anonymous complaints
                </p>
              </div>

              {complaint && (
                <div className="mt-6 p-6 border rounded-lg bg-muted/50 space-y-4">
                  <div className="flex items-center gap-2 text-secondary">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-semibold">Complaint Verified</span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Title</Label>
                      <p className="font-medium">{complaint.title}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Category</Label>
                        <p className="font-medium capitalize">{complaint.category.replace(/_/g, " ")}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Status</Label>
                        <Badge className="mt-1">{complaint.status}</Badge>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground">Location</Label>
                      <p className="font-medium">{complaint.location}</p>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground">Submitted On</Label>
                      <p className="font-medium">{format(new Date(complaint.created_at), "PPP")}</p>
                    </div>

                    {complaint.complaint_hash && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Verification Hash</Label>
                        <p className="text-xs font-mono bg-background p-2 rounded mt-1 break-all">
                          {complaint.complaint_hash}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
