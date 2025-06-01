const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const { SerialPort } = require('serialport')

// Keep a global reference of the window object to prevent garbage collection
let mainWindow

function createWindow() {
    // If first time install on windows, do not run application
    if (require('electron-squirrel-startup')) app.quit();

    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            sandbox: false  // Required for MIDI access
        }
    })

    // Add MIDI permission handlers
    mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
        if (permission === 'midi' || permission === 'midiSysex') {
            callback(true);
        } else {
            callback(false);
        }
    });

    mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission) => {
        if (permission === 'midi' || permission === 'midiSysex') {
            return true;
        }
        return false;
    });

    // Load the index.html file
    mainWindow.loadFile('index.html')

    // Handle window being closed
    mainWindow.on('closed', function () {
        mainWindow = null
    })
}

// Create window when Electron is ready
app.whenReady().then(createWindow)

// Quit when all windows are closed
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', function () {
    if (mainWindow === null) {
        createWindow()
    }
})
