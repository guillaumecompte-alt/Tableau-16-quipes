const { app, BrowserWindow, Menu, net, protocol } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const APP_SCHEME = 'app';
const APP_HOST = 'ze-padel';

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

function getBuildDirectory() {
  return path.resolve(__dirname, '..', 'dist-desktop');
}

async function serveLocalApp(request) {
  const url = new URL(request.url);
  if (url.protocol !== APP_SCHEME + ':' || url.hostname !== APP_HOST) {
    return new Response('Forbidden', { status: 403 });
  }

  let relativePath;
  try {
    relativePath = decodeURIComponent(url.pathname === '/' ? '/desktop.html' : url.pathname);
  } catch {
    return new Response('Invalid path', { status: 400 });
  }

  const root = getBuildDirectory();
  const resolved = path.resolve(root, '.' + relativePath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    return new Response('Forbidden', { status: 403 });
  }

  try {
    await fs.access(resolved);
    return await net.fetch(pathToFileURL(resolved).href);
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 720,
    show: false,
    backgroundColor: '#09254a',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });

  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(APP_SCHEME + '://' + APP_HOST + '/')) {
      event.preventDefault();
    }
  });

  window.loadURL(APP_SCHEME + '://' + APP_HOST + '/desktop.html');
  return window;
}

app.setAppUserModelId('fr.zepadel.desktop');

app.whenReady().then(async () => {
  protocol.handle(APP_SCHEME, serveLocalApp);
  Menu.setApplicationMenu(null);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
