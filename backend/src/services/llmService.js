const axios = require('axios');

/**
 * Gọi OpenAI Chat Completions. Nếu không có OPENAI_API_KEY thì trả về null (controller dùng fallback).
 */
async function chatCompletion(systemPrompt, userPrompt, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !String(apiKey).trim()) {
    return null;
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const temperature = typeof options.temperature === 'number' ? options.temperature : 0.35;
  const maxTokens = options.max_tokens || 1200;

  try {
    const { data } = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model,
        temperature,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 90000
      }
    );
    const text = data?.choices?.[0]?.message?.content;
    return typeof text === 'string' ? text.trim() : null;
  } catch (err) {
    const msg = err?.response?.data?.error?.message || err.message;
    console.error('[llmService] OpenAI error:', msg);
    throw new Error(msg || 'Lỗi gọi OpenAI');
  }
}

module.exports = { chatCompletion };
