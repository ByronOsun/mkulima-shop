import http from 'node:http';
import { promises as fs, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', 'dist');
const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || '0.0.0.0';

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.ico', 'image/x-icon'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function loadDotEnv(filePath) {
  try {
    const txt = readFileSync(filePath, 'utf8');
    const lines = txt.split(/\r?\n/);
    const out = {};
    for (const l of lines) {
      const line = l.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.substring(0, eq).trim();
      let val = line.substring(eq + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      out[key] = val;
    }
    return out;
  } catch (err) {
    return {};
  }
}

function escapeForJs(s) {
  return JSON.stringify(s ?? '');
}

function rewriteBundle(source) {
  const env = loadDotEnv(path.join(__dirname, '..', '.env'));
  // Branding replacements
  source = source
    .replaceAll('Wakulima Agrovet Shop', 'Mkulima Agrovet Farm')
    .replaceAll('Point Of Sale Terminal - Sign in', 'Agrovet Farm - Sign in')
    .replaceAll('Point of Sale Terminal - Sign in', 'Agrovet Farm - Sign in')
    .replaceAll('Point Of Sale Terminal', 'Mkulima Agrovet Farm')
    .replaceAll('Point of sale terminal', 'Mkulima Agrovet Farm point of sale and inventory system');
  source = source.replaceAll('you@multishop.com', 'you@agrovet.co.ke');

  // Inject real Supabase values into the minified bundle by replacing the empty FS object.
  // This replaces occurrences like: var FS={};
  const injected = `var FS={SUPABASE_URL:${escapeForJs(env.SUPABASE_URL)},SUPABASE_PUBLISHABLE_KEY:${escapeForJs(env.SUPABASE_PUBLISHABLE_KEY)},SUPABASE_ANON_KEY:${escapeForJs(env.SUPABASE_ANON_KEY)},SUPABASE_PROJECT_ID:${escapeForJs(env.SUPABASE_PROJECT_ID)}};`;
  // Use a simple regexp to replace the empty FS definition (minified bundle).
  source = source.replace(/var FS=\{\};/, injected);
  return source;
}

const server = http.createServer(async (req, res) => {
  try {
    const rawUrl = req.url || '/';
    const urlPath = decodeURIComponent(rawUrl.split('?')[0]);
    if (urlPath === '/') {
      res.writeHead(302, {
        Location: '/login',
        'Cache-Control': 'no-store',
      });
      res.end();
      return;
    }
    const safePath = urlPath === '/' ? '/index.html' : urlPath;
    const filePath = path.join(rootDir, safePath);
    if (!filePath.startsWith(rootDir)) {
      send(res, 403, 'Forbidden');
      return;
    }

    const stat = await fs.stat(filePath).catch(() => null);
    if (!stat || !stat.isFile()) {
      if (path.extname(safePath)) {
        send(res, 404, 'Not found');
        return;
      }
      const indexPath = path.join(rootDir, 'index.html');
      const indexHtml = await fs.readFile(indexPath, 'utf8');
      send(res, 200, indexHtml, 'text/html; charset=utf-8');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes.get(ext) || 'application/octet-stream';

    if (ext === '.js') {
      const source = await fs.readFile(filePath, 'utf8');
      send(res, 200, rewriteBundle(source), contentType);
      return;
    }

    if (ext === '.html' || ext === '.css' || ext === '.json' || ext === '.svg') {
      const source = await fs.readFile(filePath, 'utf8');
      send(res, 200, source, contentType);
      return;
    }

    const bytes = await fs.readFile(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
    });
    res.end(bytes);
  } catch (error) {
    send(res, 500, `Server error: ${error instanceof Error ? error.message : String(error)}`);
  }
});

server.listen(port, host, () => {
  console.log(`Serving ${rootDir} on http://${host}:${port}`);
});
