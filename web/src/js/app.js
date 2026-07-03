import init, { Ps2CdProject } from '../../dist/ps2cd.js';
import { PS2CD_WEB_CONFIG } from './config.js';

const state = {
  wasmReady: false,
  files: [],
  sourceName: ''
};

const elements = {
  zipInput: document.getElementById('zip-input'),
  folderInput: document.getElementById('folder-input'),
  mediaSelect: document.getElementById('media-select'),
  outputNameInput: document.getElementById('output-name-input'),
  fileSummary: document.getElementById('file-summary'),
  systemCnfStatus: document.getElementById('system-cnf-status'),
  bootLogoStatus: document.getElementById('boot-logo-status'),
  buildButton: document.getElementById('build-button'),
  outputList: document.getElementById('output-list'),
  log: document.getElementById('log')
};

boot();

async function boot() {
  elements.mediaSelect.value = PS2CD_WEB_CONFIG.defaultMedia;
  elements.outputNameInput.value = PS2CD_WEB_CONFIG.defaultOutputBaseName;
  elements.buildButton.disabled = true;
  updateSummary();

  try {
    await init();
    state.wasmReady = true;
    elements.buildButton.disabled = false;
    log('WASM loaded. Add a project ZIP or folder to start.');
  } catch (error) {
    log(`Failed to load WASM: ${formatError(error)}`);
  }
}

elements.zipInput.addEventListener('change', async () => {
  const file = elements.zipInput.files?.[0];
  if (!file) {
    return;
  }

  try {
    log(`Reading ZIP: ${file.name}`);
    const bytes = new Uint8Array(await file.arrayBuffer());
    state.files = await readZip(bytes);
    state.sourceName = file.name.replace(/\.zip$/i, '');
    if (!elements.outputNameInput.value || elements.outputNameInput.value === PS2CD_WEB_CONFIG.defaultOutputBaseName) {
      elements.outputNameInput.value = safeBaseName(state.sourceName || PS2CD_WEB_CONFIG.defaultOutputBaseName);
    }
    updateSummary();
    log(`Loaded ${state.files.length} file(s) from ZIP root.`);
  } catch (error) {
    log(`ZIP load failed: ${formatError(error)}`);
  }
});

elements.folderInput.addEventListener('change', async () => {
  const files = Array.from(elements.folderInput.files || []);
  if (files.length === 0) {
    return;
  }

  try {
    log(`Reading folder selection: ${files.length} file(s)`);
    const browserFiles = await Promise.all(files.map(readBrowserFile));
    state.files = stripBrowserSelectedFolder(browserFiles);
    state.sourceName = commonBrowserRoot(files) || 'folder';
    if (!elements.outputNameInput.value || elements.outputNameInput.value === PS2CD_WEB_CONFIG.defaultOutputBaseName) {
      elements.outputNameInput.value = safeBaseName(state.sourceName || PS2CD_WEB_CONFIG.defaultOutputBaseName);
    }
    updateSummary();
    log(`Loaded ${state.files.length} file(s) from selected folder root.`);
  } catch (error) {
    log(`Folder load failed: ${formatError(error)}`);
  }
});

elements.mediaSelect.addEventListener('change', updateSummary);

elements.buildButton.addEventListener('click', async () => {
  if (!state.wasmReady) {
    log('WASM is not ready yet.');
    return;
  }
  if (state.files.length === 0) {
    log('No files loaded. Add a project ZIP or folder first.');
    return;
  }

  elements.outputList.replaceChildren();
  elements.buildButton.disabled = true;

  try {
    const userFiles = cloneVirtualFiles(state.files);
    const systemCnf = findFile(userFiles, 'SYSTEM.CNF');
    const boot = systemCnf ? null : findFirstBootExecutable(userFiles);
    const bootElf = systemCnf
      ? detectBootElf(new TextDecoder().decode(systemCnf.bytes))
      : boot?.bootName;
    if (PS2CD_WEB_CONFIG.requireSystemCnf && !systemCnf) {
      throw new Error('SYSTEM.CNF was not found at the project root. The ZIP root must mirror the disc root.');
    }
    if (!systemCnf && !bootElf) {
      throw new Error('SYSTEM.CNF was not found and no root boot ELF could be detected. Add SYSTEM.CNF or place BOOT.ELF at the project root.');
    }

    const buildFiles = cloneVirtualFiles(userFiles);
    if (!systemCnf && boot && !samePath(boot.path, boot.bootName)) {
      upsertVirtualFile(buildFiles, boot.bootName, boot.file.bytes);
    }
    const orderResult = await resolveBuildOrder(userFiles, systemCnf, bootElf);
    const bootLogoResult = await applySiteBootLogoOverride(buildFiles);
    const recipe = buildInternalRecipe(systemCnf, bootElf, orderResult.order, bootLogoResult.virtualPath || null);
    const project = new Ps2CdProject();

    for (const file of buildFiles) {
      project.add_file(file.path, file.bytes);
    }

    log(`Building ${recipe.media.toUpperCase()} image from ${buildFiles.length} virtual file(s)...`);
    const output = project.build(JSON.stringify(recipe));
    const baseName = safeBaseName(elements.outputNameInput.value || recipe.outputBaseName || PS2CD_WEB_CONFIG.defaultOutputBaseName);

    addTextDownload(`${baseName}.iml`, output.iml(), 'text/plain');

    if (output.has_iso()) {
      addBinaryDownload(`${baseName}.iso`, output.iso_bytes(), 'application/octet-stream');
    }
    if (output.has_bin()) {
      addBinaryDownload(`${baseName}.bin`, output.bin_bytes(), 'application/octet-stream');
      addTextDownload(`${baseName}.cue`, output.cue(), 'text/plain');
    }

    const warnings = JSON.parse(output.warnings_json());
    const notes = [];
    if (orderResult.source) {
      notes.push(`Order: ${orderResult.source}.`);
    }
    if (bootLogoResult.loaded) {
      notes.push(`Site boot logo override loaded from ${bootLogoResult.label}.`);
    } else if (bootLogoResult.skipped) {
      notes.push(bootLogoResult.reason);
    }
    log(['Build complete.', '', ...notes, ...warnings].filter(Boolean).join('\n'));
  } catch (error) {
    log(`Build failed: ${formatError(error)}`);
  } finally {
    elements.buildButton.disabled = false;
    updateSummary();
  }
});

function buildInternalRecipe(systemCnf, bootElf, order, bootLogoPath) {
  const generatedSystemCnf = PS2CD_WEB_CONFIG.generatedSystemCnf || {};
  return {
    manifestVersion: 1,
    media: elements.mediaSelect.value || PS2CD_WEB_CONFIG.defaultMedia,
    discId: systemCnf ? null : (generatedSystemCnf.discId || 'PSCD_000.01'),
    outputBaseName: safeBaseName(elements.outputNameInput.value || PS2CD_WEB_CONFIG.defaultOutputBaseName),
    layout: PS2CD_WEB_CONFIG.layout?.mode || 'packed-legacy',
    bootLba: PS2CD_WEB_CONFIG.layout?.bootLba ?? 12231,
    systemCnf: systemCnf ? {
      mode: 'none'
    } : {
      mode: 'generate',
      bootElf,
      vmode: generatedSystemCnf.vmode || 'NTSC'
    },
    bootLogo: {
      mode: PS2CD_WEB_CONFIG.bootLogo.enabled ? 'auto' : 'none',
      path: bootLogoPath,
      blackClamp: PS2CD_WEB_CONFIG.bootLogo.blackClamp || 0
    },
    order
  };
}

async function resolveBuildOrder(files, systemCnf, bootElf) {
  const rootOrder = findRootOrderFile(files);
  if (rootOrder) {
    const lines = parseOrderText(new TextDecoder().decode(rootOrder.bytes));
    return {
      order: composeBuildOrder(lines, bootElf),
      source: `${rootOrder.path} from uploaded project`
    };
  }

  const assetOrder = await loadInternalOrderFallback();
  if (assetOrder) {
    return {
      order: composeBuildOrder(assetOrder.lines, bootElf),
      source: `${assetOrder.url} from internal assets`
    };
  }

  return {
    order: composeBuildOrder(PS2CD_WEB_CONFIG.order.fallback || [], bootElf),
    source: 'built-in fallback order'
  };
}

function findRootOrderFile(files) {
  const names = PS2CD_WEB_CONFIG.order.rootFiles || [];
  for (const name of names) {
    const file = findFile(files, name);
    if (file) {
      return file;
    }
  }
  return null;
}

async function loadInternalOrderFallback() {
  for (const url of PS2CD_WEB_CONFIG.order.candidates || []) {
    try {
      const requestUrl = resolveInternalUrl(url);
      const response = await fetch(requestUrl, { cache: 'no-store' });
      if (!response.ok) {
        continue;
      }
      const text = await response.text();
      const lines = parseOrderText(text);
      if (lines.length > 0) {
        return { url, lines };
      }
    } catch (_error) {
      // Optional developer assets are allowed to be missing.
    }
  }
  return null;
}

function parseOrderText(text) {
  return String(text)
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*/, '').trim())
    .filter(Boolean)
    .map(normalizePath);
}

function composeBuildOrder(lines, bootElf) {
  return Array.from(new Set([
    'SYSTEM.CNF',
    bootElf,
    ...lines
  ].filter(Boolean)));
}

async function applySiteBootLogoOverride(files) {
  if (!PS2CD_WEB_CONFIG.bootLogo.enabled) {
    return { skipped: true, reason: 'Boot-logo handling is disabled.' };
  }

  if (hasRootBootLogo(files)) {
    return { skipped: true, reason: 'Using boot logo source from uploaded project.' };
  }

  for (const candidate of PS2CD_WEB_CONFIG.bootLogo.candidates || []) {
    try {
      const requestUrl = resolveInternalUrl(candidate);
      const response = await fetch(requestUrl, { cache: 'no-store' });
      if (!response.ok) {
        continue;
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length === 0) {
        continue;
      }
      upsertVirtualFile(files, PS2CD_WEB_CONFIG.bootLogo.virtualPath, bytes);
      return {
        loaded: true,
        label: candidate,
        virtualPath: PS2CD_WEB_CONFIG.bootLogo.virtualPath
      };
    } catch (_error) {
      // Optional site-level overrides are allowed to be missing.
    }
  }

  return {
    skipped: true,
    reason: 'No site boot logo override was found; ps2cd core fallback will be used.'
  };
}

async function readBrowserFile(file) {
  const path = file.webkitRelativePath || file.name;
  return {
    path: normalizePath(path),
    bytes: new Uint8Array(await file.arrayBuffer())
  };
}

function cloneVirtualFiles(files) {
  return files.map((file) => ({
    path: file.path,
    bytes: file.bytes
  }));
}

function upsertVirtualFile(files, path, bytes) {
  const normalized = normalizePath(path);
  const index = files.findIndex((file) => samePath(file.path, normalized));
  if (index >= 0) {
    files[index] = { path: normalized, bytes };
  } else {
    files.push({ path: normalized, bytes });
  }
}

function updateSummary() {
  const size = state.files.reduce((total, file) => total + file.bytes.length, 0);
  elements.fileSummary.textContent = state.files.length === 0
    ? 'No files loaded.'
    : `${state.files.length} file(s), ${formatBytes(size)} loaded.`;

  const systemCnf = findFile(state.files, 'SYSTEM.CNF');
  const boot = systemCnf ? null : findFirstBootExecutable(state.files);
  elements.systemCnfStatus.textContent = systemCnf
    ? 'SYSTEM.CNF: found at project root'
    : boot
      ? `SYSTEM.CNF: will be generated for ${boot.bootName}`
      : 'SYSTEM.CNF: missing';

  elements.bootLogoStatus.textContent = hasRootBootLogo(state.files)
    ? 'Boot logo: provided by uploaded project'
    : 'Boot logo: site override or built-in core fallback will be used';
}

function findFile(files, path) {
  return files.find((file) => samePath(file.path, path));
}

function samePath(left, right) {
  return normalizePath(left).toUpperCase() === normalizePath(right).toUpperCase();
}

function hasRootBootLogo(files) {
  return ['boot.bmp', 'boot.bin', 'boot.logo', 'boot.raw'].some((name) => findFile(files, name));
}

function findFirstBootExecutable(files) {
  const rootFiles = files.filter((file) => !file.path.includes('/'));
  const boot = rootFiles.find((file) => fileName(file.path).toUpperCase() === 'BOOT.ELF');
  if (boot) {
    return preparedBootExecutable(boot);
  }
  const discIdStyle = rootFiles.find((file) => normalizeDiscIdName(fileName(file.path)));
  if (discIdStyle) {
    return preparedBootExecutable(discIdStyle);
  }
  const elf = rootFiles.find((file) => fileName(file.path).toUpperCase().endsWith('.ELF'));
  return elf ? preparedBootExecutable(elf) : null;
}

function preparedBootExecutable(file) {
  const sourceName = fileName(file.path).toUpperCase();
  const discId = normalizeDiscIdName(sourceName) || (PS2CD_WEB_CONFIG.generatedSystemCnf?.discId || 'PSCD_000.01');
  return {
    file,
    path: file.path,
    bootName: discId,
    discId
  };
}

function normalizeDiscIdName(name) {
  const match = String(name).toUpperCase().match(/[A-Z0-9]{4}[-_]?[0-9]{3}[._-]?[0-9]{2}/);
  if (!match) {
    return null;
  }
  const compact = match[0].replace(/[-_.]/g, '');
  return `${compact.slice(0, 4)}_${compact.slice(4, 7)}.${compact.slice(7, 9)}`;
}

function fileName(path) {
  return path.split('/').pop() || path;
}

function detectBootElf(systemCnfText) {
  const match = systemCnfText.match(/BOOT2\s*=\s*cdrom0:\\([^;\r\n]+)/i);
  if (!match) {
    return null;
  }
  return normalizePath(match[1]);
}

function stripBrowserSelectedFolder(files) {
  const roots = files
    .map((file) => file.path.split('/')[0])
    .filter(Boolean);
  const uniqueRoots = Array.from(new Set(roots.map((root) => root.toUpperCase())));
  if (uniqueRoots.length !== 1) {
    return files;
  }

  const root = roots[0];
  return files.map((file) => ({
    path: normalizePath(file.path.slice(root.length + 1)),
    bytes: file.bytes
  })).filter((file) => file.path.length > 0);
}

function commonBrowserRoot(files) {
  const first = files[0]?.webkitRelativePath || '';
  return first.split('/')[0] || '';
}

function addTextDownload(fileName, text, type) {
  addDownload(fileName, new Blob([text], { type }), text.length);
}

function addBinaryDownload(fileName, bytes, type) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  addDownload(fileName, new Blob([data], { type }), data.byteLength);
}

function addDownload(fileName, blob, size) {
  const url = URL.createObjectURL(blob);
  const row = document.createElement('div');
  row.className = 'output-item';

  const label = document.createElement('div');
  label.innerHTML = `<strong>${escapeHtml(fileName)}</strong><br><span>${formatBytes(size)}</span>`;

  const link = document.createElement('a');
  link.className = 'button button-soft';
  link.href = url;
  link.download = fileName;
  link.textContent = 'Download';

  row.append(label, link);
  elements.outputList.append(row);
}

async function readZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocdOffset = findEndOfCentralDirectory(view);
  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);
  const files = [];
  let cursor = centralDirectoryOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) {
      throw new Error('Invalid ZIP central directory entry.');
    }

    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const fileNameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localHeaderOffset = view.getUint32(cursor + 42, true);
    const nameBytes = bytes.slice(cursor + 46, cursor + 46 + fileNameLength);
    const path = normalizePath(new TextDecoder().decode(nameBytes));

    if (!path.endsWith('/')) {
      const data = await readZipEntry(bytes, localHeaderOffset, compressedSize, method);
      files.push({ path, bytes: data });
    }

    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  return files;
}

async function readZipEntry(bytes, localHeaderOffset, compressedSize, method) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) {
    throw new Error('Invalid ZIP local file header.');
  }

  const fileNameLength = view.getUint16(localHeaderOffset + 26, true);
  const extraLength = view.getUint16(localHeaderOffset + 28, true);
  const dataStart = localHeaderOffset + 30 + fileNameLength + extraLength;
  const compressed = bytes.slice(dataStart, dataStart + compressedSize);

  if (method === 0) {
    return compressed;
  }
  if (method === 8) {
    return inflateRaw(compressed);
  }

  throw new Error(`Unsupported ZIP compression method: ${method}`);
}

async function inflateRaw(bytes) {
  if (!('DecompressionStream' in globalThis)) {
    throw new Error('This browser cannot inflate ZIP entries. Try an uncompressed ZIP or another browser.');
  }

  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

function findEndOfCentralDirectory(view) {
  const min = Math.max(0, view.byteLength - 0xffff - 22);
  for (let offset = view.byteLength - 22; offset >= min; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      return offset;
    }
  }
  throw new Error('ZIP end of central directory was not found.');
}

function resolveInternalUrl(path) {
  return new URL(path, document.baseURI);
}

function normalizePath(path) {
  return String(path)
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .trim();
}

function safeBaseName(value) {
  return String(value).replace(/[^a-z0-9._-]/gi, '_') || 'ps2cd';
}

function formatBytes(value) {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatError(error) {
  if (error && typeof error === 'object' && 'message' in error) {
    return error.message;
  }
  return String(error);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function log(message) {
  elements.log.textContent = message;
}
