-- Add tracking_code column for anonymous complaints
ALTER TABLE public.complaints
ADD COLUMN tracking_code TEXT UNIQUE;

-- Create index on tracking_code for faster lookups
CREATE INDEX idx_complaints_tracking_code ON public.complaints(tracking_code);

-- Update RLS policy to allow anonymous complaint insertion
CREATE POLICY "Anyone can insert anonymous complaints"
  ON public.complaints FOR INSERT
  TO anon
  WITH CHECK (is_anonymous = true AND user_id IS NULL);

-- Update RLS policy to allow viewing complaints by tracking code
CREATE POLICY "Anyone can view complaints with tracking code"
  ON public.complaints FOR SELECT
  TO anon
  USING (tracking_code IS NOT NULL);

-- Update evidence files policy for anonymous uploads
CREATE POLICY "Anonymous users can insert evidence"
  ON public.evidence_files FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.complaints
      WHERE complaints.id = evidence_files.complaint_id
      AND complaints.is_anonymous = true
    )
  );

-- Allow anonymous users to view public logs
CREATE POLICY "Anonymous users can view public logs"
  ON public.public_logs FOR SELECT
  TO anon
  USING (true);

-- Function to generate a readable tracking code
CREATE OR REPLACE FUNCTION public.generate_tracking_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    -- Generate format: CW-XXXX-XXXX (e.g., CW-A7B9-K2M4)
    code := 'CW-' || 
            upper(substring(md5(random()::text) from 1 for 4)) || '-' ||
            upper(substring(md5(random()::text) from 1 for 4));
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM public.complaints WHERE tracking_code = code) INTO exists;
    
    EXIT WHEN NOT exists;
  END LOOP;
  
  RETURN code;
END;
$$;

-- Trigger to auto-generate tracking code for anonymous complaints
CREATE OR REPLACE FUNCTION public.set_tracking_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_anonymous = true AND NEW.tracking_code IS NULL THEN
    NEW.tracking_code := public.generate_tracking_code();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_complaint_tracking_code
  BEFORE INSERT ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tracking_code();

-- Update storage policies for anonymous uploads
CREATE POLICY "Anonymous users can upload evidence"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'evidence');