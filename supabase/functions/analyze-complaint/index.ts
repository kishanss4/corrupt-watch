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
    const { title, description, category, location } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are an AI assistant analyzing corruption complaints for a government anti-corruption system. 
Analyze the complaint and provide:
1. Urgency score (1-10, where 10 is most urgent)
2. Sentiment analysis (positive, neutral, negative, critical)
3. Key issues identified (list of main concerns)
4. Recommended actions (specific steps to take)
5. Similar patterns (if this looks like a common issue)
6. Risk assessment (low, medium, high, critical)

Be objective, thorough, and focus on actionable insights.`;

    const userPrompt = `Analyze this corruption complaint:

Title: ${title}
Category: ${category}
Location: ${location}
Description: ${description}

Provide a comprehensive analysis in the following JSON format:
{
  "urgency_score": <number 1-10>,
  "sentiment": "<positive|neutral|negative|critical>",
  "key_issues": ["issue1", "issue2", ...],
  "recommended_actions": ["action1", "action2", ...],
  "patterns": "<description of any patterns>",
  "risk_level": "<low|medium|high|critical>",
  "summary": "<brief 2-3 sentence summary>"
}`;

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

    // Try to parse JSON from the response
    let analysis;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      analysis = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', content);
      // Fallback: return raw content
      analysis = {
        urgency_score: 5,
        sentiment: 'neutral',
        key_issues: ['Analysis pending'],
        recommended_actions: ['Manual review required'],
        patterns: 'Unable to determine patterns',
        risk_level: 'medium',
        summary: content.substring(0, 200),
        raw_response: content
      };
    }

    return new Response(
      JSON.stringify({ analysis }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-complaint function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
