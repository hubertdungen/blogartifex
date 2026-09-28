import AIService, {
  AI_PROVIDERS,
  getAISettings,
  saveAISettings,
  getActiveModel,
  getActiveApiKey,
  isAIConfigured,
  parseAssistantResponse,
  stripCodeFences,
  sanitizeAIHtml,
  trimHistory,
  buildEditorContextMessage
} from './AIService';

describe('AIService settings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('returns defaults when nothing is stored', () => {
    const settings = getAISettings();
    expect(settings.enabled).toBe(false);
    expect(settings.provider).toBe('openai');
    expect(settings.apiKeys).toEqual({ openai: '', gemini: '', anthropic: '' });
  });

  test('saves and merges settings per provider', () => {
    saveAISettings({ enabled: true, provider: 'anthropic', apiKeys: { ...getAISettings().apiKeys, anthropic: 'sk-ant-test' } });

    const settings = getAISettings();
    expect(settings.enabled).toBe(true);
    expect(settings.provider).toBe('anthropic');
    expect(getActiveApiKey(settings)).toBe('sk-ant-test');
    expect(isAIConfigured(settings)).toBe(true);

    // Switching provider keeps the other provider's key.
    saveAISettings({ provider: 'openai' });
    const updated = getAISettings();
    expect(updated.apiKeys.anthropic).toBe('sk-ant-test');
    expect(isAIConfigured(updated)).toBe(false); // no OpenAI key yet
  });

  test('uses provider default model unless overridden', () => {
    saveAISettings({ provider: 'gemini' });
    expect(getActiveModel(getAISettings())).toBe(AI_PROVIDERS.gemini.defaultModel);

    saveAISettings({ models: { ...getAISettings().models, gemini: 'gemini-2.5-pro' } });
    expect(getActiveModel(getAISettings())).toBe('gemini-2.5-pro');
  });
});

describe('parseAssistantResponse', () => {
  test('parses a plain JSON envelope', () => {
    const result = parseAssistantResponse('{"reply":"Done","actions":[{"type":"set_title","title":"Hello"}]}');
    expect(result.reply).toBe('Done');
    expect(result.actions).toEqual([{ type: 'set_title', title: 'Hello' }]);
  });

  test('parses JSON wrapped in markdown fences', () => {
    const raw = '```json\n{"reply":"ok","actions":[{"type":"insert_html","html":"<p>hi</p>"}]}\n```';
    const result = parseAssistantResponse(raw);
    expect(result.reply).toBe('ok');
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('insert_html');
  });

  test('extracts JSON embedded in prose', () => {
    const raw = 'Here you go: {"reply":"done","actions":[]} hope it helps';
    const result = parseAssistantResponse(raw);
    expect(result.reply).toBe('done');
    expect(result.actions).toEqual([]);
  });

  test('falls back to plain text replies', () => {
    const result = parseAssistantResponse('Just a normal answer without JSON.');
    expect(result.reply).toBe('Just a normal answer without JSON.');
    expect(result.actions).toEqual([]);
  });

  test('filters out malformed actions', () => {
    const raw = JSON.stringify({
      reply: 'ok',
      actions: [
        { type: 'insert_html' }, // missing html
        { type: 'unknown', html: '<p>x</p>' },
        { type: 'replace_document', html: '<p>valid</p>' },
        'not-an-object'
      ]
    });
    const result = parseAssistantResponse(raw);
    expect(result.actions).toEqual([{ type: 'replace_document', html: '<p>valid</p>' }]);
  });
});

describe('sanitizeAIHtml', () => {
  test('removes scripts, event handlers and javascript URLs', () => {
    const dirty = '<p onclick="evil()">Hi</p><script>alert(1)</script><a href="javascript:x()">link</a>';
    const clean = sanitizeAIHtml(dirty);
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('onclick');
    expect(clean).not.toContain('javascript:');
    expect(clean).toContain('<p');
  });

  test('catches unquoted handlers and entity-encoded schemes', () => {
    const clean = sanitizeAIHtml('<img src=x onerror=alert(1)><a href="jav&#x61;script:x()">a</a><svg onload=alert(1)></svg><a href="foto.png">ok</a>');
    expect(clean).not.toMatch(/onerror|onload|javascript/i);
    expect(clean).toContain('href="foto.png"');
  });

  test('keeps image markup with size and alignment', () => {
    const html = '<figure class="image image-style-align-right"><img src="https://example.com/a.png" width="320" alt="x"></figure>';
    expect(sanitizeAIHtml(html)).toBe(html);
  });
});

describe('trimHistory', () => {
  test('drops error/empty turns and a leading assistant turn', () => {
    const history = [
      { role: 'assistant', content: 'hello' },
      { role: 'user', content: 'q1' },
      { role: 'assistant', content: '', error: 'boom' },
      { role: 'user', content: 'q2' }
    ];
    expect(trimHistory(history)).toEqual([
      { role: 'user', content: 'q1' },
      { role: 'user', content: 'q2' }
    ]);
  });
});

describe('stripCodeFences', () => {
  test('strips fenced blocks and trims', () => {
    expect(stripCodeFences('```html\n<p>a</p>\n```')).toBe('<p>a</p>');
    expect(stripCodeFences('  <p>b</p> ')).toBe('<p>b</p>');
  });
});

describe('buildEditorContextMessage', () => {
  test('includes title, article and selection', () => {
    const message = buildEditorContextMessage({
      title: 'My Post',
      html: '<p>Body</p>',
      selectionHtml: '<p>Sel</p>',
      userMessage: 'Fix it'
    });
    expect(message).toContain('My Post');
    expect(message).toContain('<p>Body</p>');
    expect(message).toContain('<p>Sel</p>');
    expect(message).toContain('Fix it');
  });
});

describe('provider transports', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const configure = (provider, key) => {
    saveAISettings({
      enabled: true,
      provider,
      apiKeys: { ...getAISettings().apiKeys, [provider]: key }
    });
  };

  test('complete() rejects when the assistant is disabled', async () => {
    await expect(AIService.complete({ system: 's', messages: [] }))
      .rejects.toThrow(/disabled/i);
  });

  test('complete() rejects when no key is configured', async () => {
    saveAISettings({ enabled: true, provider: 'openai' });
    await expect(AIService.complete({ system: 's', messages: [] }))
      .rejects.toThrow(/API key/i);
  });

  test('calls OpenAI with the expected payload', async () => {
    configure('openai', 'sk-test');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'hello' } }] })
    });

    const text = await AIService.complete({
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }]
    });

    expect(text).toBe('hello');
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain('api.openai.com');
    expect(options.headers.Authorization).toBe('Bearer sk-test');
    const body = JSON.parse(options.body);
    expect(body.model).toBe(AI_PROVIDERS.openai.defaultModel);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'sys' });
  });

  test('calls Gemini with the expected payload', async () => {
    configure('gemini', 'AIza-test');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'oi' }] } }] })
    });

    const text = await AIService.complete({
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }]
    });

    expect(text).toBe('oi');
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain('generativelanguage.googleapis.com');
    expect(url).toContain(AI_PROVIDERS.gemini.defaultModel);
    expect(options.headers['x-goog-api-key']).toBe('AIza-test');
    const body = JSON.parse(options.body);
    expect(body.systemInstruction.parts[0].text).toBe('sys');
  });

  test('calls Anthropic with the expected payload', async () => {
    configure('anthropic', 'sk-ant-test');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'olá' }] })
    });

    const text = await AIService.complete({
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }]
    });

    expect(text).toBe('olá');
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain('api.anthropic.com');
    expect(options.headers['x-api-key']).toBe('sk-ant-test');
    expect(options.headers['anthropic-version']).toBeTruthy();
    const body = JSON.parse(options.body);
    expect(body.system).toBe('sys');
    expect(body.model).toBe(AI_PROVIDERS.anthropic.defaultModel);
  });

  test('maps HTTP errors to readable messages', async () => {
    configure('openai', 'sk-bad');
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid API key' } })
    });

    await expect(AIService.complete({ system: 's', messages: [] }))
      .rejects.toThrow(/rejected the API key/i);
  });

  test('chat() sanitizes HTML in returned actions', async () => {
    configure('openai', 'sk-test');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              reply: 'done',
              actions: [{ type: 'insert_html', html: '<p>ok</p><script>evil()</script>' }]
            })
          }
        }]
      })
    });

    const result = await AIService.chat({
      userMessage: 'write',
      title: 't',
      html: '<p>a</p>'
    });

    expect(result.reply).toBe('done');
    expect(result.actions[0].html).toBe('<p>ok</p>');
  });
});
