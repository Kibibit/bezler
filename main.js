//@ts-check
const { app, BrowserWindow, Tray, ipcMain, nativeTheme, nativeImage, screen } = require('electron');
const path = require('path');
const request = require('request-promise-native');
// const Git = require('nodegit');
const fs = require('fs-extra');
const { keyBy, forEach } = require('lodash');

const assetsDirectory = path.join(__dirname, 'assets');
const knownSystems = [
  'MAME',
  'Atari2600',
  'Atari5200',
  'Atari7800',
  'GB',
  'GBA',
  'GBC',
  'GCEVectrex',
  'MaterSystem',
  'Megadrive',
  'N64',
  'NES',
  'Sega32X',
  'SegaCD',
  'SG-1000',
  'SNES',
  'SuperGrafx',
  'SFC',
  'PSX',
  'TG16',
  'TG-CD',
  'ColecoVision',
  'Dreamcast',
  'Naomi',
  'Atomiswave'
];
const defaultRepo = 'thebezelproject';

let tray;
let window;
let retroarchPath = '~/test-bezels/';

app.on('ready', () => {
  createTray();
  createWindow();

  ipcMain.on('asynchronous-message', (event, arg) => {
    console.log(arg); // prints "ping"
    event.reply('asynchronous-reply', 'pong');
  });
  
  ipcMain.on('synchronous-message', (event, arg) => {
    console.log(arg); // prints "ping"
    event.returnValue = 'pong';
  });

  ipcMain.on('enable-bezels', (event, arg) => {
    console.log(arg); // prints "ping"
    // do action!
    // updateBezels('install');
    InstallBezelPack({
      name: 'MAME',
      path: retroarchPath,
      isInstalled: false
    }).catch((err) => console.error(err));

    // update UI
    event.reply('enable-bezels-reply', 'pong');
  });

  // use the system's theme:
  updateThemeBasedOnSystemTheme();
  nativeTheme.addListener('updated', updateThemeBasedOnSystemTheme);
});

function updateThemeBasedOnSystemTheme() {
  console.log('Updating theme: ', nativeTheme.shouldUseDarkColors ? 'Dark' : 'White');
  window.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors);
}

function InstallBezelPack(system, repo) {
  // set defaults
  repo = repo || defaultRepo;

  const repoTempFolder = path.join(__dirname, `tmp/${ system.name }`);

  if (system.isInstalled) {
    console.log(`${ system.name.toUpperCase() }: System already installed`);
    return Promise.resolve();
  }

  console.log(`${ system.name.toUpperCase() }: Installing bezels...`);
  // return Git.Clone.clone(`https://github.com/${ repo }/bezelproject-${ system }.git`, repoTempFolder)
  return fs.ensureDir(repoTempFolder)
  .then(() => fs.ensureDir(path.join(retroarchPath, 'configs/all/')))
  .then(() => fs.copy(repoTempFolder, path.join(retroarchPath, 'configs/all/')))
  .then(() => fs.remove(repoTempFolder));
}

function updateBezels(action) {
  let systems;
  getInstalledBezelPacks()
  .then((_systems) => systems = _systems)
  .then(() => Promise.all(systems.map((system) => action === 'install' ?
    InstallBezelPack(system.name, defaultRepo) : uninstallBezelPack(system))));
}

function getInstalledBezelPacks() {
  return Promise.all(knownSystems
    .map((system) => fs.pathExists(path.join(retroarchPath, `/overlay/GameBezels/${ system }`))))
    .then((areBezelPacksInstalled) => areBezelPacksInstalled.map((isInstalled, index) => {
      const name = knownSystems[index];
      const retroarchBezelPath = name === 'MAME' ?
        '/overlay/ArcadeBezels' :
        `/overlay/GameBezels/${ name }`;

      return {
        name,
        path: path.join(retroarchPath, retroarchBezelPath),
        isInstalled
      };
    }));
}

function uninstallBezelPack(system) {
  return system.isInstalled ? fs.remove(system.path) : Promise.resolve();
}


function createWindow () {
  // Create the browser window.
  window = new BrowserWindow({
    width: 300,
    height: 450,
    frame: false,
    show: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true
    }
  });

  // and load the index.html of the app.
  window.loadFile('index.html');

  runDevUtilsIfNeeded();
}

function createTray() {
  const iconPath = path.join(assetsDirectory, 'sunTemplate.png');
  const trayIcon = nativeImage.createFromPath(iconPath);
  tray = new Tray(trayIcon);
  tray.on('right-click', () => {
    console.log('inside right click!');
    return window.openDevTools({mode: 'detach'});
  });
  tray.on('double-click', toggleWindow);
  tray.on('click', function (event) {

    console.log('we are before...');

    // Show devtools when command clicked
    if (window.isVisible() && process.defaultApp && event.metaKey) {
      console.log('we are inside!');
      return window.openDevTools({mode: 'detach'});
    }

    toggleWindow();
  })
}

function toggleWindow() {
  if (window.isVisible()) {
    window.hide();
  } else {
    showWindow();
  }
}

function showWindow() {
  const position = getWindowPosition();
  window.setPosition(position.x, position.y, false);
  // update UI on tray position to change arrow
  console.log(position);
  window.webContents.send('window-location-update', position);
  window.show();
  window.focus();
}

function getWindowPosition() {
    const windowBounds = window.getBounds();
    const trayBounds = tray.getBounds();
    const screenBounds = screen.getDisplayMatching(trayBounds).bounds;

    // window position is bottom then ontop.check if window + tray location
    // extends the screen size
    // if tray icon position is in top half of the screen, put it on top
    // if tray icon position is in bottom half of the screen, put it on bottom
    // if X axis is clipped, put it on the side
    const isTrayAtBottomHalf = (windowBounds.height / 2) < trayBounds.y;
    
    const bottomPositionStartX = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2));
    const bottomPositionEndX = Math.round(trayBounds.x + (trayBounds.width / 2 ) + (windowBounds.width / 2));
    const bottomPositionStartY = trayBounds.y + trayBounds.height + 4;
    const bottomPositionEndY = trayBounds.y + trayBounds.height + 4 + windowBounds.height;
    const isXOutOfBoundLeft = bottomPositionStartX < screenBounds.x;
    const isXOutOfBoundRight = bottomPositionEndX > screenBounds.width;
    const isBottomOutOfScreenBoundsY = bottomPositionEndY > screenBounds.height || bottomPositionStartY < screenBounds.y;

    console.log('is out of bound LEFT? X ', isXOutOfBoundLeft);
    console.log('is out of bound RIGHT? X ', isXOutOfBoundRight);
    console.log('is out of bound? Y ', isBottomOutOfScreenBoundsY);

    // Center window horizontally below the tray icon
    const x = isXOutOfBoundLeft ?
      (trayBounds.x + trayBounds.width + 4) : // put it on the right
      (isXOutOfBoundRight ?
        (trayBounds.x - windowBounds.width - 4) : // put it on the right
        bottomPositionStartX); // put it in the middle

    // Position window 4 pixels vertically below the tray icon
    const y = isXOutOfBoundLeft || isXOutOfBoundRight ?
      Math.round(trayBounds.y + (trayBounds.height / 2) - (windowBounds.height / 2)) :
      (isTrayAtBottomHalf ?
        Math.round(trayBounds.y + trayBounds.height + 4) :
        Math.round(trayBounds.y - 4 - windowBounds.height));

      console.log({ x, y });

    return { x, y, isOnTop: isBottomOutOfScreenBoundsY };
}

function runDevUtilsIfNeeded() {
  const isDev = require('electron-is-dev');

  if (isDev) {
    console.log('Running in development');
    // require('electron-css-reload')();
  } else {
    console.log('Running in production');
  }
}
