const text = document.getElementById('text');
const fileName = document.getElementById('name');
const statusLine = document.getElementById('status');
const undoStack = [];
let noteTimer;
let previewUrl;

// Remember what was in the box between visits. Storage can be blocked, so
// every read and write is allowed to fail.
try { text.value = localStorage.getItem('toolkit-text') || ''; } catch {}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function showStats() {
  const s = text.value;
  const wordCount = (s.match(/\S+/g) || []).length;
  const lines = s ? s.split('\n').length : 0;
  statusLine.classList.remove('note');
  statusLine.textContent = `${plural(s.length, 'character')} · ${plural(wordCount, 'word')} · ${plural(lines, 'line')}`;
}

function say(message) {
  clearTimeout(noteTimer);
  statusLine.classList.add('note');
  statusLine.textContent = message;
  noteTimer = setTimeout(showStats, 3000);
}

function changed() {
  try { localStorage.setItem('toolkit-text', text.value); } catch {}
  showStats();
}

function setText(value) {
  if (value === text.value) return;
  undoStack.push(text.value);
  if (undoStack.length > 100) undoStack.shift();
  text.value = value;
  changed();
}

function bytesToBase64(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function parseJson(s) {
  try { return JSON.parse(s); } catch (e) { throw new Error(`Not valid JSON: ${e.message}`); }
}

// Splits "fooBar baz-qux" into ["foo", "Bar", "baz", "qux"].
function words(line) {
  return line
    .replace(/(\p{Ll}|\p{N})(\p{Lu})/gu, '$1 $2')
    .replace(/(\p{Lu}+)(\p{Lu}\p{Ll})/gu, '$1 $2')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map(w => w.toLowerCase());
}

const eachLine = f => s => s.split('\n').map(f).join('\n');
const allLines = f => s => f(s.split('\n')).join('\n');

const tools = {
  jsonFormat: s => JSON.stringify(parseJson(s), null, 2),
  jsonMinify: s => JSON.stringify(parseJson(s)),

  base64Encode: s => bytesToBase64(new TextEncoder().encode(s)),
  base64Decode: s => {
    try {
      const binary = atob(s.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/'));
      return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, c => c.charCodeAt(0)));
    } catch {
      throw new Error('Not valid Base64 text');
    }
  },
  urlEncode: s => encodeURIComponent(s),
  urlDecode: s => {
    try { return decodeURIComponent(s); } catch { throw new Error('Not valid URL encoding'); }
  },
  htmlEscape: s => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;'),
  htmlUnescape: s => {
    // A detached <textarea> decodes entities without parsing any tags.
    const t = document.createElement('textarea');
    t.innerHTML = s;
    return t.value;
  },

  upper: s => s.toUpperCase(),
  lower: s => s.toLowerCase(),
  camel: eachLine(line => words(line).map((w, i) => i ? w[0].toUpperCase() + w.slice(1) : w).join('')),
  snake: eachLine(line => words(line).join('_')),
  kebab: eachLine(line => words(line).join('-')),

  sort: allLines(lines => lines.sort((a, b) => a.localeCompare(b))),
  unique: allLines(lines => [...new Set(lines)]),
  reverse: allLines(lines => lines.reverse()),
  trim: s => s.split('\n').map(line => line.trimEnd()).join('\n').replace(/^\n+|\n+$/g, ''),

  sha256: async s => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  },
};

const types = { html: 'text/html', js: 'text/javascript', py: 'text/x-python' };

function save(ext) {
  const base = fileName.value.trim().replace(/\.(html?|js|py)$/i, '') || 'untitled';
  const file = `${base}.${ext}`;
  const url = URL.createObjectURL(new Blob([text.value], { type: `${types[ext]};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = file;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  say(`Saved ${file}`);
}

const actions = {
  preview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(new Blob([text.value], { type: 'text/html;charset=utf-8' }));
    window.open(previewUrl, '_blank');
  },
  uuid() {
    undoStack.push(text.value);
    text.setRangeText(crypto.randomUUID(), text.selectionStart, text.selectionEnd, 'end');
    text.focus();
    changed();
  },
  undo() {
    if (!undoStack.length) return say('Nothing to undo');
    text.value = undoStack.pop();
    changed();
  },
  async copy() {
    try {
      await navigator.clipboard.writeText(text.value);
    } catch {
      text.select();
      document.execCommand('copy');
    }
    say('Copied');
  },
  clear() {
    setText('');
    text.focus();
  },
};

const needsText = new Set(['preview', 'copy', 'clear']);

document.querySelector('.tools').addEventListener('click', async event => {
  const button = event.target.closest('button');
  if (!button) return;
  const { tool, save: ext, action } = button.dataset;
  if (!text.value && (tool || ext || needsText.has(action))) return say('Paste something first');
  try {
    if (ext) save(ext);
    else if (tool) setText(await tools[tool](text.value));
    else await actions[action]();
  } catch (e) {
    say(e.message);
  }
});

text.addEventListener('input', changed);
showStats();
