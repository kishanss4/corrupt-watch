import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { ComplaintHeatmap } from "@/components/ComplaintHeatmap";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from "recharts";
import { AlertCircle, TrendingUp, MapPin, FileText, Eye, CheckCircle2, Clock, XCircle, Download } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

interface Complaint {
  id: string;
  title: string;
  category: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  urgency_score: number | null;
  description?: string;
  location?: string;
  tracking_code?: string | null;
}

interface EvidenceFile {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
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

export default function Analytics() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFile[]>([]);
  const [loadingEvidence, setLoadingEvidence] = useState(false);

  useEffect(() => {
    fetchComplaints();

    // Set up realtime subscription
    const channel = supabase
      .channel('analytics-complaints-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'complaints'
        },
        (payload) => {
          console.log('Realtime update received in analytics:', payload);
          
          if (payload.eventType === 'INSERT') {
            setComplaints(prev => [payload.new as Complaint, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setComplaints(prev => 
              prev.map(c => c.id === payload.new.id ? payload.new as Complaint : c)
            );
          } else if (payload.eventType === 'DELETE') {
            setComplaints(prev => prev.filter(c => c.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchComplaints = async () => {
    try {
      const { data, error } = await supabase
        .from("complaints")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setComplaints(data || []);
    } catch (error) {
      console.error("Error fetching complaints:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewComplaint = async (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    setLoadingEvidence(true);
    
    try {
      const { data: evidence } = await supabase
        .from("evidence_files")
        .select("*")
        .eq("complaint_id", complaint.id)
        .order("created_at", { ascending: false });
      
      setEvidenceFiles(evidence || []);
    } catch (error) {
      console.error("Error fetching evidence:", error);
    } finally {
      setLoadingEvidence(false);
    }
  };

  const exportToCSV = () => {
    try {
      // Create CSV header
      const headers = ["ID", "Title", "Category", "Status", "Location", "Latitude", "Longitude", "Urgency Score", "Created At", "Tracking Code"];
      
      // Create CSV rows
      const rows = complaints.map(complaint => [
        complaint.id,
        `"${complaint.title.replace(/"/g, '""')}"`, // Escape quotes
        complaint.category,
        complaint.status,
        `"${complaint.location?.replace(/"/g, '""') || ''}"`,
        complaint.latitude || '',
        complaint.longitude || '',
        complaint.urgency_score || '',
        format(new Date(complaint.created_at), "yyyy-MM-dd HH:mm:ss"),
        complaint.tracking_code || ''
      ]);

      // Combine headers and rows
      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.join(","))
      ].join("\n");

      // Create download link
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      
      link.setAttribute("href", url);
      link.setAttribute("download", `complaints_export_${format(new Date(), "yyyy-MM-dd")}.csv`);
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

  // Analytics calculations
  const categoryData = complaints.reduce((acc, complaint) => {
    const category = complaint.category.replace('_', ' ');
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusData = complaints.reduce((acc, complaint) => {
    acc[complaint.status] = (acc[complaint.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chartCategoryData = Object.entries(categoryData).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    count: value,
  }));

  const chartStatusData = Object.entries(statusData).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1).replace('_', ' '),
    value,
  }));

  // Timeline data (complaints per month)
  const timelineData = complaints.reduce((acc, complaint) => {
    const month = new Date(complaint.created_at).toLocaleString('default', { month: 'short', year: 'numeric' });
    acc[month] = (acc[month] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chartTimelineData = Object.entries(timelineData)
    .map(([month, count]) => ({ month, count }))
    .slice(-6);

  const COLORS = ['hsl(217 91% 35%)', 'hsl(158 64% 52%)', 'hsl(38 92% 50%)', 'hsl(0 84% 60%)', 'hsl(262 83% 58%)', 'hsl(142 76% 36%)'];

  // AI-like classification summary
  const categoryInsights: Record<string, string> = {
    bribery: "Corruption-related incidents requiring immediate investigation",
    misconduct: "Behavioral issues and professional ethics violations",
    misuse_of_funds: "Financial irregularities and budget concerns",
    negligence: "Service delivery failures and administrative lapses",
    infrastructure: "Public infrastructure maintenance and development issues",
    other: "General civic concerns and miscellaneous reports",
  };

  const complaintsWithLocation = complaints.filter(c => c.latitude && c.longitude);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Public Analytics Dashboard</h1>
          <p className="text-muted-foreground">Real-time visualization of civic complaints and trends</p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Complaints</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{complaints.length}</div>
              <p className="text-xs text-muted-foreground">Across all categories</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">With Location</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{complaintsWithLocation.length}</div>
              <p className="text-xs text-muted-foreground">Geo-tagged reports</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statusData.pending || 0}</div>
              <p className="text-xs text-muted-foreground">Awaiting action</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resolved</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statusData.resolved || 0}</div>
              <p className="text-xs text-muted-foreground">Successfully closed</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="complaints">Complaints</TabsTrigger>
            <TabsTrigger value="map">Geographic View</TabsTrigger>
            <TabsTrigger value="insights">AI Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Complaints by Category</CardTitle>
                  <CardDescription>Distribution across different issue types</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartCategoryData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Status Distribution</CardTitle>
                  <CardDescription>Current state of all complaints</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={chartStatusData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {chartStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Complaint Trends</CardTitle>
                <CardDescription>Monthly submission patterns (last 6 months)</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartTimelineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="complaints" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>All Complaints</CardTitle>
                  <CardDescription>View detailed information about all submitted complaints</CardDescription>
                </div>
                <Button onClick={exportToCSV} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {complaints.map((complaint) => {
                        const StatusIcon = statusConfig[complaint.status as keyof typeof statusConfig]?.icon || Clock;
                        const statusColor = statusConfig[complaint.status as keyof typeof statusConfig]?.color || "bg-muted";
                        const statusLabel = statusConfig[complaint.status as keyof typeof statusConfig]?.label || complaint.status;

                        return (
                          <TableRow key={complaint.id}>
                            <TableCell className="font-mono text-xs">
                              {complaint.id.substring(0, 8)}...
                            </TableCell>
                            <TableCell className="font-medium">{complaint.title}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {categoryLabels[complaint.category] || complaint.category}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={`${statusColor} text-white flex items-center gap-1 w-fit`}>
                                <StatusIcon className="h-3 w-3" />
                                {statusLabel}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{complaint.location}</TableCell>
                            <TableCell className="text-sm">
                              {format(new Date(complaint.created_at), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleViewComplaint(complaint)}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="map" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Geographic Distribution</CardTitle>
                <CardDescription>Location-based complaint heatmap</CardDescription>
              </CardHeader>
              <CardContent>
                {complaintsWithLocation.length > 0 ? (
                  <ComplaintHeatmap 
                    complaints={complaintsWithLocation.map(c => ({
                      id: c.id,
                      latitude: c.latitude!,
                      longitude: c.longitude!,
                      title: c.title,
                      category: c.category,
                      status: c.status,
                    }))} 
                  />
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No location data available. Complaints need geographic coordinates to appear on the map.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="insights" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>AI-Powered Classification Overview</CardTitle>
                <CardDescription>Automated analysis and categorization of complaints</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(categoryData).map(([category, count]) => (
                  <div key={category} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold capitalize">{category.replace('_', ' ')}</h3>
                      <span className="text-sm text-muted-foreground">{count} reports</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{categoryInsights[category]}</p>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary"
                        style={{ width: `${(count / complaints.length) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}

                <Alert className="mt-6">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Classification Method:</strong> Rule-based automatic categorization using keyword analysis 
                    and pattern recognition. This open-source system helps identify and prioritize complaints based on 
                    their content and urgency indicators.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!selectedComplaint} onOpenChange={(open) => !open && setSelectedComplaint(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedComplaint?.title}</DialogTitle>
            <DialogDescription>
              Submitted on {selectedComplaint && format(new Date(selectedComplaint.created_at), "MMMM d, yyyy 'at' h:mm a")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            <div>
              <h3 className="font-semibold mb-2">Complaint ID</h3>
              <p className="text-xs font-mono bg-muted p-2 rounded break-all">
                {selectedComplaint?.id}
              </p>
            </div>

            {selectedComplaint?.tracking_code && (
              <div>
                <h3 className="font-semibold mb-2">Tracking Code</h3>
                <p className="text-sm font-mono bg-muted p-2 rounded">
                  {selectedComplaint.tracking_code}
                </p>
              </div>
            )}

            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {selectedComplaint?.description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-2">Category</h3>
                <Badge variant="outline">
                  {categoryLabels[selectedComplaint?.category || ""] || selectedComplaint?.category}
                </Badge>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Status</h3>
                <Badge className={statusConfig[selectedComplaint?.status as keyof typeof statusConfig]?.color || "bg-muted"}>
                  {statusConfig[selectedComplaint?.status as keyof typeof statusConfig]?.label || selectedComplaint?.status}
                </Badge>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Location</h3>
                <p className="text-sm">{selectedComplaint?.location}</p>
              </div>
              {selectedComplaint?.urgency_score && (
                <div>
                  <h3 className="font-semibold mb-2">Urgency Score</h3>
                  <p className="text-sm">{selectedComplaint.urgency_score}/10</p>
                </div>
              )}
            </div>

            <div>
              <h3 className="font-semibold mb-3">Evidence Files</h3>
              {loadingEvidence ? (
                <p className="text-sm text-muted-foreground">Loading evidence...</p>
              ) : evidenceFiles.length === 0 ? (
                <p className="text-sm text-muted-foreground">No evidence files uploaded</p>
              ) : (
                <div className="space-y-2">
                  {evidenceFiles.map((file) => (
                    <Card key={file.id}>
                      <CardContent className="p-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">{file.file_name}</span>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {file.file_type}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Uploaded {format(new Date(file.created_at), "MMM d, yyyy")}
                          </p>
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
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full"
                            onClick={() => window.open(file.file_url, '_blank')}
                          >
                            View File
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
