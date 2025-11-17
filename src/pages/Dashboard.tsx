import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Clock, CheckCircle2, XCircle, AlertCircle, Eye, MapPin, FileIcon, Calendar, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Complaint {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  created_at: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  tracking_code: string | null;
  urgency_score: number | null;
}

interface EvidenceFile {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  created_at: string;
}

interface GovNote {
  id: string;
  note: string;
  created_at: string;
}

const statusConfig = {
  pending: { icon: Clock, color: "bg-status-pending", label: "Pending" },
  in_review: { icon: AlertCircle, color: "bg-status-in-review", label: "In Review" },
  verified: { icon: CheckCircle2, color: "bg-status-verified", label: "Verified" },
  resolved: { icon: CheckCircle2, color: "bg-status-resolved", label: "Resolved" },
  rejected: { icon: XCircle, color: "bg-status-rejected", label: "Rejected" },
};

const categoryLabels: Record<string, string> = {
  bribery: "Bribery",
  misconduct: "Misconduct",
  misuse_of_funds: "Misuse of Funds",
  negligence: "Negligence",
  infrastructure: "Infrastructure",
  other: "Other",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFile[]>([]);
  const [govNotes, setGovNotes] = useState<GovNote[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const fetchComplaints = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("complaints")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching complaints:", error);
      } else {
        setComplaints(data || []);
      }
      setLoading(false);

      // Set up realtime subscription
      channel = supabase
        .channel('complaints-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'complaints',
            filter: `user_id=eq.${session.user.id}`
          },
          (payload) => {
            console.log('Realtime update received:', payload);
            
            if (payload.eventType === 'INSERT') {
              setComplaints(prev => [payload.new as Complaint, ...prev]);
            } else if (payload.eventType === 'UPDATE') {
              setComplaints(prev => 
                prev.map(c => c.id === payload.new.id ? payload.new as Complaint : c)
              );
              // Update selected complaint if it's open
              if (selectedComplaint && selectedComplaint.id === payload.new.id) {
                setSelectedComplaint(payload.new as Complaint);
                toast.info("Complaint updated");
              }
            } else if (payload.eventType === 'DELETE') {
              setComplaints(prev => prev.filter(c => c.id !== payload.old.id));
              if (selectedComplaint && selectedComplaint.id === payload.old.id) {
                setSelectedComplaint(null);
              }
            }
          }
        )
        .subscribe();
    };

    fetchComplaints();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [navigate, selectedComplaint]);

  const fetchComplaintDetails = async (complaintId: string) => {
    setLoadingDetails(true);
    
    const { data: files } = await supabase
      .from("evidence_files")
      .select("*")
      .eq("complaint_id", complaintId)
      .order("created_at", { ascending: false });
    
    setEvidenceFiles(files || []);

    const { data: notes } = await supabase
      .from("gov_notes")
      .select("*")
      .eq("complaint_id", complaintId)
      .order("created_at", { ascending: false });
    
    setGovNotes(notes || []);
    setLoadingDetails(false);
  };

  const handleViewDetails = (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    fetchComplaintDetails(complaint.id);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">My Complaints</h1>
          <p className="text-muted-foreground">Track the status of your submitted complaints</p>
        </div>

        {complaints.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg text-muted-foreground mb-4">No complaints submitted yet</p>
              <Button onClick={() => navigate("/submit")}>Submit Your First Complaint</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {complaints.map((complaint) => {
              const StatusIcon = statusConfig[complaint.status as keyof typeof statusConfig]?.icon || Clock;
              const statusColor = statusConfig[complaint.status as keyof typeof statusConfig]?.color || "bg-muted";
              const statusLabel = statusConfig[complaint.status as keyof typeof statusConfig]?.label || complaint.status;

              return (
                <Card key={complaint.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <CardTitle className="text-xl">{complaint.title}</CardTitle>
                        <CardDescription className="flex items-center gap-4 flex-wrap">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {complaint.location}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(complaint.created_at), "MMM d, yyyy")}
                          </span>
                        </CardDescription>
                        <div className="flex flex-col gap-1 mt-2">
                          <span className="text-xs text-muted-foreground font-mono">
                            ID: {complaint.id.substring(0, 8)}...
                          </span>
                          {complaint.tracking_code && (
                            <span className="text-xs text-muted-foreground font-mono">
                              Track: {complaint.tracking_code}
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge className={`${statusColor} text-white flex items-center gap-1`}>
                        <StatusIcon className="h-3 w-3" />
                        {statusLabel}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {categoryLabels[complaint.category] || complaint.category}
                      </Badge>
                      <Button variant="ghost" size="sm" onClick={() => handleViewDetails(complaint)}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!selectedComplaint} onOpenChange={(open) => !open && setSelectedComplaint(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedComplaint?.title}</DialogTitle>
            <DialogDescription>
              Submitted on {selectedComplaint && format(new Date(selectedComplaint.created_at), "MMMM d, yyyy 'at' h:mm a")}
            </DialogDescription>
          </DialogHeader>

          {loadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Tabs defaultValue="details" className="mt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="evidence">Evidence ({evidenceFiles.length})</TabsTrigger>
                <TabsTrigger value="notes">Notes ({govNotes.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Complaint ID</h3>
                  <p className="text-xs font-mono bg-muted p-2 rounded break-all">
                    {selectedComplaint?.id}
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedComplaint?.description}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold mb-1">Category</h3>
                    <Badge variant="outline">
                      {categoryLabels[selectedComplaint?.category || ""] || selectedComplaint?.category}
                    </Badge>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Status</h3>
                    <Badge className={statusConfig[selectedComplaint?.status as keyof typeof statusConfig]?.color || "bg-muted"}>
                      {statusConfig[selectedComplaint?.status as keyof typeof statusConfig]?.label || selectedComplaint?.status}
                    </Badge>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Location</h3>
                    <p className="text-sm text-muted-foreground">{selectedComplaint?.location}</p>
                  </div>
                  {selectedComplaint?.tracking_code && (
                    <div>
                      <h3 className="font-semibold mb-1">Tracking Code</h3>
                      <p className="text-sm font-mono">{selectedComplaint.tracking_code}</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="evidence" className="space-y-4">
                {evidenceFiles.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No evidence files uploaded</p>
                ) : (
                  <div className="grid gap-2">
                    {evidenceFiles.map((file) => (
                      <Card key={file.id}>
                        <CardContent className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-3">
                            <FileIcon className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{file.file_name}</p>
                              <p className="text-xs text-muted-foreground">
                                Uploaded {format(new Date(file.created_at), "MMM d, yyyy")}
                              </p>
                            </div>
                          </div>
                          <Button variant="outline" size="sm" asChild>
                            <a href={file.file_url} target="_blank" rel="noopener noreferrer">
                              View
                            </a>
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="notes" className="space-y-4">
                {govNotes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No government notes yet. Updates will appear here when officials review your complaint.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {govNotes.map((note) => (
                      <Card key={note.id}>
                        <CardContent className="p-4">
                          <p className="text-sm mb-2">{note.note}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(note.created_at), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
