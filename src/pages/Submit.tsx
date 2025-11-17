import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { Upload, FileText, Loader2, ShieldAlert, MapPin } from "lucide-react";
import { z } from "zod";
import { TrackingCodeDialog } from "@/components/TrackingCodeDialog";
import { User } from "@supabase/supabase-js";
import { LocationMap } from "@/components/LocationMap";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const complaintSchema = z.object({
  title: z.string().min(10, "Title must be at least 10 characters").max(200, "Title must be less than 200 characters"),
  description: z.string().min(50, "Description must be at least 50 characters").max(5000, "Description must be less than 5000 characters"),
  category: z.enum(["bribery", "misconduct", "misuse_of_funds", "negligence", "infrastructure", "other"]),
  location: z.string().min(3, "Location is required"),
});

export default function Submit() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isAnonymous = searchParams.get("anonymous") === "true";
  
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [trackingCode, setTrackingCode] = useState("");
  const [showTrackingDialog, setShowTrackingDialog] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    location: "",
    latitude: null as number | null,
    longitude: null as number | null,
  });
  const [geocoding, setGeocoding] = useState(false);

  // Geocode location text input with debouncing
  useEffect(() => {
    if (!formData.location || formData.location.length < 3) return;

    const timeoutId = setTimeout(async () => {
      setGeocoding(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(formData.location)}&limit=1`
        );
        const data = await response.json();
        
        if (data && data.length > 0) {
          const { lat, lon } = data[0];
          setFormData(prev => ({
            ...prev,
            latitude: parseFloat(lat),
            longitude: parseFloat(lon),
          }));
        }
      } catch (error) {
        console.error("Geocoding error:", error);
      } finally {
        setGeocoding(false);
      }
    }, 1000); // Debounce for 1 second

    return () => clearTimeout(timeoutId);
  }, [formData.location]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session && !isAnonymous) {
        toast.error("Please sign in to submit a complaint");
        navigate("/auth");
      }
      setUser(session?.user ?? null);
    });
  }, [navigate, isAnonymous]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      if (selectedFiles.length + files.length > 5) {
        toast.error("Maximum 5 files allowed");
        return;
      }
      setFiles([...files, ...selectedFiles]);
    }
  };

  const calculateFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = complaintSchema.parse(formData);

      // Create complaint (anonymous or authenticated)
      const { data: complaint, error: complaintError } = await supabase
        .from("complaints")
        .insert({
          user_id: isAnonymous ? null : user?.id,
          is_anonymous: isAnonymous,
          title: validated.title,
          description: validated.description,
          category: validated.category,
          location: validated.location,
          latitude: formData.latitude,
          longitude: formData.longitude,
          urgency_score: 5, // Default medium priority
        })
        .select()
        .single();

      if (complaintError) throw complaintError;

      // Upload files and create evidence records
      const evidenceHashes: string[] = [];
      for (const file of files) {
        const fileHash = await calculateFileHash(file);
        evidenceHashes.push(fileHash);

        const userId = isAnonymous ? "anonymous" : user?.id;
        const filePath = `${userId}/${complaint.id}/${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("evidence")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("evidence")
          .getPublicUrl(filePath);

        await supabase.from("evidence_files").insert({
          complaint_id: complaint.id,
          file_url: publicUrl,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          file_hash: fileHash,
        });
      }

      // Update complaint with evidence hashes
      await supabase
        .from("complaints")
        .update({ evidence_hashes: evidenceHashes })
        .eq("id", complaint.id);

      // Create audit log
      await supabase.from("public_logs").insert({
        complaint_id: complaint.id,
        metadata_hash: evidenceHashes.join(","),
        action: "complaint_created",
      });

      if (isAnonymous && complaint.tracking_code) {
        setTrackingCode(complaint.tracking_code);
        setShowTrackingDialog(true);
      } else {
        // Show complaint ID for authenticated users
        toast.success(`Complaint submitted! ID: ${complaint.id.substring(0, 8)}...`);
        setTimeout(() => {
          navigate(`/verify?id=${complaint.id}`);
        }, 2000);
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(error.message || "Failed to submit complaint");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDialogClose = () => {
    setShowTrackingDialog(false);
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-8">
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              {isAnonymous && <ShieldAlert className="h-6 w-6 text-primary" />}
              {isAnonymous ? "Anonymous Complaint" : "Submit a Complaint"}
            </CardTitle>
            <CardDescription>
              {isAnonymous
                ? "Report corruption anonymously. You'll receive a tracking code to monitor your complaint."
                : "Report corruption or misconduct. All information is securely stored and verifiable."}
            </CardDescription>
          </CardHeader>
          {isAnonymous && (
            <div className="px-6">
              <Alert className="bg-primary/5 border-primary/20">
                <ShieldAlert className="h-4 w-4 text-primary" />
                <AlertDescription className="text-sm">
                  Your identity will remain completely anonymous. After submission, you'll receive a unique tracking code to check your complaint status.
                </AlertDescription>
              </Alert>
            </div>
          )}
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Complaint Title</Label>
                <Input
                  id="title"
                  placeholder="Brief summary of the issue"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bribery">Bribery</SelectItem>
                    <SelectItem value="misconduct">Misconduct</SelectItem>
                    <SelectItem value="misuse_of_funds">Misuse of Funds</SelectItem>
                    <SelectItem value="negligence">Negligence</SelectItem>
                    <SelectItem value="infrastructure">Infrastructure Issues</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Location</Label>
                <Tabs defaultValue="text" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="text">Enter Text</TabsTrigger>
                    <TabsTrigger value="map">Select on Map</TabsTrigger>
                  </TabsList>
                  <TabsContent value="text" className="space-y-2">
                    <div className="relative">
                      <Input
                        id="location"
                        placeholder="Enter location where the incident occurred"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        required
                      />
                      {geocoding && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    {formData.latitude && formData.longitude && (
                      <div className="mt-2">
                        <p className="text-sm text-muted-foreground mb-2">Location preview:</p>
                        <LocationMap
                          onLocationSelect={(location, lat, lng) => {
                            setFormData({ 
                              ...formData, 
                              location, 
                              latitude: lat, 
                              longitude: lng 
                            });
                          }}
                          externalLat={formData.latitude}
                          externalLng={formData.longitude}
                        />
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="map" className="space-y-2">
                    <p className="text-sm text-muted-foreground mb-2">Click on the map to select a location</p>
                    <LocationMap
                      onLocationSelect={(location, lat, lng) => {
                        setFormData({ 
                          ...formData, 
                          location, 
                          latitude: lat, 
                          longitude: lng 
                        });
                      }}
                      externalLat={formData.latitude}
                      externalLng={formData.longitude}
                    />
                    {formData.location && (
                      <div className="flex items-center gap-2 mt-2 p-2 bg-muted rounded-md">
                        <MapPin className="h-4 w-4 text-primary" />
                        <span className="text-sm">{formData.location}</span>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Detailed Description</Label>
                <Textarea
                  id="description"
                  placeholder="Provide a detailed account of the incident, including dates, individuals involved, and any other relevant information"
                  rows={6}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Evidence (Optional, max 5 files)</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                  <Input
                    type="file"
                    multiple
                    accept="image/*,video/*,audio/*,.pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                  />
                  <Label htmlFor="file-upload" className="cursor-pointer">
                    <Button type="button" variant="outline" asChild>
                      <span>Choose Files</span>
                    </Button>
                  </Label>
                  <p className="text-xs text-muted-foreground mt-2">
                    Supported: Images, Videos, Audio, and PDF files
                  </p>
                  {files.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {files.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <FileText className="h-4 w-4" />
                          {file.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Complaint"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <TrackingCodeDialog
        open={showTrackingDialog}
        trackingCode={trackingCode}
        onClose={handleDialogClose}
      />
    </div>
  );
}
