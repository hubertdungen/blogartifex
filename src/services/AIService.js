/**
 * AIService - Multi-provider AI integration
 *
 * Lets the user plug in their own API key (or subscription key) for
 * OpenAI (GPT), Google (Gemini) or Anthropic (Claude) and talk to the
 * model directly from the post editor.
 *
 * The service exposes:
 * - Provider metadata (models, key format hints, docs links)
 * - Settings persistence (stored locally in the browser only)
 * - chat()               – free-form conversation with document context
 * - transformSelection() – rewrite a selected HTML fragment
 * - parseAssistantResponse() – parses the JSON action protocol
 * - testConnection()     – small round-trip to validate credentials
 */

import { getStoredJson, setStoredValue } from '../utils/storage';

const SETTINGS_KEY = 'blogartifex_ai_settings';
const REQUEST_TIMEOUT = 90 * 1000;

export const AI_PROVIDERS = {
  openai: {
    id: 'openai',
    label: 'OpenAI (GPT)',
    models: ['gpt-5.5-pro', 'gpt-5.4-pro', 'gpt-5.4-mini', 'gpt-5.4-nano', 'o3-pro', 'o3-mini'],
    defaultModel: 'gpt-5.4-mini',
    keyPlaceholder: 'sk-...',
    keyUrl: 'https://platform.openai.com/api-keys'
  },
  gemini: {
    id: 'gemini',
    label: 'Google (Gemini)',
    models: ['gemini-3.5-flash', 'gemini-3.1-pro', 'gemini-2.5-flash-lite', 'gemini-omni'],
    defaultModel: 'gemini-3.5-flash',
    keyPlaceholder: 'AIza...',
    keyUrl: 'https://aistudio.google.com/app/apikey'
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    models: ['claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5', 'claude-opus-4-8', 'claude-fable-5', 'claude-haiku-4-5'],
    defaultModel: 'claude-sonnet-5',
    keyPlaceholder: 'sk-ant-...',
    keyUrl: 'https://console.anthropic.com/settings/keys'
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    defaultModel: 'deepseek-chat',
    keyPlaceholder: 'sk-...',
    keyUrl: 'https://platform.deepseek.com/api_keys'
  },
  groq: {
    id: 'groq',
    label: 'Meta Llama (Groq)',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
    defaultModel: 'llama-3.3-70b-versatile',
    keyPlaceholder: 'gsk_...',
    keyUrl: 'https://console.groq.com/keys'
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    models: ['openrouter/auto'],
    defaultModel: 'openrouter/auto',
    keyPlaceholder: 'sk-or-...',
    keyUrl: 'https://openrouter.ai/keys'
  }
};

const DEFAULT_SETTINGS = {
  enabled: false,
  provider: 'openai',
  // One key per provider so switching providers does not lose keys.
  apiKeys: { openai: '', gemini: '', anthropic: '', deepseek: '', groq: '', openrouter: '' },
  // Empty model means "use the provider default".
  models: { openai: '', gemini: '', anthropic: '', deepseek: '', groq: '', openrouter: '' },
  tone: 'default',
  customTone: ''
};

export const getAISettings = () => {
  const stored = getStoredJson(SETTINGS_KEY, {});
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    apiKeys: { ...DEFAULT_SETTINGS.apiKeys, ...(stored.apiKeys || {}) },
    models: { ...DEFAULT_SETTINGS.models, ...(stored.models || {}) }
  };
};

export const saveAISettings = (settings) => {
  const merged = { ...getAISettings(), ...settings };
  setStoredValue(SETTINGS_KEY, JSON.stringify(merged));
  window.dispatchEvent(new Event('blogartifex_ai_settings_updated'));
  return merged;
};

export const getActiveProvider = (settings = getAISettings()) => {
  return AI_PROVIDERS[settings.provider] || AI_PROVIDERS.openai;
};

export const getActiveModel = (settings = getAISettings()) => {
  const provider = getActiveProvider(settings);
  return (settings.models && settings.models[provider.id])
    || getCachedModels(provider.id).auto
    || provider.defaultModel;
};

// ---- Live model lists ------------------------------------------------------
// Model names change every few weeks, so the list comes from each provider
// (with the user's key) and "Automatic" picks the newest balanced model.
// The static lists above are only a fallback before the first refresh.

const MODELS_KEY = 'blogartifex_ai_models';
const MODELS_MAX_AGE = 24 * 60 * 60 * 1000;
const bearer = key => ({ Authorization: `Bearer ${key}` });
const NOT_CHAT = /(audio|realtime|transcribe|tts|image|dall-e|whisper|search|embed|moderation|instruct|codex|guard|vision-exp|:batch)/i;
const versionOf = id => parseFloat((id.match(/(\d+(?:\.\d+)?)/) || [])[1]) || 0;

const MODEL_SOURCES = {
  openai: {
    url: 'https://api.openai.com/v1/models',
    headers: bearer,
    parse: data => (data.data || [])
      .filter(m => /^(gpt-|o\d)/.test(m.id) && !NOT_CHAT.test(m.id))
      .map(m => ({ id: m.id, created: m.created || 0 })),
    auto: list => list.find(m => !/(pro|mini|nano|preview|\d{4}-\d{2}-\d{2})/.test(m.id))
  },
  anthropic: {
    url: 'https://api.anthropic.com/v1/models?limit=100',
    headers: key => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }),
    parse: data => (data.data || []).map(m => ({ id: m.id, created: Date.parse(m.created_at) / 1000 || 0 })),
    auto: list => list.find(m => /sonnet/.test(m.id))
  },
  gemini: {
    url: 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200',
    headers: key => ({ 'x-goog-api-key': key }),
    parse: data => (data.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent')
        && /^models\/gemini/.test(m.name) && !NOT_CHAT.test(m.name) && !/live/.test(m.name))
      .map(m => ({ id: m.name.replace(/^models\//, ''), created: versionOf(m.name.replace(/^models\/gemini-/, '')) })),
    auto: list => list.find(m => /flash/.test(m.id) && !/(lite|preview|exp|latest)/.test(m.id))
  },
  deepseek: {
    url: 'https://api.deepseek.com/models',
    headers: bearer,
    parse: data => (data.data || []).map(m => ({ id: m.id, created: 0 })),
    auto: list => list.find(m => m.id === 'deepseek-chat')
  },
  groq: {
    url: 'https://api.groq.com/openai/v1/models',
    headers: bearer,
    parse: data => (data.data || [])
      .filter(m => /llama/i.test(m.id) && !NOT_CHAT.test(m.id))
      .map(m => ({ id: m.id, created: m.created || 0 })),
    auto: list => list.find(m => /(versatile|maverick|scout|70b)/.test(m.id))
  },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/models',
    headers: () => ({}),
    parse: data => (data.data || [])
      .filter(m => !NOT_CHAT.test(m.id))
      .map(m => ({ id: m.id, created: m.created || 0, free: /:free$/.test(m.id) })),
    auto: () => ({ id: 'openrouter/auto' })
  }
};

/** Last model list fetched for a provider: { at, models: [{id, free}], auto } */
export const getCachedModels = (providerId) => (getStoredJson(MODELS_KEY, {})[providerId]) || {};

export const modelListIsStale = (providerId) => {
  const cached = getCachedModels(providerId);
  return !cached.at || Date.now() - cached.at > MODELS_MAX_AGE;
};

/**
 * Fetches the provider's current models with the user's key, newest first,
 * and works out the "Automatic" choice. Cached for 24 h.
 */
export const refreshModels = async (providerId, apiKey) => {
  const source = MODEL_SOURCES[providerId];
  if (!source) throw new Error(`Unknown AI provider: ${providerId}`);

  const response = await fetchWithTimeout(source.url, { headers: source.headers(apiKey) });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const list = source.parse(await response.json())
    .sort((a, b) => (b.free === true) - (a.free === true) || b.created - a.created || b.id.localeCompare(a.id));
  if (!list.length) throw new Error('The provider returned no chat models.');

  const auto = (source.auto(list) || list.find(m => !/(preview|exp)/.test(m.id)) || list[0]).id;
  const entry = { at: Date.now(), models: list.map(({ id, free }) => ({ id, free: !!free })), auto };
  setStoredValue(MODELS_KEY, JSON.stringify({ ...getStoredJson(MODELS_KEY, {}), [providerId]: entry }));
  return entry;
};

export const getActiveApiKey = (settings = getAISettings()) => {
  const provider = getActiveProvider(settings);
  return ((settings.apiKeys && settings.apiKeys[provider.id]) || '').trim();
};

export const isAIConfigured = (settings = getAISettings()) => {
  return !!(settings.enabled && getActiveApiKey(settings));
};

const getToneInstruction = (settings) => {
  const tone = settings.tone || 'default';
  if (tone === 'default') return '';
  if (tone === 'custom' && settings.customTone) {
    return `\n\nTone & Style Requirement: ${settings.customTone}`;
  }
  const tones = {
    casual: 'Use a casual, friendly, and approachable tone.',
    humorous: 'Use a humorous, witty, and engaging tone.',
    inspirational: 'Use an inspirational, motivating, and uplifting tone.',
    technical: 'Use a technical, precise, and academic tone.'
  };
  return tones[tone] ? `\n\nTone & Style Requirement: ${tones[tone]}` : '';
};

/**
 * System prompt for the editor assistant. The model answers with a JSON
 * envelope so BlogArtifex can apply edits directly inside CKEditor.
 */
const buildAssistantSystemPrompt = ({ locale, toneInstruction }) => `You are BlogArtifex's writing assistant, embedded in a rich-text editor for Blogger posts.
You help the user write, edit and illustrate blog articles.${toneInstruction}

Always answer with a SINGLE valid JSON object (no markdown fences, no text outside the JSON):
{
  "reply": "<short conversational answer for the chat panel>",
  "actions": [ ...zero or more of the actions below... ]
}

Available actions:
- {"type": "replace_document", "html": "<full new article body HTML>"} — rewrite the whole article.
- {"type": "insert_html", "html": "<HTML fragment>"} — insert content at the user's cursor (or at the end).
- {"type": "replace_selection", "html": "<HTML fragment>"} — replace the text the user currently has selected. Only use when a selection is provided.
- {"type": "set_title", "title": "<new post title>"} — change the post title.

HTML rules for article content:
- Use clean semantic HTML: <h2>/<h3> for sections, <p>, <ul>/<ol>, <blockquote>, <table>, <a>, <strong>, <i>.
- Images: <figure class="image"><img src="URL" alt="description" width="600"><figcaption>optional caption</figcaption></figure>
- Image position: add one class to the <figure> — "image-style-align-left", "image-style-align-center", "image-style-align-right", or "image-style-side" (floated right sidebar image).
- Image formatting: you can add style="object-fit: cover; width: 100%;", style="object-fit: contain; width: 100%;", style="object-fit: fill; width: 100%;" or width attribute (pixels) directly to the <img> tag inside the <figure>.
- Only reference image URLs the user gave you, images already present in the article, or clearly-labelled placeholders such as https://placehold.co/800x400.
- Never include <html>, <head>, <body> or <script> tags.

Reply in the user's language (interface locale: ${locale}).
When the user only asks a question, return "actions": [].`;

const buildSelectionSystemPrompt = ({ toneInstruction }) => `You rewrite fragments of a blog article.
You receive an HTML fragment and an instruction.${toneInstruction}
Return ONLY the rewritten HTML fragment. No JSON, no markdown fences, no explanations.
Keep the same language as the fragment unless asked otherwise, and keep inline formatting (links, bold, images) unless the instruction says to change it.`;

/**
 * Strips markdown code fences the models sometimes add despite instructions.
 */
export const stripCodeFences = (text) => {
  if (!text) return '';
  let out = text.trim();
  const fence = out.match(/^```[a-zA-Z]*\s*([\s\S]*?)\s*```$/);
  if (fence) out = fence[1].trim();
  return out;
};

/**
 * Parses the assistant JSON envelope. Falls back to a plain-text reply
 * when the model did not follow the protocol.
 */
export const parseAssistantResponse = (text) => {
  const cleaned = stripCodeFences(text);

  let candidate = cleaned;
  // Some models wrap the JSON in prose; extract the outermost object.
  if (!candidate.startsWith('{')) {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start !== -1 && end > start) {
      candidate = candidate.slice(start, end + 1);
    }
  }

  try {
    const parsed = JSON.parse(candidate);
    if (parsed && typeof parsed === 'object' && ('reply' in parsed || 'actions' in parsed)) {
      const actions = Array.isArray(parsed.actions) ? parsed.actions.filter(isValidAction) : [];
      return { reply: typeof parsed.reply === 'string' ? parsed.reply : '', actions };
    }
  } catch {
    // Not JSON – treat the full text as a conversational reply.
  }

  return { reply: cleaned, actions: [] };
};

const isValidAction = (action) => {
  if (!action || typeof action !== 'object') return false;
  switch (action.type) {
    case 'replace_document':
    case 'insert_html':
    case 'replace_selection':
      return typeof action.html === 'string' && action.html.length > 0;
    case 'set_title':
      return typeof action.title === 'string';
    default:
      return false;
  }
};

/**
 * Removes obviously dangerous markup from model-generated HTML before it
 * reaches the editor (defence in depth – CKEditor filters too).
 */
const DANGEROUS_TAGS = 'script,style,iframe,object,embed,form,base,meta,link';
const URL_ATTRS = ['href', 'src', 'xlink:href', 'action', 'formaction'];
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const SAFE_SCHEME = /^(https?:|mailto:|tel:|data:image\/(png|gif|jpe?g|webp);)/i;

export const sanitizeAIHtml = (html) => {
  if (!html) return '';
  // Parse instead of regex so unquoted handlers and entity-encoded schemes
  // (jav&#x61;script:) are seen the way the browser will see them.
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  doc.body.querySelectorAll(DANGEROUS_TAGS).forEach(el => el.remove());
  doc.body.querySelectorAll('*').forEach(el => {
    Array.from(el.attributes).forEach(({ name, value }) => {
      const lower = name.toLowerCase();
      // eslint-disable-next-line no-control-regex -- browsers ignore these inside URLs
      const url = value.replace(/[\s\u0000-\u001f]/g, '');
      if (lower.startsWith('on') || (URL_ATTRS.includes(lower) && HAS_SCHEME.test(url) && !SAFE_SCHEME.test(url))) {
        el.removeAttribute(name);
      }
    });
  });
  return doc.body.innerHTML;
};

const MAX_CONTEXT_HTML = 60000;

const truncate = (text, max) => {
  if (!text || text.length <= max) return text || '';
  return `${text.slice(0, max)}\n<!-- [content truncated] -->`;
};

/**
 * Builds the user message with document context for the chat assistant.
 */
export const buildEditorContextMessage = ({ title, html, selectionHtml, templates, userMessage }) => {
  const parts = [
    `POST TITLE: ${title || '(untitled)'}`,
    `CURRENT ARTICLE HTML:\n${truncate(html, MAX_CONTEXT_HTML) || '(empty)'}`
  ];
  if (selectionHtml) {
    parts.push(`CURRENTLY SELECTED FRAGMENT:\n${truncate(selectionHtml, 8000)}`);
  }
  if (templates && templates.length > 0) {
    const tpls = templates.map(t => `Template "${t.name}":\n${t.content}`).join('\n\n');
    parts.push(`AVAILABLE TEMPLATES:\n${tpls}`);
  }
  parts.push(`USER REQUEST:\n${userMessage}`);
  return parts.join('\n\n---\n\n');
};

/* ------------------------------------------------------------------ */
/* Provider transports                                                  */
/* ------------------------------------------------------------------ */

const fetchWithTimeout = async (url, options) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('AI request timed out. Please try again.');
    }
    throw new Error('Could not reach the AI provider. Check your connection.');
  } finally {
    clearTimeout(timer);
  }
};

const readErrorMessage = async (response) => {
  let detail = '';
  try {
    const data = await response.json();
    detail = data?.error?.message || data?.message || '';
  } catch {
    // ignore body parse failures
  }
  if (response.status === 401 || response.status === 403) {
    return `The AI provider rejected the API key (${response.status}). ${detail}`.trim();
  }
  if (response.status === 429) {
    return `AI rate limit or quota exceeded (429). ${detail}`.trim();
  }
  return `AI request failed (${response.status}). ${detail}`.trim();
};

// OpenAI's chat format, also spoken by DeepSeek, Groq and OpenRouter
const openAICompatible = ({ url, tokensField = 'max_tokens', headers = {} }) =>
  async ({ apiKey, model, system, messages, maxTokens }) => {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...headers
      },
      body: JSON.stringify({
        model,
        [tokensField]: maxTokens,
        messages: [
          { role: 'system', content: system },
          ...messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
        ]
      })
    });

    if (!response.ok) throw new Error(await readErrorMessage(response));
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error('The AI provider returned an empty response.');
    return text;
  };

const callOpenAI = openAICompatible({
  url: 'https://api.openai.com/v1/chat/completions',
  tokensField: 'max_completion_tokens'
});

const callGemini = async ({ apiKey, model, system, messages, maxTokens }) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      })),
      generationConfig: { maxOutputTokens: maxTokens }
    })
  });

  if (!response.ok) throw new Error(await readErrorMessage(response));
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('');
  if (!text) throw new Error('The AI provider returned an empty response.');
  return text;
};

const callAnthropic = async ({ apiKey, model, system, messages, maxTokens }) => {
  const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      // Required for calling the Anthropic API from a browser with a user-supplied key.
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
    })
  });

  if (!response.ok) throw new Error(await readErrorMessage(response));
  const data = await response.json();
  const text = (data?.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  if (!text) throw new Error('The AI provider returned an empty response.');
  return text;
};

const TRANSPORTS = {
  openai: callOpenAI,
  gemini: callGemini,
  anthropic: callAnthropic,
  deepseek: openAICompatible({ url: 'https://api.deepseek.com/chat/completions' }),
  groq: openAICompatible({ url: 'https://api.groq.com/openai/v1/chat/completions' }),
  openrouter: openAICompatible({
    url: 'https://openrouter.ai/api/v1/chat/completions',
    headers: { 'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : '', 'X-Title': 'BlogArtifex' }
  })
};

/**
 * Low-level completion call.
 * @param {Object} params
 * @param {string} params.system - system prompt
 * @param {Array<{role: 'user'|'assistant', content: string}>} params.messages
 * @param {number} [params.maxTokens]
 * @returns {Promise<string>} raw model text
 */
export const complete = async ({ system, messages, maxTokens = 8192 }) => {
  const settings = getAISettings();

  if (!settings.enabled) {
    throw new Error('AI assistant is disabled. Enable it in Settings.');
  }

  const apiKey = getActiveApiKey(settings);
  if (!apiKey) {
    throw new Error('No API key configured for the selected AI provider. Add one in Settings.');
  }

  const provider = getActiveProvider(settings);
  const transport = TRANSPORTS[provider.id];
  const model = getActiveModel(settings);

  return transport({ apiKey, model, system, messages, maxTokens });
};

/**
 * Last turns of the chat that providers accept: no empty/error entries, and
 * starting with a user turn (Anthropic rejects a leading assistant message).
 */
export const trimHistory = (history) => {
  const turns = history
    .filter(m => !m.error && m.content && m.content.trim())
    .slice(-8)
    .map(m => ({ role: m.role, content: m.content }));
  while (turns.length && turns[0].role !== 'user') turns.shift();
  return turns;
};

/**
 * Chat with the editor assistant. Returns { reply, actions }.
 */
export const chat = async ({ history = [], userMessage, title, html, selectionHtml, templates, locale = 'en-US' }) => {
  const settings = getAISettings();
  const toneInstruction = getToneInstruction(settings);
  const contextMessage = buildEditorContextMessage({ title, html, selectionHtml, templates, userMessage });

  // Older turns are sent as plain text (no document snapshots) to keep
  // requests small; the current turn carries the fresh article HTML.
  const messages = [
    ...trimHistory(history),
    { role: 'user', content: contextMessage }
  ];

  const raw = await complete({
    system: buildAssistantSystemPrompt({ locale, toneInstruction }),
    messages
  });

  const parsed = parseAssistantResponse(raw);
  parsed.actions = parsed.actions.map(action => (
    action.html ? { ...action, html: sanitizeAIHtml(action.html) } : action
  ));
  return parsed;
};

/**
 * Rewrites a selected HTML fragment following an instruction.
 * Returns the replacement HTML.
 */
export const transformSelection = async ({ selectionHtml, instruction, title, locale = 'en-US' }) => {
  const settings = getAISettings();
  const toneInstruction = getToneInstruction(settings);

  const raw = await complete({
    system: buildSelectionSystemPrompt({ toneInstruction }),
    messages: [{
      role: 'user',
      content: [
        `Interface locale: ${locale}`,
        `Article title: ${title || '(untitled)'}`,
        `Instruction: ${instruction}`,
        `Fragment to rewrite:\n${selectionHtml}`
      ].join('\n\n')
    }],
    maxTokens: 4096
  });

  const html = sanitizeAIHtml(stripCodeFences(raw));
  if (!html.trim()) {
    throw new Error('The AI provider returned an empty response.');
  }
  return html;
};

/**
 * Validates the configured provider/key with a minimal request.
 */
export const testConnection = async () => {
  const raw = await complete({
    system: 'You are a connectivity test. Answer with the single word: OK',
    messages: [{ role: 'user', content: 'ping' }],
    // Reasoning models spend tokens thinking before answering; 20 left the reply empty.
    maxTokens: 1024
  });
  return raw.trim();
};

const AIService = {
  AI_PROVIDERS,
  getAISettings,
  saveAISettings,
  getActiveProvider,
  getActiveModel,
  getActiveApiKey,
  isAIConfigured,
  parseAssistantResponse,
  stripCodeFences,
  sanitizeAIHtml,
  buildEditorContextMessage,
  complete,
  chat,
  transformSelection,
  testConnection
};

export default AIService;
