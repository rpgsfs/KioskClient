// Modules to control application life and create native browser window
const {app, BrowserWindow} = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const killProc = require('tree-kill')

let childProcess = false;

// Triggers the given Forge Viewer extensions to be loaded by the Forge viewer
// in the given window
function loadViewerExtensions(win, extensions) {
  console.log('loading ' + extensions + ' on ' + win)
  win.webContents.executeJavaScript(
    '_rpgsfs_ei_extensions = ' + JSON.stringify(extensions)
  )
}

function start() {

  // create the windows and have them load the website

  let baseURL = 'http://localHost:50717/'

  let selectorWindow = createWindow(1, 'viewerPreload.js')
  selectorWindow.loadURL(baseURL)

  let sideWindow1 = createWindow(2, 'viewerPreload.js')
  let viewerWindow = createWindow(3, 'viewerPreload.js')
  let sideWindow2 = createWindow(4, 'viewerPreload.js')

  for (let win of [sideWindow1, viewerWindow, sideWindow2]) {
    win.loadURL(baseURL + 'viewer.html');
    loadViewerExtensions(win, [
      'RPGSFS.Arpoge.HeadTracking',
      'RPGSFS.Arpoge.ViewControls'
    ]);
  }

  // set up the position and orientation of the virtual windows and virtual
  // kinects to match the real world

  let monitorWidth = 940;

  let kinectX = monitorWidth * 3 / 4;
  let kinectY = 0;
  let kinectZ = monitorWidth * Math.sqrt(3) / 4;

  let sideX = 8 * 3 / 4;
  let sideY = 8 * Math.sqrt(3) / 4;

  setViewerSettings(sideWindow1, {
    windowPos: {x: -sideX, y: sideY, z: 0},
    windowTarget: {x: 0, y: 0, z: 0},
    kinectPos: {x: kinectX, y: kinectY, z: kinectZ},
    kinectLook: {x: 0, y: .5, z: 0, w: Math.sqrt(3) / 2}
  });

  setViewerSettings(sideWindow2, {
    windowPos: {x: sideX, y: sideY, z: 0},
    windowTarget: {x: 0, y: 0, z: 0},
    kinectPos: {x: -kinectX, y: kinectY, z: kinectZ},
    kinectLook: {x: 0, y: -.5, z: 0, w: Math.sqrt(3) / 2}
  });

  connectViews(
    selectorWindow,
    [viewerWindow, sideWindow1, sideWindow2],
    [viewerWindow, sideWindow1, sideWindow2],
    [viewerWindow]
  );

  childProcess = linkToKinect([viewerWindow, sideWindow1, sideWindow2]);
}

// Overrides the default settings for the position and orientation of the
// virtual window and virtual kinect within the virtual world
function setViewerSettings(viewer, settings) {
  viewer.webContents.executeJavaScript(
    'if (!window["_rpgsfs_viewer_settings"])\n' +
    ' _rpgsfs_viewer_settings = {};\n' +
    'Object.assign(_rpgsfs_viewer_settings, ' + JSON.stringify(settings) + ');'
  );
}

// Creates a fullscreen window on the given screen and then loads the given
// javascript code within it
function createWindow(screen, preload) {
  let window = new BrowserWindow({
    x: screen * 1920 + 10,
    y: 100,
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, preload)
    }
  })

  window.setFullScreen(true)

  return window;
}

// Makes the view windows (the ones being displayed on the big monitors) respond
// to the controls on the selector window (the one being displayed on the small
// monitor)
function connectViews(selectorWindow, viewersToLaunch, outerModelViewers, innerModelViewers) {
  // Listens for console.log output in the js console of the selector window
  selectorWindow.webContents.on('console-message',
    (event, level, message, line, sourceId) => {
      if (message === "Launching Viewer") {
        // "Launching Viewer" was printed
        for (let window of viewersToLaunch)
          window.webContents.executeJavaScript('launchViewer()');
      } else {
        let parts = message.split(':')
        if (parts.length === 3) {
          let type = parts.shift()
          let params = "('" + parts.join("', '") + "')"
          switch (type) {
            case 'Loading Outer Model':
              // "Loading Outer Model [urn]:[viewableid]" was printed
              for (let window of outerModelViewers)
                window.webContents.executeJavaScript('loadOuterModel' + params)
              break
            case 'Loading Inner Model':
              // "Loading Inner Model [urn]:[viewableid]" was printed
              for (let window of innerModelViewers)
                window.webContents.executeJavaScript('loadInnerModel' + params)
              break
          }
        }
      }
    }
  );
}

// Makes the given viewers respond to the motion controls
function linkToKinect(viewers) {
  // Launch a script to listen for motion controls
  const child = spawn('kinectData.bat');

  // Buffer to store incoming data from the standard out stream of the script
  var stdOutBuffer = "";
  child.stdout.on('data', data => {
    // Append the new data to the end of the buffer
    stdOutBuffer = stdOutBuffer.concat(data);

    // Parse and process any complete commands from the beginning of the buffer
    // "asdf_START_jkl_END_zxcv" would get parsed as
    // ["asdf", "_START_", "jkl", "_END_", "zxcv"]
    var parts = stdOutBuffer.split(/(_START_|_END_|_KEEPALIVE_)/);
    while(parts.length > 1) {
      // Pop out the beginning of the buffer, up to the first tag
      var command = parts.splice(0, 2);

      // Anything preceding an _END_ tag is treated as data and passed to the
      // viewers
      if ('_END_' == command[1])
        for (let viewer of viewers)
          viewer.webContents
            .executeJavaScript("_rpgsfs_ei_acceptData('" + command[0] + "')")

      // _KEEPALIVE_ tags are removed, and the data preceding them is joined
      // with the data after them to be reprocessed
      else if ('_KEEPALIVE_' == command[1])
      {
        child.stdin.write('keepalive\n');
        parts[0] = parts[0].concat(command[0])
      }

      // Anything preceding a _START_ tag is ignored
      else
      {
        // do nothing
      }
    }
    stdOutBuffer = parts[0];
  });

  return child;
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', start)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  if (childProcess)
    killProc(childProcess.pid, 'SIGHUP', console.log)
  app.quit();
})
