import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { trackingCode } = await req.json();

    if (!trackingCode) {
      return new Response(
        JSON.stringify({ 
          error: 'Tracking code is required',
          success: false 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Verifying tracking code:', trackingCode);

    // Fetch complaint by tracking code
    const { data: complaint, error: complaintError } = await supabase
      .from('complaints')
      .select(`
        id,
        title,
        description,
        category,
        status,
        location,
        latitude,
        longitude,
        urgency_score,
        created_at,
        updated_at,
        tracking_code
      `)
      .eq('tracking_code', trackingCode)
      .maybeSingle();

    if (complaintError) {
      console.error('Error fetching complaint:', complaintError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch complaint',
          success: false 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!complaint) {
      return new Response(
        JSON.stringify({ 
          error: 'Complaint not found with this tracking code',
          success: false 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Fetch evidence files
    const { data: evidence, error: evidenceError } = await supabase
      .from('evidence_files')
      .select('id, file_name, file_url, file_type, created_at')
      .eq('complaint_id', complaint.id);

    if (evidenceError) {
      console.error('Error fetching evidence:', evidenceError);
    }

    // Fetch government notes
    const { data: notes, error: notesError } = await supabase
      .from('gov_notes')
      .select('id, note, created_at')
      .eq('complaint_id', complaint.id)
      .order('created_at', { ascending: false });

    if (notesError) {
      console.error('Error fetching notes:', notesError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        complaint: {
          ...complaint,
          evidence: evidence || [],
          notes: notes || []
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in verify-tracking function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
