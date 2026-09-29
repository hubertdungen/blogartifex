/**
 * Translations for English (en-US)
 */
const translations = {
    app: {
      name: 'BlogArtifex',
      slogan: 'Advanced Editor for Blogger',
      version: 'Version {version}'
    },
    
    auth: {
      login: 'Login',
      loginWithGoogle: 'Continue with Google',
      logout: 'Logout',
      loggingIn: 'Logging in...',
      confirmLogout: 'Are you sure you want to log out? Your local data will be preserved.',
      loginError: 'Authentication failed: {message}',
      checkConnection: 'Please check your connection and try again.',
      missingBloggerScope: "BlogArtifex was not given access to Blogger. Sign in again and, on Google's screen, tick the permission to manage your Blogger account.",
      chooseBloggerAccount: 'Choose the Google account that has access to your Blogger blogs.'
    },
    
    nav: {
      dashboard: 'Dashboard',
      editor: 'New Post',
      templates: 'Templates',
      settings: 'Settings'
    },
    
    dashboard: {
      welcome: 'Welcome to BlogArtifex!',
      welcomeSubtitle: 'Your advanced editor for Blogger.',
      quickActions: 'Quick Actions',
      createNew: 'Create New Post',
      manageTemplates: 'Manage Templates',
      yourBlogs: 'Your Blogs',
      loadingBlogs: 'Loading blogs...',
      noBlogs: 'No blogs found. Make sure you have access to blogs on Blogger.',
      selectBlog: 'Select Blog:',
      account: {
        label: 'Google account',
        activeTitle: 'Google account used by BlogArtifex',
        signedInAs: 'Signed in as'
      },
      emptyBlogs: {
        title: 'No blogs found',
        warning: 'No blogs were found. Try switching to the Google account you use with Blogger.',
        warningForAccount: 'No blogs were found for {email}. Try switching to the Google account you use with Blogger.',
        body: 'BlogArtifex can only show blogs where this Google account has author or admin permission. If your blogs appear in Blogger under another account, sign out here and choose that account.',
        switchAccount: 'Switch Google Account',
        retry: 'Try Again',
        openBlogger: 'Open Blogger'
      },
      stats: {
        publishedPosts: 'Published Posts',
        drafts: 'Drafts',
        scheduled: 'Scheduled',
        postsByMonth: 'Posts by Month'
      },
      messages: {
        loadBlogsError: 'Error loading blogs: {error}',
        loadPostsError: 'Error loading posts: {error}',
        duplicating: 'Loading post to duplicate...',
        duplicateError: 'Error duplicating post: {error}',
        deleting: 'Deleting post...',
        deleted: 'Post deleted.',
        deleteError: 'Error deleting post: {error}'
      },
      posts: {
        recentPosts: 'Recent Posts',
        noPosts: 'No posts found.',
        createFirst: 'Create First Post',
        status: {
          published: 'Published',
          draft: 'Draft',
          scheduled: 'Scheduled'
        },
        dates: {
          publishedOn: 'Published on: {date}',
          updatedOn: 'Updated on: {date}',
          scheduledFor: 'Scheduled for: {date}'
        },
        actions: {
          edit: 'Edit',
          duplicate: 'Duplicate',
          copyOf: 'Copy of {title}',
          delete: 'Delete',
          view: 'View',
          confirmDelete: 'Are you sure you want to delete this post? This action cannot be undone.'
        },
        controls: {
          sortBy: 'Sort by:',
          sortOptions: {
            date: 'Date',
            title: 'Title'
          },
          invertOrder: 'Invert order',
          filter: 'Filter:',
          status: {
            all: 'All',
            published: 'Published',
            draft: 'Draft',
            scheduled: 'Scheduled'
          },
          category: 'Category:',
          allTags: 'All tags'
        }
      }
    },
    
    editor: {
      title: 'Post Editor',
      placeholders: {
        content: 'Write here, or paste straight from Word…',
        title: 'Post title',
        tags: 'Example: technology, tutorial, tips'
      },
      labels: {
        blog: 'Blog:',
        title: 'Title:',
        tags: 'Tags (comma separated):',
        template: 'Template:',
        schedule: 'Schedule publication',
        draft: 'Save as draft',
        metadata: 'Edit Metadata'
      },
      buttons: {
        saveDraft: 'Save Draft',
        publish: 'Publish',
        schedule: 'Schedule',
        saveTemplate: 'Save as Template',
        showMetadata: 'Edit Metadata',
        hideMetadata: 'Hide Metadata',
        exportWord: 'Export as Word',
        importFile: 'Import File'
      },
      templates: {
        select: 'Select template',
        replaceConfirm: 'Applying the template replaces the current post content. Continue?',
        none: 'None',
        templateName: 'Template name:'
      },
      metadata: {
        title: 'Metadata',
        description: 'Description (SEO):',
        descriptionPlaceholder: 'Brief description of the post for search engines',
        author: 'Author:',
        authorPlaceholder: 'Author name',
        keywords: 'Keywords (SEO):',
        keywordsPlaceholder: 'Keywords separated by commas'
      },
      saving: {
        saving: 'Saving...',
        saved: 'Saved successfully!',
        error: 'Error saving: {message}',
        autoSave: 'Auto-saved at {time}',
        autoSaveError: 'The draft could not be saved locally.'
      },
      notifications: {
        draftSaved: 'Draft saved successfully!',
        published: 'Post published successfully!',
        scheduled: 'Post scheduled successfully!',
        error: 'An error occurred: {message}'
      },
      errors: {
        selectBlog: 'Please select a blog before saving the post.',
        enterTitle: 'Please enter a title for the post.',
        loadBlogs: 'Unable to load your blogs. Please check your connection and try again.',
        loadPost: 'Unable to load the post. Please check your connection and try again.',
        postTooLarge: "Blogger refused the post: it is {size} MB, almost all of it images embedded in the text. Remove or shrink some images, or insert them from a web address (Insert image → via URL).",
        importBinary: 'This file is in a binary format (old .doc). In Word, save it as .docx and import that file — or copy the text and paste it into the editor.'
      },
      draft: {
        restoreConfirm: 'An auto-saved draft from {time} was found. Do you want to restore it?'
      },
      link: {
        openInNewTab: 'Open in a new tab'
      },
      image: {
        fullWidth: 'Full text width',
        wrapText: 'Wrap text',
        breakText: 'Break text',
        original: 'Original size'
      },
      codeBlock: {
        plain: 'Plain text'
      },
      import: {
        converting: "Converting the document…",
        convert: {
          auth: "Your session has expired. Sign in again to import this file.",
          tooLarge: "The file is larger than 20 MB.",
          busy: "Another document is being converted. Try again in a few seconds.",
          unavailable: "This installation can't convert .doc/.rtf/.odt files (LibreOffice isn't available). In Word, save it as .docx and import that file.",
          failed: "Could not convert the document ({message}). In Word, save it as .docx and import that file."
        },
        docxDone: "Document imported. Tip: copying and pasting from Word also keeps fonts, colours and alignment.",
        localImages: "{count} image(s) from Word could not be pasted (Word for Mac, Word Online and Outlook don't share them). Insert them with the image button.",
        failed: 'Could not import the file: {message}'
      },
      stats: {
        words: '{count} words',
        characters: '{count} characters'
      }
    },

    ai: {
      toggle: 'AI Assistant',
      toggleTooltip: 'Open the AI writing assistant (GPT, Gemini or Claude)',
      chat: {
        title: 'AI Assistant',
        placeholder: 'Ask the AI to write, edit or illustrate your article...',
        send: 'Send',
        emptyState: 'Ask the AI to write a full article, rewrite sections, fix grammar, insert images, or anything else. Changes are applied directly in the editor and can be undone with Ctrl+Z.',
        changesApplied: 'Changes applied to the article',
        notConfigured: 'The AI assistant is not configured yet. Add your OpenAI (GPT), Google (Gemini) or Anthropic (Claude) API key in Settings to start using it.',
        openSettings: 'Open AI Settings',
        error: 'AI error: {message}'
      },
      quickActions: {
        improve: 'Improve writing',
        grammar: 'Fix grammar',
        continue: 'Continue writing',
        summarize: 'Add summary',
        titles: 'Suggest title',
        images: 'Suggest images'
      },
      quickPrompts: {
        improve: 'Improve the writing of the whole article: make it clearer and more engaging while keeping the meaning, structure, language and images.',
        grammar: 'Fix all grammar, spelling and punctuation mistakes in the article without changing its style, structure or language.',
        continue: 'Continue writing the article from where it ends, keeping the same tone, language and formatting. Add one or two new paragraphs.',
        summarize: 'Add a short introduction summary (2-3 sentences) at the top of the article, keeping its language.',
        titles: 'Suggest a better title for this article and set it. Mention a couple of alternatives in your reply.',
        images: 'Suggest where images would improve this article and insert placeholder images (https://placehold.co) with descriptive alt text and captions at those spots.'
      },
      selection: {
        label: 'AI actions for the selection',
        working: 'Rewriting selection...',
        applied: 'Selection updated by the AI.',
        askPlaceholder: 'Tell the AI what to do with the selection...'
      },
      selectionActions: {
        improve: 'Improve',
        grammar: 'Fix grammar',
        shorten: 'Shorten',
        expand: 'Expand',
        ask: 'Ask AI'
      },
      selectionPrompts: {
        improve: 'Improve this text: make it clearer and more engaging while keeping the meaning and language.',
        grammar: 'Fix grammar, spelling and punctuation without changing the style or language.',
        shorten: 'Make this text more concise while keeping all key information and the language.',
        expand: 'Expand this text with more detail and examples, keeping the tone and language.'
      },
      settings: {
        section: 'AI Assistant',
        enable: 'Enable AI assistant',
        enableDesc: 'Shows the AI assistant and selection tools in the post editor.',
        provider: 'AI Provider:',
        providerDesc: 'Choose which AI service to use with your own API key or subscription.',
        apiKey: 'API Key:',
        apiKeyDesc: 'Your personal API key for the selected provider.',
        getKey: 'Get an API key',
        showKey: 'Show',
        hideKey: 'Hide',
        model: 'Model:',
        modelDesc: 'Model used for chat and text editing.',
        defaultModel: 'Default ({model})',
        tone: 'Tone:',
        toneDesc: 'The writing style and tone the AI assistant should use.',
        toneOptions: {
          default: 'Default (Professional & Clear)',
          casual: 'Casual & Friendly',
          humorous: 'Humorous & Engaging',
          inspirational: 'Inspirational & Motivating',
          technical: 'Technical & Academic',
          custom: 'Custom...'
        },
        customTone: 'Custom Tone:',
        customToneDesc: 'Describe the exact tone you want (e.g. "Like a 1920s detective")',
        testConnection: 'Test Connection',
        testing: 'Testing...',
        testSuccess: 'Connection working!',
        securityNote: 'Your API key is stored only in this browser (localStorage) and sent directly to the AI provider. Requests may incur costs on your provider account. Do not use shared computers for storing keys.'
      }
    },

    templates: {
      title: 'Template Manager',
      createNew: 'Create New Template',
      exportAll: 'Export All',
      importTemplates: 'Import Templates',
      availableTemplates: 'Available Templates ({count})',
      noTemplates: 'No templates available.',
      createOrImport: 'Create a new template or import existing templates.',
      selectToEdit: 'Select a template to edit',
      orCreateNew: 'Or click "Create New Template" to start a new one.',
      newTemplate: 'New Template',
      editTemplate: 'Edit Template',
      templateName: 'Template Name:',
      templateDescription: 'Description (optional):',
      templateContent: 'Template Content:',
      placeholders: {
        name: 'Enter a name for the template',
        description: 'A brief description of the template'
      },
      actions: {
        save: 'Save Template',
        cancel: 'Cancel',
        use: 'Use',
        export: 'Export',
        delete: 'Delete',
        confirmDelete: 'Are you sure you want to delete this template? This action cannot be undone.',
        cancelConfirm: 'There are unsaved changes. Do you really want to cancel?'
      },
      tips: {
        title: 'Template Tips',
        items: [
          'Create templates for specific types of posts (reviews, tutorials, news, etc.)',
          'Include placeholders for content you regularly add',
          'Use consistent styles to maintain your blog\'s visual identity',
          'Export your favorite templates to share with other users'
        ]
      },
      notifications: {
        saved: 'Template saved successfully!',
        deleted: 'Template deleted successfully!',
        nameRequired: 'Please enter a name for the template.',
        contentRequired: 'The template content cannot be empty.',
        editorNotReady: 'Editor not initialized. Please try again.',
        noTemplatesExport: 'There are no templates to export.',
        loadError: 'Error loading templates. Data may be corrupted.'
      },
      importDialog: {
        importSuccess: 'Import completed! {count} templates imported.',
        importError: 'Error importing templates: {message}',
        replaceOrMerge: 'Import {count} templates. Do you want to replace all existing templates?',
        replaceConfirm: 'OK to replace or Cancel to merge with existing templates.',
        conflictDetected: '{count} templates have conflicting IDs.',
        conflictAction: 'Do you want to overwrite existing templates with the same ID?',
        conflictConfirm: 'OK to overwrite or Cancel to keep existing templates.',
        noValidTemplates: 'No valid templates found in the file.',
        invalidJson: 'Invalid JSON file.'
      }
    },
    
    settings: {
      title: 'Settings',
      sections: {
        general: 'General Preferences',
        autoSave: 'Auto-Save',
        security: 'Security',
          appearance: 'Appearance',
          api: 'API Settings',
          dataManagement: 'Data Management',
          debug: 'Debugging'
        },
        fields: {
        defaultBlog: 'Default Blog:',
        defaultBlogDesc: 'Blog selected by default when creating a new post.',
        defaultTemplate: 'Default Template:',
        defaultTemplateDesc: 'Template loaded automatically when creating a new post.',
        publishStatus: 'Default Publish Status:',
        publishStatusDesc: 'Default status when saving posts.',
        autoSaveInterval: 'Auto-Save Interval (minutes):',
        autoSaveIntervalDesc: 'Time interval for auto-saving drafts.',
        autoBackup: 'Auto-Backup Drafts',
        autoBackupDesc: 'Creates local backup copies of your drafts.',
        confirmDelete: 'Confirm before deleting',
        confirmDeleteDesc: 'Asks for confirmation before deleting posts or templates.',
        theme: 'Theme:',
        themeLight: 'Light',
        themeDark: 'Dark',
        themeDesc: 'Choose between light or dark theme for the interface.',
        wideLayout: 'Enable wide content area',
        wideLayoutDesc: 'Expands content width for more editing space.',
        alignment: 'Content alignment:',
        alignLeft: 'Left',
        alignCenter: 'Center',
        alignRight: 'Right',
        alignmentDesc: 'Choose how the content area is aligned relative to the sidebar.',
        language: 'Language:',
        languageDesc: 'Application interface language.',
        customClientId: 'Use custom Client ID',
        customClientIdDesc: 'Enable this option to use a custom Google Client ID instead of the default one.',
        clientId: 'Google Client ID:',
        clientIdDesc: 'Enter the Client ID obtained from Google Cloud Console.',
        showDebugger: 'Show Debugger Window',
        showDebuggerDesc: 'Display authentication debugger overlay.'
        },
      buttons: {
        save: 'Save Settings',
        reset: 'Restore Default Settings',
        clearData: 'Clear All Local Data',
        logout: 'Logout'
      },
      confirmations: {
        saveSuccess: 'Settings saved successfully!',
        resetConfirm: 'Are you sure you want to restore default settings? This action cannot be undone.',
        clearDataConfirm: 'WARNING: This will delete all your local data, including templates and settings. This action cannot be undone. Do you want to continue?',
        apiChanged: 'API settings have been changed. The application needs to restart to apply the changes. Do you want to restart now?'
      },
      apiInfo: {
        title: 'About API Settings',
        steps: [
          'Create a project in Google Cloud Console',
          'Enable the Blogger API',
          'Create OAuth 2.0 credentials for Web application',
          'Add {origin} as authorized JavaScript origin',
          'Add {origin} as redirect URI'
        ],
        important: 'Important: Changes to this configuration will require you to log in again.'
      }
    },
    
    common: {
      unexpectedError: 'Something went wrong.',
      loading: 'Loading...',
      error: 'Error: {message}',
      success: 'Success!',
      confirmDelete: 'Are you sure you want to delete this?',
      yes: 'Yes',
      no: 'No',
      ok: 'OK',
      cancel: 'Cancel',
      save: 'Save',
      delete: 'Delete',
      edit: 'Edit',
      create: 'Create',
      search: 'Search...',
      filter: 'Filter',
      noResults: 'No results found',
      learnMore: 'Learn more',
      selectOption: 'Select...',
      today: 'Today',
      yesterday: 'Yesterday',
      tomorrow: 'Tomorrow',
      timeFormat: 'h:mm A',
      dateFormat: 'MM/DD/YYYY'
    }
  };
  
  export default translations;
