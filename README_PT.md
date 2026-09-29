<div align="center"><img src="public/logo.svg" alt="BlogArtifex Logo" width="128"><h1>BlogArtifex - Editor Avançado para o Blogger</h1></div>

O BlogArtifex é uma aplicação web moderna concebida para substituir ferramentas descontinuadas como o Open Live Writer, oferecendo uma solução abrangente para edição e publicação no Blogger com uma interface avançada e recursos poderosos.

Estado: Beta/Preview - release portátil funcional. Fluxos principais (login com Google, listar blogs e posts, criar/atualizar/publicar, templates e definições) já implementados.

<p align="center">
  
</p>

<p align="center">
  
  
</p>

## Apoiar o BlogArtifex

Se o BlogArtifex lhe poupar tempo, pode apoiar o desenvolvimento através do botão
PayPal abaixo.

<p>
  <a href="https://www.paypal.com/donate/?hosted_button_id=X8QF6PQEHLF6G" target="_blank" rel="noopener noreferrer">
    <img src="https://pics.paypal.com/00/s/ZGRjOTIyYjAtOTAwMi00MTYwLTg5N2QtMDM3NzQzNDA2ZGE2/file.PNG" alt="Botão Doar com PayPal" height="48">
  </a>
</p>

## 🚀 Início Rápido

### Release portátil descarregada

Para utilizadores Windows, o caminho mais simples é o executável portátil sem
instalação:

1. Descarregar o `.exe` portátil na
   [página de Releases do GitHub](https://github.com/hubertdungen/blogartifex/releases).
2. Executar o ficheiro.
3. O BlogArtifex abre um separador do navegador automaticamente. Se a porta
   `3000` estiver ocupada, tenta a próxima porta local disponível.
4. Iniciar sessão com a conta Google que possui ou pode editar os seus blogues
   do Blogger.

Utilizadores normais não precisam de criar um projeto na Google Cloud, ativar
APIs nem editar ficheiros `.env`. Só precisam de aprovar o acesso ao Blogger no
início de sessão Google. O Google Authenticator não é um requisito do BlogArtifex;
o Google pode pedir a autenticação de dois fatores normal se a conta a tiver
ativa.

### Pré-requisitos para código-fonte/desenvolvimento

- Node.js 18.x ou superior (recomendado)
- npm (v9+) ou Yarn (v1.22+)
- Conta Google com acesso ao Blogger

### Executar a partir do código-fonte

1. Clonar o repositório
   ```bash
   git clone https://github.com/hubertdungen/blogartifex.git
   cd blogartifex
   ```

2. Instalar dependências
   ```bash
   npm install
   # ou
   yarn install
   ```

3. Configuração local opcional
   - Copie `.env.example` para `.env` apenas se quiser substituir valores
     predefinidos.
   - `REACT_APP_GOOGLE_CLIENT_ID` é opcional para uso local normal, porque o
     BlogArtifex inclui um ID de cliente OAuth predefinido.

4. Executar a aplicação
   ```bash
   # No macOS/Linux
   ./run.sh

   # No Windows
   run.bat

   # Ou iniciar manualmente
   npm start
   ```

5. Aceder à aplicação em `http://localhost:3000`

## ✨ Novidades

- **Editor pensado para o Word** (CKEditor 48, só funcionalidades
  open-source): cole diretamente do Word e mantenha tipos de letra,
  tamanhos, cores, alinhamento, listas, tabelas e imagens; importe ficheiros
  `.docx`; posicione imagens com texto à volta, redimensione-as e ponha
  legendas; propriedades de tabelas e células. O que compõe no editor é o que
  o Blogger mostra — os estilos de layout vão inline ao publicar.
- **Renomeado para BlogArtifex** com um novo logótipo vetorial coerente (uma
  ponta de caneta roxo→ciano que se dissolve em píxeis), usado de forma
  consistente no ícone da app, favicon e ícones Android.
- **Assistente de IA**: ligue a sua própria chave de API da OpenAI (GPT),
  Google (Gemini) ou Anthropic (Claude) e deixe a IA escrever, editar,
  formatar e ilustrar artigos diretamente no editor — via chat, botões de
  ações rápidas ou um menu flutuante sobre o texto selecionado. Escolha um tom
  de escrita nas Definições; o assistente também pode reutilizar os seus
  modelos guardados.
- **Formatação de imagens**: selecione uma imagem para a posicionar (texto à
  volta à esquerda/direita, lateral, centrada, em linha), redimensioná-la
  pelas pegas dos cantos ou para 25–100% e pôr-lhe legenda; a IA também pode
  controlar tamanho/posição.
- Corrigido um bug crítico de migração de armazenamento que terminava a sessão
  e apagava os dados locais em cada carregamento; rebrand concluído em toda a app.
- Correções na edição de texto: upload de imagens funcional (incorporadas em
  base64), tamanho/posição das imagens preservados durante a edição, toolbar
  limpa, contagem de palavras/caracteres, restauro de rascunhos auto-guardados
  e aplicação do blogue/modelo padrão das Definições.
- Login Google via `@react-oauth/google` com escopo do Blogger
- Melhorias no manuseio de token em `AuthService` e `TokenManager` (verificações de sessão, armazenamento mais seguro)
- `BloggerService` com cache, timeouts e mensagens de erro mais claras (401/403/429)
- Dashboard: seleção de blog, posts recentes e estatísticas mensais básicas
- Editor (CKEditor 5): rascunho/publicar, agendamento, etiquetas, injeção de metadados, importação (TXT/HTML) e exportação para Word
- Gestor de Templates: criar, editar, apagar e reutilizar templates de conteúdo
- Definições: tema (escuro/claro), predefinições, opções de autosave/backup, configuração do fornecedor de IA
- Fundações de i18n (`en-US`, `pt-PT`) e melhorias de estilo

## 🤖 Assistente de IA (GPT / Gemini / Claude)

O BlogArtifex pode ligar-se a um fornecedor de IA à sua escolha usando a sua
própria chave de API ou subscrição. Tudo corre no seu navegador: a chave é
guardada apenas no `localStorage` e os pedidos vão diretamente do navegador
para o fornecedor.

### Configuração

1. Abra **Definições → Assistente de IA**.
2. Ative o assistente e escolha um fornecedor:
   - **OpenAI (GPT)** — chave em <https://platform.openai.com/api-keys>
   - **Google (Gemini)** — chave em <https://aistudio.google.com/app/apikey>
   - **Anthropic (Claude)** — chave em <https://console.anthropic.com/settings/keys>
3. Cole a sua chave de API, escolha opcionalmente um modelo e prima
   **Testar Ligação**.
4. Guarde as definições.

### Utilização no editor

- Clique em **✨ Assistente IA** no cabeçalho do Editor de Artigos para abrir
  o painel de chat. Peça à IA para escrever um artigo completo, reestruturar
  secções, corrigir o tom, adicionar um resumo, sugerir um título ou inserir
  imagens — as alterações são aplicadas diretamente na caixa de texto e podem
  ser desfeitas com `Ctrl+Z`.
- Os botões de ações rápidas (Melhorar escrita, Corrigir gramática, Continuar
  a escrever, Adicionar resumo, Sugerir título, Sugerir imagens) executam
  pedidos comuns com um clique.
- **Selecione qualquer texto** no editor para obter um menu flutuante de IA
  com *Melhorar*, *Corrigir*, *Encurtar*, *Expandir* e *Pedir à IA* (instrução
  livre). O fragmento selecionado é reescrito no próprio local.
- A IA pode inserir imagens e alterar a sua posição (esquerda/centro/direita/
  lateral) e tamanho; também pode ajustar imagens manualmente com a toolbar
  de imagem.

### Notas sobre privacidade e custos

- A sua chave de API nunca sai da sua máquina exceto para chamar o fornecedor
  que escolheu.
- Os pedidos de IA são faturados na sua conta do fornecedor segundo os preços
  deste.
- Evite guardar chaves de API em computadores partilhados.

## 🔑 Guia de Autenticação

### Início de sessão normal

O BlogArtifex usa OAuth da Google para pedir permissão de acesso ao Blogger.
Durante o login, escolha a mesma conta Google que aparece no Blogger. Se o
BlogArtifex disser "Nenhum blogue encontrado", use **Trocar Conta Google** e
escolha a conta que possui ou tem permissão de autor/admin nos blogues.

A API do Blogger só devolve blogues onde a conta autenticada tem autoria ou
permissões de administrador. Se um blogue aparecer no Blogger noutra conta
Google, ele não aparece no BlogArtifex até essa conta ser escolhida.

### Configuração de cliente OAuth próprio

A maioria dos utilizadores não precisa desta secção. Use-a apenas para manter
uma release pública, correr um fork ou substituir o ID de cliente OAuth incluído.

1. **Criar Projeto na Google Cloud**
   - Visitar [Google Cloud Console](https://console.cloud.google.com/)
   - Criar um novo projeto ou selecionar um existente

2. **Ativar APIs**
   - Navegar para "APIs e Serviços"
   - Ativar "API do Blogger"

3. **Criar Credenciais OAuth**
   - Ir para "Credenciais"
   - Clicar em "Criar Credenciais" > "ID de cliente OAuth"
   - Selecionar "Aplicação web"
   - Adicionar origens e URIs de redirecionamento autorizados
     * Para desenvolvimento local: `http://localhost:3000`
     * Para produção: O seu domínio atual

4. **Configurar Ecrã de Consentimento**
   - Configurar ecrã de consentimento OAuth
   - Adicionar âmbitos necessários:
      * `.../auth/blogger` (API do Blogger)
      * `email`
      * `perfil`

5. **Considerações de Segurança**
   - IDs de cliente OAuth são identificadores públicos, mas segredos de cliente
     nunca devem ser usados na app de navegador nem enviados para o controlo de
     versão
   - Manter o ecrã de consentimento OAuth publicado/configurado para os
     utilizadores pretendidos
   - Se a app OAuth ficar em modo de teste, apenas utilizadores de teste
     configurados conseguem iniciar sessão

### Resolução de Problemas
- Verificar a conta Google mostrada no topo do dashboard do BlogArtifex
- Usar **Trocar Conta Google** se o Blogger mostrar os blogues noutra conta
- Garantir que a conta Google tem acesso de autor/admin no Blogger
- Verificar se o ID de Cliente e âmbitos correspondem à aplicação
- Verificar conectividade de rede
- Garantir que o navegador suporta fluxos OAuth modernos
- Se receber 401/403, termine sessão e inicie sessão novamente
- Build: `react-scripts` 5 (webpack 5); Node 18 ou mais recente, sem opções extra

## 🧪 Build & Testes

```bash
npm run build
npm test -- --watchAll=false
npm run serve
```

O build de produção será criado em `build/`. Pode abrir `build/index.html`
diretamente para verificar a interface, mas o login Google OAuth deve ser usado
através de `http://localhost:3000`, porque o Google não aceita origens `file://`.
Para testar o build completo localmente, execute `npm run serve`.

## 📦 Releases Portáteis

No Windows, pode criar um executável portátil sem instalação:

```bat
build-release.bat
```

ou:

```bash
npm run release
```

O ficheiro Windows fica em `dist/blogartifex-x.y.z-windows-x64.exe`.

No macOS e Linux, pode criar um binário portátil para o sistema atual:

```bash
./build-release.sh
# ou
npm run release:current
```

Outros alvos disponíveis:

```bash
npm run release:win
npm run release:linux
npm run release:macos
npm run release:all
```

O binário de release inicia o servidor local do BlogArtifex e abre o navegador
automaticamente. Se a porta `3000` estiver ocupada, o BlogArtifex tenta a próxima
porta local disponível. Os binários Windows incluem o ícone do BlogArtifex. O
primeiro build de release pode descarregar binários de runtime Node usados pelo
`pkg`. Os binários macOS não são assinados, por isso utilizadores Apple podem
ter de autorizar a aplicação nas definições de segurança do macOS ou executá-la
pelo Terminal.

Maintainers podem publicar uma release ao enviar uma tag de versão como
`v1.0.0`. O workflow de release do GitHub Actions cria e anexa binários
portáteis para Windows, Linux e macOS. Os binários macOS devem ser criados em
macOS para poderem receber assinatura ad-hoc; builds locais em Windows ignoram
os alvos macOS.

## 📱 App Android (preview experimental)

Cada release inclui também `blogartifex-x.y.z-android.apk`, uma app Android
nativa que embrulha a interface do BlogArtifex (construída com Capacitor).

- Descarregue o APK da
  [página de Releases](https://github.com/hubertdungen/blogartifex/releases) e
  permita "instalar de fontes desconhecidas" quando o Android pedir.
- O APK é auto-assinado para distribuição direta (não está na Play Store).
  Por omissão cada release é assinado com uma chave nova, pelo que o Android
  pode exigir desinstalar a versão anterior antes de atualizar. Os
  maintainers podem definir os secrets `ANDROID_KEYSTORE_BASE64`
  (+ password/alias) no repositório para assinar todos os releases com uma
  chave estável.
- **Limitação conhecida**: a Google bloqueia o seu início de sessão OAuth
  dentro de WebViews embebidas em alguns dispositivos. A app aplica uma
  medida de compatibilidade, mas se o login falhar com um erro
  *"disallowed_useragent"* ou semelhante, a versão Android ainda não é
  utilizável nesse dispositivo — um fluxo de login nativo está no roadmap.
  As versões portáteis para desktop são a opção estável.

Para compilar o APK localmente:

```bash
npm run build
npx cap sync android
cd android && ./gradlew assembleRelease
```

O resultado é criado em `android/app/build/outputs/apk/release/`.

## 📚 Mais Ajuda
- [Documentação da API do Blogger](https://developers.google.com/blogger/docs/3.0/getting_started)
- [Guia OAuth do Google](https://developers.google.com/identity/protocols/oauth2)

## 💻 Dicas de Desenvolvimento
- Usar navegação anónima/privada para testar fluxos de início de sessão
- Limpar cache do navegador se ocorrerem problemas de autenticação
- Verificar mensagens de erro na consola do navegador

## 🛡️ Permissões
O BlogArtifex requer permissões mínimas para:
- Ler os seus blogues do Blogger
- Criar, editar e gerir artigos de blogue
- Aceder a informações básicas de perfil

## 🗺️ Roadmap (curto prazo)
- Fluxo de login Google nativo para a app Android
- **Personalidades de IA** — personas reutilizáveis (nome + instruções de
  sistema/tom) que podem ser activadas no assistente de IA, alimentadas por
  caixas de texto livres e por documentos anexados usados como base de
  conhecimento
- Streaming das respostas de IA no painel de chat
- Upload de imagens para um serviço de alojamento (em vez de base64)
- Variáveis/snippets de template mais poderosos
- Sugestões de SEO geradas por IA
- Experiência offline/autosalvamento melhorada

---

Desenvolvido com ❤️ para a comunidade de bloguistas
