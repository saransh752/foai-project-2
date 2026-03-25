export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, model } = req.body;
    
    if (!messages) {
      return res.status(400).json({ error: 'Messages are required' });
    }

    const payload = {
      model: model || process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-70b-instruct',
      messages,
    };

    const openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!openRouterRes.ok) {
      const errorText = await openRouterRes.text();
      return res.status(openRouterRes.status).json({ error: `OpenRouter error: ${errorText}` });
    }

    const data = await openRouterRes.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('API Chat Error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
