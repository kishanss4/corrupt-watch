-- Make evidence bucket public so images can be viewed
UPDATE storage.buckets 
SET public = true 
WHERE id = 'evidence';

-- Allow public read access to evidence files
CREATE POLICY "Anyone can view evidence files"
ON storage.objects FOR SELECT
USING (bucket_id = 'evidence');

-- Update complaints table RLS to allow public read access
CREATE POLICY "Anyone can view all complaints"
ON public.complaints FOR SELECT
USING (true);

-- Allow public read access to evidence_files table
CREATE POLICY "Anyone can view all evidence files"
ON public.evidence_files FOR SELECT
USING (true);

-- Allow public read access to gov_notes table
CREATE POLICY "Anyone can view all notes"
ON public.gov_notes FOR SELECT
USING (true);