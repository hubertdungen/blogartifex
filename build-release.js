const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const pkgJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkgJson.version || '0.0.0';
const distDir = path.join(root, 'dist');
const pkgConfigFile = 'pkg.config.json';
const windowsIconFile = path.join(root, 'public', 'logo.ico');
const windowsPkgCacheDir = path.join(distDir, '.pkg-cache-win-icon');

const releaseTargets = {
  'win-x64': {
    label: 'Windows x64',
    pkgTarget: 'node18-win-x64',
    fileName: `blogartifex-${version}-windows-x64.exe`,
    platform: 'win32'
  },
  'linux-x64': {
    label: 'Linux x64',
    pkgTarget: 'node18-linux-x64',
    fileName: `blogartifex-${version}-linux-x64`
  },
  'macos-x64': {
    label: 'macOS Intel',
    pkgTarget: 'node18-macos-x64',
    fileName: `blogartifex-${version}-macos-x64`,
    requiredPlatform: 'darwin'
  },
  'macos-arm64': {
    label: 'macOS Apple Silicon',
    pkgTarget: 'node18-macos-arm64',
    fileName: `blogartifex-${version}-macos-arm64`,
    requiredPlatform: 'darwin'
  }
};

const targetGroups = {
  win: ['win-x64'],
  windows: ['win-x64'],
  linux: ['linux-x64'],
  mac: ['macos-x64', 'macos-arm64'],
  macos: ['macos-x64', 'macos-arm64'],
  all: ['win-x64', 'linux-x64', 'macos-x64', 'macos-arm64']
};

function quoteArg(arg) {
  const value = String(arg);
  if (/^[A-Za-z0-9_./:=@-]+$/.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '\\"')}"`;
}

function run(command, args = [], opts = {}) {
  const line = [command, ...args].map(quoteArg).join(' ');
  execSync(line, { stdio: 'inherit', cwd: root, ...opts });
}

function parsePkgTarget(pkgTarget) {
  const match = String(pkgTarget).match(/^node(\d+)-([a-z0-9]+)-([a-z0-9]+)$/i);
  if (!match) {
    throw new Error(`Cannot parse pkg target: ${pkgTarget}`);
  }

  return {
    nodeRange: `node${match[1]}`,
    platform: match[2],
    arch: match[3]
  };
}

function parseArgs(argv) {
  const requested = [];
  let skipBuild = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--skip-build') {
      skipBuild = true;
    } else if (arg === '--all') {
      requested.push('all');
    } else if (arg === '--current') {
      requested.push('current');
    } else if (arg === '--target' || arg === '--targets') {
      i += 1;
      if (!argv[i]) {
        throw new Error(`${arg} needs a value`);
      }
      requested.push(...argv[i].split(','));
    } else if (arg.startsWith('--target=')) {
      requested.push(...arg.slice('--target='.length).split(','));
    } else if (arg.startsWith('--targets=')) {
      requested.push(...arg.slice('--targets='.length).split(','));
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      requested.push(...arg.split(','));
    }
  }

  return {
    requested: requested.length ? requested : ['win'],
    skipBuild
  };
}

function getCurrentTargetKey() {
  if (process.platform === 'win32' && process.arch === 'x64') {
    return 'win-x64';
  }
  if (process.platform === 'linux' && process.arch === 'x64') {
    return 'linux-x64';
  }
  if (process.platform === 'darwin' && process.arch === 'x64') {
    return 'macos-x64';
  }
  if (process.platform === 'darwin' && process.arch === 'arm64') {
    return 'macos-arm64';
  }

  throw new Error(`No release target is configured for ${process.platform}-${process.arch}`);
}

function resolveTargets(requested) {
  const targetKeys = [];

  requested.forEach((rawName) => {
    const name = rawName.trim().toLowerCase();
    if (!name) {
      return;
    }

    if (name === 'current') {
      targetKeys.push(getCurrentTargetKey());
      return;
    }

    if (targetGroups[name]) {
      targetKeys.push(...targetGroups[name]);
      return;
    }

    if (releaseTargets[name]) {
      targetKeys.push(name);
      return;
    }

    throw new Error(`Unknown release target: ${rawName}`);
  });

  return [...new Set(targetKeys)].map((key) => releaseTargets[key]);
}

function filterTargetsForHost(targets) {
  return targets.filter((target) => {
    if (!target.requiredPlatform || target.requiredPlatform === process.platform) {
      return true;
    }

    console.warn(
      `Skipping ${target.label}: build this target on macOS so the binary can be signed.`
    );
    return false;
  });
}

function ensureDependencies() {
  if (!fs.existsSync(path.join(root, 'node_modules'))) {
    console.log('Installing dependencies...');
    run('npm', ['install']);
  }
}

function ensureProductionBuild(skipBuild) {
  if (!skipBuild) {
    console.log('Building production assets...');
    run('npm', ['run', 'build']);
  }

  const indexFile = path.join(root, 'build', 'index.html');
  if (!fs.existsSync(indexFile)) {
    throw new Error('Missing build/index.html. Run without --skip-build to create production assets.');
  }
}

function normalizeWindowsVersion(value) {
  const parts = String(value)
    .split('.')
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part));

  while (parts.length < 4) {
    parts.push(0);
  }

  return parts.slice(0, 4).join('.');
}

async function prepareWindowsPkgCache(target) {
  if (target.platform !== 'win32') {
    return {};
  }

  if (!fs.existsSync(windowsIconFile)) {
    throw new Error(`Missing Windows icon file: ${windowsIconFile}`);
  }

  if (process.platform !== 'win32') {
    console.warn('Skipping Windows icon embedding: preparing the iconized pkg base binary needs Windows.');
    return {};
  }

  if (!fs.existsSync(windowsPkgCacheDir)) {
    fs.mkdirSync(windowsPkgCacheDir, { recursive: true });
  }

  const originalCachePath = process.env.PKG_CACHE_PATH;
  process.env.PKG_CACHE_PATH = windowsPkgCacheDir;

  try {
    const { need } = require('pkg-fetch');
    const rceditModule = await import('rcedit');
    const rcedit = rceditModule.rcedit || rceditModule.default;
    const parsedTarget = parsePkgTarget(target.pkgTarget);

    const fetchedBase = await need({
      ...parsedTarget,
      forceFetch: true
    });
    const builtBase = path.join(
      path.dirname(fetchedBase),
      path.basename(fetchedBase).replace(/^fetched-/, 'built-')
    );

    fs.copyFileSync(fetchedBase, builtBase);

    console.log('Embedding BlogArtifex icon in Windows pkg base binary...');
    await rcedit(builtBase, {
      icon: windowsIconFile,
      'file-version': normalizeWindowsVersion(version),
      'product-version': normalizeWindowsVersion(version),
      'version-string': {
        CompanyName: 'BlogArtifex',
        FileDescription: 'BlogArtifex portable Blogger editor',
        ProductName: 'BlogArtifex',
        InternalName: 'BlogArtifex',
        OriginalFilename: target.fileName
      }
    });

    fs.rmSync(fetchedBase, { force: true });
    return { PKG_CACHE_PATH: windowsPkgCacheDir };
  } finally {
    if (originalCachePath) {
      process.env.PKG_CACHE_PATH = originalCachePath;
    } else {
      delete process.env.PKG_CACHE_PATH;
    }
  }
}

async function packageTarget(target) {
  const outputPath = path.join('dist', target.fileName);
  const envOverrides = await prepareWindowsPkgCache(target);

  console.log(`Packaging ${target.label} portable binary...`);
  run('npx', [
    'pkg',
    'server.js',
    '--config',
    pkgConfigFile,
    '--targets',
    target.pkgTarget,
    '--output',
    outputPath,
    '--public',
    '--no-bytecode',
    '--public-packages',
    '*'
  ], {
    env: {
      ...process.env,
      ...envOverrides
    }
  });

  return outputPath;
}

async function main() {
  const { requested, skipBuild } = parseArgs(process.argv.slice(2));
  const targets = filterTargetsForHost(resolveTargets(requested));

  if (!targets.length) {
    throw new Error('No release targets can be built on this host.');
  }

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir);
  }

  ensureDependencies();
  ensureProductionBuild(skipBuild);

  const outputs = [];
  for (const target of targets) {
    const output = await packageTarget(target);
    outputs.push(output);
  }

  console.log('\nRelease files created:');
  outputs.forEach((file) => console.log(`- ${file}`));
  console.log('\nRun one of these files. BlogArtifex opens a browser tab automatically.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
