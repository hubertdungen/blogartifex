# Estrutura do Projeto BlogArtifex

Estrutura atual do repositório (ficheiros relevantes):

```
blogartifex/
├── .github/workflows/        # Workflows: release (binários + APK) e teste Android
├── android/                  # Projeto nativo Android (Capacitor); a keystore
│                             # de assinatura é gerada no CI (nunca versionada)
├── docs/screenshots/         # Capturas de ecrã usadas no README
├── public/                   # Ficheiros estáticos (index.html, logos, manifest)
├── src/
│   ├── components/
│   │   ├── AIAssistant.js       # Painel de chat com IA no editor
│   │   ├── AISelectionMenu.js   # Menu flutuante de IA sobre texto selecionado
│   │   ├── AuthDebugger.js      # Ferramenta de depuração de autenticação
│   │   ├── Dashboard.js         # Painel com blogues, posts recentes e estatísticas
│   │   ├── Feedback.js          # Mensagens de feedback (sucesso/erro/info)
│   │   ├── LanguageSelector.js  # Seletor de idioma no login
│   │   ├── Login.js             # Autenticação Google OAuth
│   │   ├── LoginDebugger.js     # Overlay de depuração do login
│   │   ├── PostEditor.js        # Editor de artigos (CKEditor 5 + IA)
│   │   ├── Settings.js          # Definições (incl. fornecedor de IA)
│   │   ├── Sidebar.js           # Navegação lateral
│   │   └── TemplatesManager.js  # Gestor de modelos de conteúdo
│   ├── locales/
│   │   ├── en-US.js             # Traduções em inglês
│   │   └── pt-PT.js             # Traduções em português
│   ├── services/
│   │   ├── AIService.js         # Integração multi-fornecedor de IA (GPT/Gemini/Claude)
│   │   ├── AIService.test.js    # Testes do serviço de IA
│   │   ├── AuthService.js       # Gestão de tokens e sessão Google
│   │   ├── BloggerService.js    # Cliente da API do Blogger (cache, timeouts)
│   │   ├── BloggerService.test.js
│   │   ├── I18nService.js       # Serviço de internacionalização
│   │   └── TokenManager.js      # Utilitários de token
│   ├── styles/
│   │   ├── ai.css               # Estilos do assistente de IA
│   │   ├── app.css              # Estilos globais e layout
│   │   ├── dashboard.css
│   │   ├── debug.css
│   │   ├── editor.css
│   │   ├── feedback.css
│   │   ├── index.css
│   │   ├── settings.css
│   │   └── templates.css
│   ├── utils/
│   │   ├── ckeditorExtensions.js # Plugins runtime do CKEditor (upload base64,
│   │   │                         # preservação de largura/altura de imagens,
│   │   │                         # configuração de toolbar)
│   │   ├── dateUtils.js
│   │   ├── fileUtils.js
│   │   ├── logger.js
│   │   └── storage.js            # Acesso seguro ao localStorage
│   ├── App.js                    # Rotas e layout autenticado
│   ├── index.js                  # Entrada da aplicação (GoogleOAuthProvider)
│   ├── reportWebVitals.js
│   └── setupTests.js
├── build-release.js / .sh / .bat # Empacotamento portátil (pkg)
├── capacitor.config.json         # Configuração do wrapper Android (Capacitor)
├── config-overrides.js           # Overrides do webpack (CSS do CKEditor)
├── scheduler.js                  # Serviço opcional de publicação agendada
├── server.js                     # Servidor estático de produção
├── package.json
├── README.md / README_PT.md
└── Project_Structure.md
```

## Arquitetura

- **UI**: React 18 com `react-router-dom` (HashRouter). Tema claro/escuro
  aplicado via classe no `body`.
- **Editor**: CKEditor 5 (build clássico) com plugins runtime adicionais em
  `src/utils/ckeditorExtensions.js`:
  - upload de imagens do disco como data URLs base64;
  - preservação dos atributos `width`/`height` das imagens (necessário para o
    redimensionamento feito pela IA e por conteúdo importado);
  - toolbar limitada às funcionalidades realmente existentes no build.
- **Assistente de IA** (`src/services/AIService.js`):
  - Fornecedores suportados: OpenAI (GPT), Google (Gemini), Anthropic (Claude).
  - A chave de API é fornecida pelo utilizador e guardada apenas no
    `localStorage` (`blogartifex_ai_settings`); os pedidos vão diretamente do
    navegador para o fornecedor.
  - Protocolo de ações em JSON: o modelo devolve `{"reply", "actions"}` e o
    editor aplica `replace_document`, `insert_html`, `replace_selection` e
    `set_title` através do modelo do CKEditor (compatível com undo).
  - `transformSelection()` reescreve fragmentos HTML selecionados (menu
    flutuante de seleção).
- **Blogger**: `BloggerService.js` encapsula a API v3 com cache de 5 minutos,
  timeouts e mensagens de erro tratadas.
- **i18n**: `I18nService.js` + `src/locales/*.js` (en-US, pt-PT).

## Dados no localStorage

| Chave                     | Conteúdo                                    |
| ------------------------- | ------------------------------------------- |
| `blogartifex_token`         | Access token Google/Blogger                 |
| `blogartifex_settings`      | Preferências gerais                         |
| `blogartifex_ai_settings`   | Fornecedor de IA, chaves e modelos          |
| `blogartifex_templates`     | Modelos de conteúdo                         |
| `blogartifex_draft_*`       | Rascunhos locais auto-guardados             |
| `blogartifex_locale`        | Idioma da interface                         |
| `theme`                   | Tema claro/escuro                           |

## Planeamento (roadmap)

Curto prazo:
- [x] App Android experimental (wrapper Capacitor, APK nos releases)
- [ ] Fluxo de login Google nativo na app Android
- [x] Assistente de IA integrado no editor (chat + ações no documento)
- [x] Menu de IA sobre seleção de texto (melhorar/corrigir/encurtar/expandir/pedido livre)
- [x] Inserção de imagens do disco (base64) e redimensionamento/posicionamento
- [x] Restauro de rascunhos locais auto-guardados
- [x] Aplicação do blogue e modelo padrão definidos nas Definições
- [ ] Streaming das respostas de IA no painel de chat
- [ ] Upload de imagens para um serviço de alojamento (em vez de base64)
- [ ] Variáveis de modelo mais poderosas (placeholders dinâmicos)

Médio prazo:
- [ ] Sugestões de SEO geradas por IA a partir do conteúdo
- [ ] Histórico de conversas de IA por artigo
- [ ] Suporte offline melhorado

## Testes

```bash
npm test -- --watchAll=false   # Jest (serviços)
npm run build                  # Build de produção
```

Os testes cobrem o `BloggerService` e o `AIService` (definições, análise do
protocolo de ações, sanitização de HTML e transportes dos três fornecedores
com `fetch` simulado).
