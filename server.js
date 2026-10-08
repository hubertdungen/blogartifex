const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { handleConvert } = require('./docConverter');
const { handleVoice } = require('./voiceService');
const { handleAuth } = require('./authService');
const { handleUpload, serveMedia } = require('./mediaStore');

const DEFAULT_PORT = 3000;
const MAX_PORT_ATTEMPTS = 20;
const requestedPort = Number.parseInt(process.env.PORT || '', 10) || DEFAULT_PORT;
const hasExplicitPort = !!process.env.PORT;
const buildDir = path.join(__dirname, 'build');
const indexFile = path.join(buildDir, 'index.html');

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

const sendFile = (res, filePath) => {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(error.code === 'ENOENT' ? 404 : 500, {
        'Content-Type': 'text/plain; charset=utf-8'
      });
      return res.end(error.code === 'ENOENT' ? 'Not Found' : 'Internal Server Error');
    }

    const extension = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': contentTypes[extension] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff'
    });
    return res.end(data);
  });
};

const requestHandler = (req, res) => {
  let pathname;
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    pathname = decodeURIComponent(url.pathname);
  } catch (error) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Bad Request');
  }

  // Long-lived Google sign-in (see authService.js)
  if (pathname.startsWith('/api/auth/')) {
    return handleAuth(req, res, url);
  }

  if (pathname === '/api/voice' || pathname === '/api/voice/status') {
    return handleVoice(req, res, url);
  }

  // .doc/.rtf/.odt → .docx via LibreOffice (see docConverter.js)
  if (pathname === '/api/convert') {
    return handleConvert(req, res, url);
  }

  // Images for published posts (see mediaStore.js)
  if (pathname === '/api/media') {
    return handleUpload(req, res);
  }
  if (pathname.startsWith('/media/')) {
    return serveMedia(req, res, pathname.slice('/media/'.length));
  }

  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^[/\\]+/, '');
  const requestedPath = path.resolve(buildDir, relativePath);
  const pathWithinBuild = path.relative(buildDir, requestedPath);

  if (pathWithinBuild.startsWith('..') || path.isAbsolute(pathWithinBuild)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Forbidden');
  }

  fs.stat(requestedPath, (err, stats) => {
    if (!err && stats.isFile()) {
      return sendFile(res, requestedPath);
    }

    // Support client-side routes, but do not hide missing asset errors.
    if (!path.extname(relativePath)) {
      return sendFile(res, indexFile);
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Not Found');
  });
};

const shouldOpenBrowser = () => {
  // BLOGCRAFT_OPEN_BROWSER is the pre-rebrand name, still honoured.
  const setting = process.env.BLOGARTIFEX_OPEN_BROWSER ?? process.env.BLOGCRAFT_OPEN_BROWSER;
  return setting !== '0' && process.env.CI !== 'true';
};

const openBrowser = (url) => {
  if (!shouldOpenBrowser()) {
    return;
  }

  const commands = {
    win32: ['cmd', ['/c', 'start', '', url]],
    darwin: ['open', [url]],
    linux: ['xdg-open', [url]]
  };
  const command = commands[process.platform];

  if (!command) {
    return;
  }

  try {
    const child = spawn(command[0], command[1], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    // spawn() reports a missing opener (e.g. headless Linux without
    // xdg-open) asynchronously; without this handler the whole server
    // crashes with an unhandled 'error' event.
    child.on('error', (error) => {
      console.warn(`Unable to open the browser automatically: ${error.message}`);
    });
    child.unref();
  } catch (error) {
    console.warn(`Unable to open the browser automatically: ${error.message}`);
  }
};

const listenOnPort = (port, attemptsLeft = MAX_PORT_ATTEMPTS) => {
  const server = http.createServer(requestHandler);

  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE' && !hasExplicitPort && attemptsLeft > 0) {
      console.warn(`Port ${port} is already in use. Trying ${port + 1}...`);
      server.close();
      listenOnPort(port + 1, attemptsLeft - 1);
      return;
    }

    console.error(`BlogArtifex could not start: ${error.message}`);
    process.exitCode = 1;
  });

  server.once('listening', () => {
    const url = `http://localhost:${port}`;
    console.log(`BlogArtifex running on ${url}`);
    openBrowser(url);
  });

  server.listen(port);
};

listenOnPort(requestedPort);
