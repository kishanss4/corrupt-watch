import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { BarChart3, FileText, CheckCircle2, AlertTriangle, Loader2, Eye, MapPin, Calendar, FileIcon, MessageSquare, Sparkles, Brain, TrendingUp as TrendingUpIcon, Download } from "lucide-react";
import { format } from "date-fns";

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
  is_anonymous: boolean;
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
  official_id: string | null;
}

const statusConfig = {
  pending: { color: "bg-status-pending", label: "Pending" },
  in_review: { color: "bg-status-in-review", label: "In Review" },
  verified: { color: "bg-status-verified", label: "Verified" },
  resolved: { color: "bg-status-resolved", label: "Resolved" },
  rejected: { color: "bg-status-rejected", label: "Rejected" },
};

const categoryLabels: Record<string, string> = {
  bribery: "Bribery",
  misconduct: "Misconduct",
  misuse_of_funds: "Misuse of Funds",
  negligence: "Negligence",
  infrastructure: "Infrastructure",
  other: "Other",
};

export default function GovPortal() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    in_review: 0,
    resolved: 0,
  });
  const [loading, setLoading] = useState(true);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [filteredComplaints, setFilteredComplaints] = useState<Complaint[]>([]);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFile[]>([]);
  const [govNotes, setGovNotes] = useState<GovNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [newStatus, setNewStatus] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [userId, setUserId] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [draftNote, setDraftNote] = useState("");

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const checkAccess = async () => {
      // Get session but don't require it - allow public access
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setUserId(session.user.id);
      }

      await fetchComplaints();

      // Set up realtime subscription for all complaints
      channel = supabase
        .channel('gov-complaints-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'complaints'
          },
          (payload) => {
            console.log('Realtime update received:', payload);
            
            if (payload.eventType === 'INSERT') {
              setComplaints(prev => [payload.new as Complaint, ...prev]);
              setStats(prev => ({
                ...prev,
                total: prev.total + 1,
                pending: (payload.new as Complaint).status === 'pending' ? prev.pending + 1 : prev.pending,
                in_review: (payload.new as Complaint).status === 'in_review' ? prev.in_review + 1 : prev.in_review,
                resolved: (payload.new as Complaint).status === 'resolved' ? prev.resolved + 1 : prev.resolved,
              }));
              toast.info("New complaint received");
            } else if (payload.eventType === 'UPDATE') {
              const oldComplaint = complaints.find(c => c.id === payload.old.id);
              const newComplaint = payload.new as Complaint;
              
              setComplaints(prev => 
                prev.map(c => c.id === newComplaint.id ? newComplaint : c)
              );

              // Update stats if status changed
              if (oldComplaint && oldComplaint.status !== newComplaint.status) {
                setStats(prev => {
                  const newStats = { ...prev };
                  // Decrease old status count
                  if (oldComplaint.status === 'pending') newStats.pending--;
                  if (oldComplaint.status === 'in_review') newStats.in_review--;
                  if (oldComplaint.status === 'resolved') newStats.resolved--;
                  // Increase new status count
                  if (newComplaint.status === 'pending') newStats.pending++;
                  if (newComplaint.status === 'in_review') newStats.in_review++;
                  if (newComplaint.status === 'resolved') newStats.resolved++;
                  return newStats;
                });
              }

              // Update selected complaint if it's open
              if (selectedComplaint && selectedComplaint.id === newComplaint.id) {
                setSelectedComplaint(newComplaint);
              }
            } else if (payload.eventType === 'DELETE') {
              const deletedComplaint = payload.old as Complaint;
              setComplaints(prev => prev.filter(c => c.id !== deletedComplaint.id));
              setStats(prev => ({
                total: prev.total - 1,
                pending: deletedComplaint.status === 'pending' ? prev.pending - 1 : prev.pending,
                in_review: deletedComplaint.status === 'in_review' ? prev.in_review - 1 : prev.in_review,
                resolved: deletedComplaint.status === 'resolved' ? prev.resolved - 1 : prev.resolved,
              }));
              if (selectedComplaint && selectedComplaint.id === deletedComplaint.id) {
                setSelectedComplaint(null);
              }
            }
          }
        )
        .subscribe();
    };

    checkAccess();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [navigate, complaints, selectedComplaint]);

  const fetchComplaints = async () => {
    const { data: complaintsData } = await supabase
      .from("complaints")
      .select("*")
      .order("created_at", { ascending: false });

    if (complaintsData) {
      setComplaints(complaintsData);
      setFilteredComplaints(complaintsData);
      
      setStats({
        total: complaintsData.length,
        pending: complaintsData.filter(c => c.status === "pending").length,
        in_review: complaintsData.filter(c => c.status === "in_review").length,
        resolved: complaintsData.filter(c => c.status === "resolved").length,
      });
    }

    setLoading(false);
  };

  useEffect(() => {
    let filtered = complaints;

    if (searchQuery) {
      filtered = filtered.filter(c => 
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.tracking_code?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filterStatus !== "all") {
      filtered = filtered.filter(c => c.status === filterStatus);
    }

    if (filterCategory !== "all") {
      filtered = filtered.filter(c => c.category === filterCategory);
    }

    setFilteredComplaints(filtered);
  }, [searchQuery, filterStatus, filterCategory, complaints]);

  const fetchComplaintDetails = async (complaintId: string) => {
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
      .order("created_at", { ascending: false});
    
    setGovNotes(notes || []);
  };

  const handleViewDetails = (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    setNewStatus(complaint.status);
    setAiAnalysis(null);
    setDraftNote("");
    fetchComplaintDetails(complaint.id);
  };

  const handleAnalyzeWithAI = async () => {
    if (!selectedComplaint) return;
    
    setLoadingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-complaint', {
        body: {
          title: selectedComplaint.title,
          description: selectedComplaint.description,
          category: selectedComplaint.category,
          location: selectedComplaint.location,
        }
      });

      if (error) throw error;

      if (data.error) {
        if (data.error.includes('Rate limit')) {
          toast.error('AI rate limit reached. Please try again later.');
        } else if (data.error.includes('Payment')) {
          toast.error('AI credits depleted. Please add credits to continue.');
        } else {
          toast.error(data.error);
        }
        return;
      }

      setAiAnalysis(data.analysis);
      toast.success('AI analysis completed');
    } catch (error) {
      console.error('AI analysis error:', error);
      toast.error('Failed to analyze complaint');
    } finally {
      setLoadingAI(false);
    }
  };

  const handleGenerateDraftNote = async () => {
    if (!selectedComplaint) return;
    
    setLoadingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-response', {
        body: {
          complaint: {
            title: selectedComplaint.title,
            description: selectedComplaint.description,
            category: selectedComplaint.category,
            status: selectedComplaint.status,
          },
          action: 'draft_note'
        }
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setDraftNote(data.text);
      setNewNote(data.text);
      toast.success('Draft note generated');
    } catch (error) {
      console.error('Draft generation error:', error);
      toast.error('Failed to generate draft note');
    } finally {
      setLoadingAI(false);
    }
  };

  const handleSuggestStatus = async () => {
    if (!selectedComplaint) return;
    
    setLoadingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-response', {
        body: {
          complaint: {
            title: selectedComplaint.title,
            description: selectedComplaint.description,
            category: selectedComplaint.category,
            status: selectedComplaint.status,
          },
          action: 'suggest_status'
        }
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setNewStatus(data.suggested_status);
      toast.success(`Suggested: ${data.reason}`);
    } catch (error) {
      console.error('Status suggestion error:', error);
      toast.error('Failed to suggest status');
    } finally {
      setLoadingAI(false);
    }
  };

  const exportToCSV = () => {
    try {
      const headers = ["ID", "Title", "Category", "Status", "Location", "Latitude", "Longitude", "Urgency Score", "Created At", "Tracking Code", "Is Anonymous"];
      
      const rows = filteredComplaints.map(complaint => [
        complaint.id,
        `"${complaint.title.replace(/"/g, '""')}"`,
        complaint.category,
        complaint.status,
        `"${complaint.location?.replace(/"/g, '""') || ''}"`,
        complaint.latitude || '',
        complaint.longitude || '',
        complaint.urgency_score || '',
        format(new Date(complaint.created_at), "yyyy-MM-dd HH:mm:ss"),
        complaint.tracking_code || '',
        complaint.is_anonymous ? 'Yes' : 'No'
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      
      link.setAttribute("href", url);
      link.setAttribute("download", `complaints_gov_export_${format(new Date(), "yyyy-MM-dd")}.csv`);
      link.style.visibility = "hidden";
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("Complaints data exported successfully!");
    } catch (error) {
      console.error("Error exporting data:", error);
      toast.error("Failed to export data");
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedComplaint || !newStatus) return;

    const { error } = await supabase
      .from("complaints")
      .update({ status: newStatus as "pending" | "in_review" | "verified" | "resolved" | "rejected" })
      .eq("id", selectedComplaint.id);

    if (error) {
      toast.error("Failed to update status");
      return;
    }

    toast.success("Status updated successfully");
    await fetchComplaints();
    setSelectedComplaint({ ...selectedComplaint, status: newStatus });
  };

  const handleAddNote = async () => {
    if (!selectedComplaint || !newNote.trim() || !userId) return;

    const { error } = await supabase
      .from("gov_notes")
      .insert({
        complaint_id: selectedComplaint.id,
        official_id: userId,
        note: newNote.trim(),
      });

    if (error) {
      toast.error("Failed to add note");
      return;
    }

    toast.success("Note added successfully");
    setNewNote("");
    await fetchComplaintDetails(selectedComplaint.id);
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
          <h1 className="text-3xl font-bold mb-2">Government Portal</h1>
          <p className="text-muted-foreground">Monitor and manage corruption complaints</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Complaints</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
              <AlertTriangle className="h-4 w-4 text-status-pending" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Review</CardTitle>
              <BarChart3 className="h-4 w-4 text-status-in-review" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.in_review}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resolved</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-status-resolved" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.resolved}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4 mb-4">
              <Button onClick={exportToCSV} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <Input
                placeholder="Search complaints..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_review">In Review</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="bribery">Bribery</SelectItem>
                  <SelectItem value="misconduct">Misconduct</SelectItem>
                  <SelectItem value="misuse_of_funds">Misuse of Funds</SelectItem>
                  <SelectItem value="negligence">Negligence</SelectItem>
                  <SelectItem value="infrastructure">Infrastructure</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {filteredComplaints.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg text-muted-foreground">No complaints found</p>
              </CardContent>
            </Card>
          ) : (
            filteredComplaints.map((complaint) => (
              <Card key={complaint.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-xl">{complaint.title}</CardTitle>
                        {complaint.is_anonymous && (
                          <Badge variant="outline" className="text-xs">Anonymous</Badge>
                        )}
                      </div>
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
                        {complaint.tracking_code && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-xs">{complaint.tracking_code}</span>
                          </>
                        )}
                      </CardDescription>
                    </div>
                    <Badge className={`${statusConfig[complaint.status as keyof typeof statusConfig]?.color || "bg-muted"} text-white`}>
                      {statusConfig[complaint.status as keyof typeof statusConfig]?.label || complaint.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">
                      {categoryLabels[complaint.category] || complaint.category}
                    </Badge>
                    <Button variant="default" size="sm" onClick={() => handleViewDetails(complaint)}>
                      <Eye className="h-4 w-4 mr-2" />
                      Review
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      <Dialog open={!!selectedComplaint} onOpenChange={(open) => !open && setSelectedComplaint(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedComplaint?.title}</DialogTitle>
            <DialogDescription>
              Submitted on {selectedComplaint && format(new Date(selectedComplaint.created_at), "MMMM d, yyyy 'at' h:mm a")}
              {selectedComplaint?.is_anonymous && " • Anonymous Report"}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="details" className="mt-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="evidence">Evidence ({evidenceFiles.length})</TabsTrigger>
              <TabsTrigger value="notes">Notes ({govNotes.length})</TabsTrigger>
              <TabsTrigger value="ai">
                <Sparkles className="h-3 w-3 mr-1" />
                AI Analysis
              </TabsTrigger>
              <TabsTrigger value="actions">Actions</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
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
                <div>
                  <h3 className="font-semibold mb-1">Urgency Score</h3>
                  <p className="text-sm text-muted-foreground">{selectedComplaint?.urgency_score || "N/A"}</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="evidence" className="space-y-4">
              {evidenceFiles.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No evidence files uploaded</p>
              ) : (
                <div className="grid gap-2">
                  {evidenceFiles.map((file) => (
                    <Card key={file.id}>
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <FileIcon className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">{file.file_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  Uploaded {format(new Date(file.created_at), "MMM d, yyyy")}
                                </p>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {file.file_type}
                            </Badge>
                          </div>
                          {file.file_type.startsWith("image/") && (
                            <div className="mt-2">
                              <img 
                                src={file.file_url} 
                                alt={file.file_name}
                                className="max-w-full h-auto rounded border"
                              />
                            </div>
                          )}
                          {file.file_type.startsWith("video/") && (
                            <div className="mt-2">
                              <video 
                                src={file.file_url} 
                                controls
                                className="max-w-full h-auto rounded border"
                              >
                                Your browser does not support the video tag.
                              </video>
                            </div>
                          )}
                          {file.file_type.startsWith("audio/") && (
                            <div className="mt-2">
                              <audio 
                                src={file.file_url} 
                                controls
                                className="w-full"
                              >
                                Your browser does not support the audio tag.
                              </audio>
                            </div>
                          )}
                          <Button variant="outline" size="sm" asChild className="w-full">
                            <a href={file.file_url} target="_blank" rel="noopener noreferrer">
                              View File
                            </a>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="notes" className="space-y-4">
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
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Add New Note</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2 mb-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleGenerateDraftNote}
                      disabled={loadingAI}
                    >
                      {loadingAI ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      AI Draft Note
                    </Button>
                  </div>
                  <Textarea
                    placeholder="Enter your note here..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={4}
                  />
                  <Button onClick={handleAddNote} disabled={!newNote.trim()}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Add Note
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ai" className="space-y-4">
              {!aiAnalysis ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Brain className="h-12 w-12 text-primary mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">AI-Powered Analysis</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      Get instant insights, urgency scoring, and recommended actions
                    </p>
                    <Button onClick={handleAnalyzeWithAI} disabled={loadingAI} size="lg">
                      {loadingAI ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-5 w-5 mr-2" />
                          Analyze with AI
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <TrendingUpIcon className="h-5 w-5 text-primary" />
                        AI Analysis Results
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-semibold mb-1">Urgency Score</h4>
                          <div className="flex items-center gap-2">
                            <div className="text-2xl font-bold text-primary">{aiAnalysis.urgency_score}</div>
                            <span className="text-xs text-muted-foreground">/ 10</span>
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold mb-1">Risk Level</h4>
                          <Badge 
                            className={
                              aiAnalysis.risk_level === 'critical' ? 'bg-destructive' :
                              aiAnalysis.risk_level === 'high' ? 'bg-accent' :
                              aiAnalysis.risk_level === 'medium' ? 'bg-status-in-review' :
                              'bg-status-pending'
                            }
                          >
                            {aiAnalysis.risk_level}
                          </Badge>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold mb-1">Sentiment</h4>
                          <Badge variant="outline">{aiAnalysis.sentiment}</Badge>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold mb-2">Summary</h4>
                        <p className="text-sm text-muted-foreground">{aiAnalysis.summary}</p>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold mb-2">Key Issues</h4>
                        <ul className="list-disc list-inside space-y-1">
                          {aiAnalysis.key_issues?.map((issue: string, i: number) => (
                            <li key={i} className="text-sm text-muted-foreground">{issue}</li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold mb-2">Recommended Actions</h4>
                        <ul className="list-disc list-inside space-y-1">
                          {aiAnalysis.recommended_actions?.map((action: string, i: number) => (
                            <li key={i} className="text-sm text-muted-foreground">{action}</li>
                          ))}
                        </ul>
                      </div>

                      {aiAnalysis.patterns && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Patterns Detected</h4>
                          <p className="text-sm text-muted-foreground">{aiAnalysis.patterns}</p>
                        </div>
                      )}

                      <Button 
                        variant="outline" 
                        onClick={handleAnalyzeWithAI} 
                        disabled={loadingAI}
                        className="w-full"
                      >
                        {loadingAI ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Re-analyzing...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Re-analyze
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="actions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Update Status</CardTitle>
                  <CardDescription>Change the complaint status</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2 mb-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleSuggestStatus}
                      disabled={loadingAI}
                    >
                      {loadingAI ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      AI Suggest Status
                    </Button>
                  </div>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_review">In Review</SelectItem>
                      <SelectItem value="verified">Verified</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleUpdateStatus} className="w-full">
                    Update Status
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
