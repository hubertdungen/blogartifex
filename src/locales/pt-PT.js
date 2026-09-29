/**
 * Traduções para Português de Portugal (pt-PT)
 */
const translations = {
    app: {
      name: 'BlogArtifex',
      slogan: 'Editor Avançado para Blogger',
      version: 'Versão {version}'
    },
    
    auth: {
      login: 'Iniciar Sessão',
      loginWithGoogle: 'Iniciar Sessão com Google',
      logout: 'Terminar Sessão',
      loggingIn: 'A iniciar sessão...',
      confirmLogout: 'Tem a certeza que deseja terminar a sessão? Os seus dados locais serão mantidos.',
      loginError: 'Falha na autenticação: {message}',
      checkConnection: 'Verifique a sua ligação e tente novamente.',
      missingBloggerScope: "O BlogArtifex não recebeu acesso ao Blogger. Inicie sessão de novo e, no ecrã da Google, marque a permissão para gerir a sua conta do Blogger.",
      chooseBloggerAccount: 'Escolha a conta Google que tem acesso aos seus blogues do Blogger.'
    },
    
    nav: {
      dashboard: 'Painel',
      editor: 'Novo Artigo',
      templates: 'Modelos',
      settings: 'Definições'
    },
    
    dashboard: {
      welcome: 'Bem-vindo ao BlogArtifex!',
      welcomeSubtitle: 'O seu editor avançado para o Blogger.',
      quickActions: 'Ações Rápidas',
      createNew: 'Criar Novo Artigo',
      manageTemplates: 'Gerir Modelos',
      yourBlogs: 'Os Seus Blogues',
      loadingBlogs: 'A carregar blogues...',
      noBlogs: 'Nenhum blogue encontrado. Verifique se tem acesso a blogues no Blogger.',
      selectBlog: 'Selecionar Blogue:',
      account: {
        label: 'Conta Google',
        activeTitle: 'Conta Google usada pelo BlogArtifex',
        signedInAs: 'Sessão iniciada como'
      },
      emptyBlogs: {
        title: 'Nenhum blogue encontrado',
        warning: 'Nenhum blogue encontrado. Experimente trocar para a conta Google que usa no Blogger.',
        warningForAccount: 'Nenhum blogue encontrado para {email}. Experimente trocar para a conta Google que usa no Blogger.',
        body: 'O BlogArtifex só consegue mostrar blogues onde esta conta Google tem permissões de autor ou administrador. Se os seus blogues aparecem no Blogger com outra conta, termine sessão aqui e escolha essa conta.',
        switchAccount: 'Trocar Conta Google',
        retry: 'Tentar Novamente',
        openBlogger: 'Abrir Blogger'
      },
      stats: {
        publishedPosts: 'Artigos Publicados',
        drafts: 'Rascunhos',
        scheduled: 'Agendados',
        postsByMonth: 'Publicações por Mês'
      },
      messages: {
        loadBlogsError: 'Erro ao carregar os blogues: {error}',
        loadPostsError: 'Erro ao carregar os artigos: {error}',
        duplicating: 'A carregar o artigo para duplicar...',
        duplicateError: 'Erro ao duplicar o artigo: {error}',
        deleting: 'A eliminar o artigo...',
        deleted: 'Artigo eliminado.',
        deleteError: 'Erro ao eliminar o artigo: {error}'
      },
      posts: {
        recentPosts: 'Artigos Recentes',
        noPosts: 'Nenhum artigo encontrado.',
        createFirst: 'Criar Primeiro Artigo',
        status: {
          published: 'Publicado',
          draft: 'Rascunho',
          scheduled: 'Agendado'
        },
        dates: {
          publishedOn: 'Publicado em: {date}',
          updatedOn: 'Atualizado em: {date}',
          scheduledFor: 'Agendado para: {date}'
        },
        actions: {
          edit: 'Editar',
          duplicate: 'Duplicar',
          copyOf: 'Cópia de {title}',
          delete: 'Eliminar',
          view: 'Ver',
          confirmDelete: 'Tem a certeza que deseja eliminar este artigo? Esta ação não pode ser desfeita.'
        },
        controls: {
          sortBy: 'Ordenar por:',
          sortOptions: {
            date: 'Data',
            title: 'Título'
          },
          invertOrder: 'Inverter ordem',
          filter: 'Filtrar:',
          status: {
            all: 'Todos',
            published: 'Publicado',
            draft: 'Rascunho',
            scheduled: 'Agendado'
          },
          category: 'Categoria:',
          allTags: 'Todas as etiquetas'
        }
      }
    },
    
    editor: {
      title: 'Editor de Artigo',
      placeholders: {
        content: 'Escreva aqui, ou cole diretamente do Word…',
        title: 'Título do artigo',
        tags: 'Exemplo: tecnologia, tutorial, dicas'
      },
      labels: {
        blog: 'Blogue:',
        title: 'Título:',
        tags: 'Etiquetas (separadas por vírgula):',
        template: 'Modelo:',
        schedule: 'Agendar publicação',
        draft: 'Guardar como rascunho',
        metadata: 'Editar Metadados'
      },
      buttons: {
        saveDraft: 'Guardar Rascunho',
        publish: 'Publicar',
        schedule: 'Agendar',
        saveTemplate: 'Guardar como Modelo',
        showMetadata: 'Editar Metadados',
        hideMetadata: 'Ocultar Metadados',
        exportWord: 'Exportar como Word',
        importFile: 'Importar Ficheiro'
      },
      templates: {
        select: 'Selecionar modelo',
        replaceConfirm: 'Aplicar o modelo substitui o conteúdo atual do artigo. Continuar?',
        none: 'Nenhum',
        templateName: 'Nome do modelo:'
      },
      metadata: {
        title: 'Metadados',
        description: 'Descrição (SEO):',
        descriptionPlaceholder: 'Breve descrição do artigo para motores de busca',
        author: 'Autor:',
        authorPlaceholder: 'Nome do autor',
        keywords: 'Palavras-chave (SEO):',
        keywordsPlaceholder: 'Palavras-chave separadas por vírgula'
      },
      saving: {
        saving: 'A guardar...',
        saved: 'Guardado com sucesso!',
        error: 'Erro ao guardar: {message}',
        autoSave: 'Guardado automaticamente às {time}',
        autoSaveError: 'Não foi possível guardar o rascunho localmente.'
      },
      notifications: {
        draftSaved: 'Rascunho guardado com sucesso!',
        published: 'Artigo publicado com sucesso!',
        scheduled: 'Artigo agendado com sucesso!',
        error: 'Ocorreu um erro: {message}'
      },
      errors: {
        selectBlog: 'Por favor, selecione um blogue antes de guardar o artigo.',
        enterTitle: 'Por favor, insira um título para o artigo.',
        loadBlogs: 'Não foi possível carregar os seus blogues. Por favor, verifique a sua ligação e tente novamente.',
        loadPost: 'Não foi possível carregar o artigo. Por favor, verifique a sua ligação e tente novamente.',
        importBinary: 'Este ficheiro está num formato binário (.doc antigo). No Word, guarde-o como .docx e importe esse ficheiro — ou copie o texto e cole-o no editor.'
      },
      draft: {
        restoreConfirm: 'Foi encontrado um rascunho guardado automaticamente em {time}. Deseja restaurá-lo?'
      },
      link: {
        openInNewTab: 'Abrir num novo separador'
      },
      image: {
        fullWidth: 'Largura do texto',
        wrapText: 'Moldar texto',
        breakText: 'Quebrar texto',
        original: 'Tamanho original'
      },
      codeBlock: {
        plain: 'Texto simples'
      },
      import: {
        docxDone: 'Documento Word importado. Dica: copiar e colar a partir do Word também mantém tipos de letra, cores e alinhamento.',
        localImages: "Não foi possível colar {count} imagem(ns) do Word (o Word para Mac, o Word Online e o Outlook não as partilham). Insira-as com o botão de imagem.",
        failed: 'Não foi possível importar o ficheiro: {message}'
      },
      stats: {
        words: '{count} palavras',
        characters: '{count} caracteres'
      }
    },

    ai: {
      toggle: 'Assistente IA',
      toggleTooltip: 'Abrir o assistente de escrita com IA (GPT, Gemini ou Claude)',
      chat: {
        title: 'Assistente IA',
        placeholder: 'Peça à IA para escrever, editar ou ilustrar o artigo...',
        send: 'Enviar',
        emptyState: 'Peça à IA para escrever um artigo completo, reescrever secções, corrigir a gramática, inserir imagens, ou qualquer outra coisa. As alterações são aplicadas diretamente no editor e podem ser desfeitas com Ctrl+Z.',
        changesApplied: 'Alterações aplicadas ao artigo',
        notConfigured: 'O assistente de IA ainda não está configurado. Adicione a sua chave de API da OpenAI (GPT), Google (Gemini) ou Anthropic (Claude) nas Definições para começar a usá-lo.',
        openSettings: 'Abrir Definições de IA',
        error: 'Erro de IA: {message}'
      },
      quickActions: {
        improve: 'Melhorar escrita',
        grammar: 'Corrigir gramática',
        continue: 'Continuar a escrever',
        summarize: 'Adicionar resumo',
        titles: 'Sugerir título',
        images: 'Sugerir imagens'
      },
      quickPrompts: {
        improve: 'Melhora a escrita de todo o artigo: torna-o mais claro e cativante mantendo o significado, a estrutura, o idioma e as imagens.',
        grammar: 'Corrige todos os erros de gramática, ortografia e pontuação do artigo sem alterar o estilo, a estrutura ou o idioma.',
        continue: 'Continua a escrever o artigo a partir do ponto onde termina, mantendo o mesmo tom, idioma e formatação. Adiciona um ou dois parágrafos novos.',
        summarize: 'Adiciona um pequeno resumo introdutório (2-3 frases) no início do artigo, mantendo o idioma.',
        titles: 'Sugere um título melhor para este artigo e aplica-o. Menciona algumas alternativas na tua resposta.',
        images: 'Sugere onde imagens melhorariam este artigo e insere imagens de exemplo (https://placehold.co) com texto alternativo descritivo e legendas nesses locais.'
      },
      selection: {
        label: 'Ações de IA para a seleção',
        working: 'A reescrever a seleção...',
        applied: 'Seleção atualizada pela IA.',
        askPlaceholder: 'Diga à IA o que fazer com a seleção...'
      },
      selectionActions: {
        improve: 'Melhorar',
        grammar: 'Corrigir',
        shorten: 'Encurtar',
        expand: 'Expandir',
        ask: 'Pedir à IA'
      },
      selectionPrompts: {
        improve: 'Melhora este texto: torna-o mais claro e cativante mantendo o significado e o idioma.',
        grammar: 'Corrige a gramática, ortografia e pontuação sem alterar o estilo ou o idioma.',
        shorten: 'Torna este texto mais conciso mantendo toda a informação essencial e o idioma.',
        expand: 'Expande este texto com mais detalhe e exemplos, mantendo o tom e o idioma.'
      },
      settings: {
        section: 'Assistente de IA',
        enable: 'Ativar assistente de IA',
        enableDesc: 'Mostra o assistente de IA e as ferramentas de seleção no editor de artigos.',
        provider: 'Fornecedor de IA:',
        providerDesc: 'Escolha o serviço de IA a usar com a sua própria chave de API ou subscrição.',
        apiKey: 'Chave de API:',
        apiKeyDesc: 'A sua chave de API pessoal para o fornecedor selecionado.',
        getKey: 'Obter uma chave de API',
        showKey: 'Mostrar',
        hideKey: 'Ocultar',
        model: 'Modelo:',
        modelDesc: 'Modelo usado para o chat e edição de texto.',
        defaultModel: 'Predefinido ({model})',
        tone: 'Tom:',
        toneDesc: 'O estilo de escrita e o tom que o assistente IA deve utilizar.',
        toneOptions: {
          default: 'Predefinido (Profissional e Claro)',
          casual: 'Casual e Amigável',
          humorous: 'Bem-humorado e Cativante',
          inspirational: 'Inspirador e Motivador',
          technical: 'Técnico e Académico',
          custom: 'Personalizado...'
        },
        customTone: 'Tom Personalizado:',
        customToneDesc: 'Descreva o tom exato que pretende (ex: "Como um detetive dos anos 20")',
        testConnection: 'Testar Ligação',
        testing: 'A testar...',
        testSuccess: 'Ligação a funcionar!',
        securityNote: 'A sua chave de API é guardada apenas neste navegador (localStorage) e enviada diretamente para o fornecedor de IA. Os pedidos podem gerar custos na sua conta do fornecedor. Evite guardar chaves em computadores partilhados.'
      }
    },

    templates: {
      title: 'Gestor de Modelos',
      createNew: 'Criar Novo Modelo',
      exportAll: 'Exportar Todos',
      importTemplates: 'Importar Modelos',
      availableTemplates: 'Modelos Disponíveis ({count})',
      noTemplates: 'Nenhum modelo disponível.',
      createOrImport: 'Crie um novo modelo ou importe modelos existentes.',
      selectToEdit: 'Selecione um modelo para editar',
      orCreateNew: 'Ou clique em "Criar Novo Modelo" para começar um novo.',
      newTemplate: 'Novo Modelo',
      editTemplate: 'Editar Modelo',
      templateName: 'Nome do Modelo:',
      templateDescription: 'Descrição (opcional):',
      templateContent: 'Conteúdo do Modelo:',
      placeholders: {
        name: 'Introduza um nome para o modelo',
        description: 'Uma breve descrição do modelo'
      },
      actions: {
        save: 'Guardar Modelo',
        cancel: 'Cancelar',
        use: 'Usar',
        export: 'Exportar',
        delete: 'Eliminar',
        confirmDelete: 'Tem a certeza que deseja eliminar este modelo? Esta ação não pode ser desfeita.',
        cancelConfirm: 'Há alterações não guardadas. Deseja realmente cancelar?'
      },
      tips: {
        title: 'Dicas para Modelos',
        items: [
          'Crie modelos para tipos específicos de artigos (análises, tutoriais, notícias, etc.)',
          'Inclua espaços reservados para o conteúdo que normalmente adiciona',
          'Use estilos consistentes para manter a identidade visual do seu blogue',
          'Exporte os seus modelos favoritos para partilhar com outros utilizadores'
        ]
      },
      notifications: {
        saved: 'Modelo guardado com sucesso!',
        deleted: 'Modelo eliminado com sucesso!',
        nameRequired: 'Por favor, indique um nome para o modelo.',
        contentRequired: 'O conteúdo do modelo não pode estar vazio.',
        editorNotReady: 'Editor não inicializado. Por favor, tente novamente.',
        noTemplatesExport: 'Não há modelos para exportar.',
        loadError: 'Erro ao carregar modelos. Os dados podem estar corrompidos.'
      },
      importDialog: {
        importSuccess: 'Importação concluída! {count} modelos importados.',
        importError: 'Erro ao importar modelos: {message}',
        replaceOrMerge: 'Importar {count} modelos. Deseja substituir todos os modelos existentes?',
        replaceConfirm: 'OK para substituir ou Cancelar para juntar aos modelos existentes.',
        conflictDetected: '{count} modelos têm IDs em conflito.',
        conflictAction: 'Deseja substituir os modelos existentes com o mesmo ID?',
        conflictConfirm: 'OK para substituir ou Cancelar para manter os modelos existentes.',
        noValidTemplates: 'Nenhum modelo válido encontrado no ficheiro.',
        invalidJson: 'Ficheiro JSON inválido.'
      }
    },
    
    settings: {
      title: 'Definições',
      sections: {
        general: 'Preferências Gerais',
        autoSave: 'Gravação Automática',
        security: 'Segurança',
          appearance: 'Aparência',
          api: 'Definições da API',
          dataManagement: 'Gestão de Dados',
          debug: 'Depuração'
        },
        fields: {
        defaultBlog: 'Blogue Predefinido:',
        defaultBlogDesc: 'Blogue selecionado por predefinição ao criar um novo artigo.',
        defaultTemplate: 'Modelo Predefinido:',
        defaultTemplateDesc: 'Modelo carregado automaticamente ao criar um novo artigo.',
        publishStatus: 'Estado de Publicação Predefinido:',
        publishStatusDesc: 'Estado predefinido ao guardar artigos.',
        autoSaveInterval: 'Intervalo de Gravação Automática (minutos):',
        autoSaveIntervalDesc: 'Intervalo de tempo para gravação automática de rascunhos.',
        autoBackup: 'Cópia de Segurança Automática de Rascunhos',
        autoBackupDesc: 'Cria cópias locais de segurança dos seus rascunhos.',
        confirmDelete: 'Confirmar antes de eliminar',
        confirmDeleteDesc: 'Solicita confirmação antes de eliminar artigos ou modelos.',
        theme: 'Tema:',
        themeLight: 'Claro',
        themeDark: 'Escuro',
        themeDesc: 'Escolha entre tema claro ou escuro para a interface.',
        wideLayout: 'Área de conteúdo ampla',
        wideLayoutDesc: 'Expande a largura do conteúdo para mais espaço de edição.',
        alignment: 'Alinhamento do conteúdo:',
        alignLeft: 'Esquerda',
        alignCenter: 'Centro',
        alignRight: 'Direita',
        alignmentDesc: 'Define como a área de conteúdo é alinhada em relação à barra lateral.',
        language: 'Idioma:',
        languageDesc: 'Idioma da interface da aplicação.',
        customClientId: 'Usar ID de Cliente personalizado',
        customClientIdDesc: 'Ative esta opção para usar um ID de Cliente do Google personalizado em vez do predefinido.',
        clientId: 'ID de Cliente do Google:',
        clientIdDesc: 'Insira o ID de Cliente obtido na Google Cloud Console.',
        showDebugger: 'Mostrar janela de depuração',
        showDebuggerDesc: 'Mostra a janela de depuração de autenticação.'
        },
      buttons: {
        save: 'Guardar Definições',
        reset: 'Restaurar Definições Predefinidas',
        clearData: 'Limpar Todos os Dados Locais',
        logout: 'Terminar Sessão'
      },
      confirmations: {
        saveSuccess: 'Definições guardadas com sucesso!',
        resetConfirm: 'Tem a certeza que deseja restaurar as definições predefinidas? Esta ação não pode ser desfeita.',
        clearDataConfirm: 'ATENÇÃO: Isto apagará todos os seus dados locais, incluindo modelos e definições. Esta ação não pode ser desfeita. Deseja continuar?',
        apiChanged: 'As definições da API foram alteradas. A aplicação precisa de ser reiniciada para aplicar as alterações. Deseja reiniciar agora?'
      },
      apiInfo: {
        title: 'Sobre as Definições da API',
        steps: [
          'Criar um projeto na Google Cloud Console',
          'Ativar a API do Blogger',
          'Criar credenciais OAuth 2.0 para aplicação Web',
          'Adicionar {origin} como origem JavaScript autorizada',
          'Adicionar {origin} como URI de redirecionamento'
        ],
        important: 'Importante: Alterações nesta definição exigirão que inicie sessão novamente.'
      }
    },
    
    common: {
      unexpectedError: 'Ocorreu um erro.',
      loading: 'A carregar...',
      error: 'Erro: {message}',
      success: 'Sucesso!',
      confirmDelete: 'Tem a certeza que deseja eliminar isto?',
      yes: 'Sim',
      no: 'Não',
      ok: 'OK',
      cancel: 'Cancelar',
      save: 'Guardar',
      delete: 'Eliminar',
      edit: 'Editar',
      create: 'Criar',
      search: 'Pesquisar...',
      filter: 'Filtrar',
      noResults: 'Nenhum resultado encontrado',
      learnMore: 'Saiba mais',
      selectOption: 'Selecionar...',
      today: 'Hoje',
      yesterday: 'Ontem',
      tomorrow: 'Amanhã',
      timeFormat: 'HH:mm',
      dateFormat: 'DD/MM/YYYY'
    }
  };
  
  export default translations;
