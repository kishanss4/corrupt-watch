import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { complaint, action } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    let systemPrompt = '';
    let userPrompt = '';

    if (action === 'draft_note') {
      systemPrompt = `You are a government official writing professional, empathetic notes to citizens about their corruption complaints. 
Your notes should be:
- Professional yet approachable
- Clear about next steps
- Empathetic to their concerns
- Specific about timelines when possible
- Encouraging transparency`;

      userPrompt = `Write a professional note to acknowledge this complaint:

Title: ${complaint.title}
Category: ${complaint.category}
Status: ${complaint.status}
Description: ${complaint.description}

Write a brief (3-4 sentences) note that:
1. Acknowledges their complaint
2. Explains what will happen next
3. Provides a realistic timeline
4. Thanks them for reporting`;

    } else if (action === 'suggest_status') {
      systemPrompt = `You are an AI assistant helping government officials manage complaints efficiently. 
Suggest the most appropriate next status based on the complaint details and current status.`;

      userPrompt = `Based on this complaint, suggest the next appropriate status:

Current Status: ${complaint.status}
Title: ${complaint.title}
Category: ${complaint.category}
Description: ${complaint.description}

Suggest one of: pending, in_review, verified, resolved, rejected
Also provide a brief reason for this suggestion.

Respond in JSON format:
{
  "suggested_status": "<status>",
  "reason": "<brief explanation>"
}`;
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    let result;
    if (action === 'suggest_status') {
      try {
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
        result = JSON.parse(jsonStr);
      } catch {
        result = { suggested_status: 'in_review', reason: content };
      }
    } else {
      result = { text: content };
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-response function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
