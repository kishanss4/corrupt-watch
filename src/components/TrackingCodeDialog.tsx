import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, CheckCircle2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface TrackingCodeDialogProps {
  open: boolean;
  trackingCode: string;
  onClose: () => void;
}

export const TrackingCodeDialog = ({ open, trackingCode, onClose }: TrackingCodeDialogProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(trackingCode);
    setCopied(true);
    toast.success("Tracking code copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="h-12 w-12 text-secondary" />
          </div>
          <DialogTitle className="text-center text-2xl">Complaint Submitted Successfully!</DialogTitle>
          <DialogDescription className="text-center">
            Your anonymous complaint has been recorded. Save this tracking code to check your complaint status.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted p-6 rounded-lg text-center space-y-2">
            <p className="text-sm text-muted-foreground font-medium">Your Tracking Code</p>
            <p className="text-3xl font-bold font-mono tracking-wider text-primary">
              {trackingCode}
            </p>
          </div>

          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-900 dark:text-amber-200">
              <strong>Important:</strong> Save this code! You'll need it to track your complaint. We cannot recover this code if lost.
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleCopy} className="flex-1" variant={copied ? "secondary" : "default"}>
              {copied ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Code
                </>
              )}
            </Button>
            <Button onClick={onClose} variant="outline" className="flex-1">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
