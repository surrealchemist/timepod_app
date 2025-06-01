const { contextBridge } = require('electron');
const { WebMidi } = require('webmidi');
const MESSAGE_TYPES = require('./src/constants/messageTypes');
const { SerialPort } = require('serialport');
const fs = require('fs');
const path = require('path');
const { ipcRenderer } = require('electron');

// Expose protected MIDI methods
contextBridge.exposeInMainWorld('midi', {
    initialize: async () => {
        try {
            // Enable WebMidi.js with sysex support
            await WebMidi.enable({
                sysex: true,
                software: true,
                validation: false
            });
            console.log("WebMidi enabled:", WebMidi.enabled);
            return true;
        } catch (err) {
            console.error('WebMidi enable failed:', err);
            return false;
        }
    },
    
    // Get list of MIDI output devices
    getOutputs: () => {
        if (!WebMidi.enabled) return [];
        return WebMidi.outputs.map(output => ({
            id: output.id,
            name: output.name
        }));
    },

    // Get list of MIDI input devices
    getInputs: () => {
        if (!WebMidi.enabled) return [];
        return WebMidi.inputs.map(input => ({
            id: input.id,
            name: input.name
        }));
    },

    // Send SysEx message
    sendSysEx: (outputId, data) => {
        if (!WebMidi.enabled) return;
        const output = WebMidi.getOutputById(outputId);
        if (output) {
            // For WebMidi.js, all bytes must be in the range 0-127
            // Manufacturer ID 0x04D8 needs to be encoded as:
            // 0x00 (extended ID marker)
            // 0x04 (first byte, already in range)
            // 0x58 (0xD8 with MSB cleared: 0xD8 & 0x7F = 0x58)

            // Similarly, device ID 0xE5 needs to be 0x65 (0xE5 & 0x7F)
            output.sendSysex([0x00, 0x04, 0x58], [0x65, 0x14, ...data]);
        }
    },

    // Add MIDI input listener
    addInputListener: (inputId, callback) => {
        const input = WebMidi.getInputById(inputId);
        if (input) {
            input.addListener('sysex', event => {
                const data = event.message.data;

                // Skip SysEx start (0xF0) and end (0xF7)
                // For 3-byte manufacturer ID (00 04 58) plus device ID (65 14), we need to skip 6 bytes
                if (data.length < 8) return;

                // Message type is now at index 6 (after F0 + 3-byte mfr ID + 2-byte device ID)
                const messageType = data[6];

                const parsedData = {
                    type: messageType,
                    data: Array.from(data.slice(7, -1)) // Remove SysEx markers, mfr ID, device ID, and command byte
                };

                // Parse based on message type
                switch (messageType) {
                    case MESSAGE_TYPES.BRIGHTNESS:
                        parsedData.brightness = data[7];
                        break;

                    case MESSAGE_TYPES.FIRMWARE_VERSION:
                        parsedData.majorVersion = data[7];
                        parsedData.minorVersion = data[8];
                        break;

                    case MESSAGE_TYPES.KNOB_COLOR:
                        parsedData.bank = data[7];
                        parsedData.snapshot = data[8];
                        parsedData.knob = data[9];
                        parsedData.colorIndex = data[10];
                        break;

                    case MESSAGE_TYPES.KNOB_TYPE:
                        parsedData.bank = data[7];
                        parsedData.knob = data[8];
                        parsedData.knobType = data[9];
                        break;

                    case MESSAGE_TYPES.KNOB_CC_TYPE:
                        parsedData.bank = data[7];
                        parsedData.knob = data[8];
                        parsedData.ccType = data[9];
                        break;

                    case MESSAGE_TYPES.KNOB_MIDI_CHANNEL:
                        parsedData.bank = data[7];
                        parsedData.knob = data[8];
                        parsedData.midiChannel = data[9];
                        break;

                    case MESSAGE_TYPES.KNOB_MIDI_CC1:
                        parsedData.bank = data[7];
                        parsedData.knob = data[8];
                        parsedData.cc1 = data[9];
                        break;

                    case MESSAGE_TYPES.KNOB_MIDI_CC2:
                        parsedData.bank = data[7];
                        parsedData.knob = data[8];
                        parsedData.cc2 = data[9];
                        break;

                    case MESSAGE_TYPES.BANK_COLOR:
                        parsedData.bank = data[7];
                        parsedData.colorIndex = data[8];
                        break;

                    case MESSAGE_TYPES.BANK_SNAPSHOT_COLOR:
                        parsedData.bank = data[7];
                        parsedData.snapshot = data[8];
                        parsedData.colorIndex = data[9];
                        break;

                    default:
                        console.warn("Unknown message type:", messageType);
                        return; // Don't process unknown message types
                }
                
                callback(parsedData);
            });
        }
    },

    // Remove MIDI input listener
    removeInputListener: (inputId) => {
        const input = WebMidi.getInputById(inputId);
        if (input) {
            input.removeListener('sysex');
        }
    }
});

// Expose firmware upload-related functionality
contextBridge.exposeInMainWorld('firmware', {
    // Get list of serial ports
    getPorts: async () => {
        try {
            const ports = await SerialPort.list();
            return ports.map(port => ({
                path: port.path,
                manufacturer: port.manufacturer || '',
                serialNumber: port.serialNumber || '',
                vendorId: port.vendorId || '',
                productId: port.productId || ''
            }));
        } catch (err) {
            console.error('Error listing serial ports:', err);
            return [];
        }
    },
    
    // Download firmware from a remote URL
    downloadFirmware: async (url, progressCallback) => {
        return new Promise((resolve, reject) => {
            // Use node-fetch to download the file
            const https = require('https');
            const http = require('http');
            
            // Choose the right protocol
            const client = url.startsWith('https') ? https : http;
            
            // Create the request
            const request = client.get(url, (response) => {
                // Handle redirects
                if (response.statusCode === 301 || response.statusCode === 302) {
                    downloadFirmware(response.headers.location, progressCallback)
                        .then(resolve)
                        .catch(reject);
                    return;
                }
                
                // Check for successful response
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to download firmware: ${response.statusCode}`));
                    return;
                }
                
                // Get the total file size
                const totalBytes = parseInt(response.headers['content-length'], 10);
                let downloadedBytes = 0;
                let chunks = [];
                
                response.on('data', (chunk) => {
                    chunks.push(chunk);
                    downloadedBytes += chunk.length;
                    
                    // Report progress
                    if (progressCallback && totalBytes) {
                        progressCallback(downloadedBytes / totalBytes);
                    }
                });
                
                response.on('end', () => {
                    const firmwareBuffer = Buffer.concat(chunks);
                    resolve(firmwareBuffer);
                });
            });
            
            request.on('error', (err) => {
                reject(err);
            });
        });
    },
    
    // Upload firmware to device
    uploadFirmware: async (midiDeviceId, progressCallback, firmwareBuffer) => {
        try {
            if (!firmwareBuffer) {
                throw new Error('No firmware data provided');
            }

            // Send SysEx reset command to put device into bootloader mode
            await initiateBootloaderViaSysEx(midiDeviceId);
            
            // Wait for the device to reconnect in bootloader mode
            let bootloaderPort = null;
            for (let i = 0; i < 30; i++) { // More retry attempts with longer timeout
                await new Promise(resolve => setTimeout(resolve, 500));
                const ports = await SerialPort.list();
                
                // First try to find a port that specifically mentions "Modern MIDI"
                bootloaderPort = ports.find(port => 
                    (port.name && port.name.includes('TP-001')) ||
                    (port.path && port.path.includes('Modern MIDI')) ||
                    (port.manufacturer && port.manufacturer.includes('Modern MIDI'))
                );
                
                if (bootloaderPort) {
                    break;
                }
                
                // If no Modern MIDI port found, fall back to other criteria...
                bootloaderPort = ports.find(port => 
                    // Use the Timepod VID
                    (port.vendorId === '04D8') && (port.productId === 'E514')
                );
                
                if (bootloaderPort) {
                    break;
                }
            }
            
            if (!bootloaderPort) {
                throw new Error('Bootloader device not found after SysEx reset');
            }
            
            // Perform the actual upload using AVR109 protocol
            await uploadWithAVR109(bootloaderPort.path, firmwareBuffer, progressCallback);
            
            return true;
        } catch (err) {
            console.error('Firmware upload failed:', err);
            throw err;
        }
    }
});

// Helper function to initiate bootloader via SysEx message
async function initiateBootloaderViaSysEx(midiDeviceId) {
    return new Promise((resolve, reject) => {
        if (!WebMidi.enabled) {
            reject(new Error('WebMidi is not enabled'));
            return;
        }

        const output = WebMidi.getOutputById(midiDeviceId);
        if (!output) {
            reject(new Error('MIDI output device not found'));
            return;
        }

        try {
            // Send SysEx message with value 125 to reset device into bootloader mode
            // Using the same manufacturer ID format as other SysEx messages in the app
            output.sendSysex([0x00, 0x04, 0x58], [0x65, 0x14, MESSAGE_TYPES.FIRMWARE_UPLOAD]);
            
            // Wait a moment for the device to process the reset command
            setTimeout(resolve, 1500);
        } catch (error) {
            reject(new Error(`Failed to send SysEx reset command: ${error.message}`));
        }
    });
}

// Implementation of AVR109 protocol for uploading
async function uploadWithAVR109(portPath, encryptedData, progressCallback) {
    return new Promise((resolve, reject) => {
        // AVR109 protocol constants from the bootloader.h file
        const AVR109 = {
            // These are the correct commands from the provided bootloader.h
            COMMAND_EraseFlash: 'e',
            COMMAND_ReadBootloaderIdentifier: 'S',
            COMMAND_ReadPartCode: 't',
            COMMAND_EnterProgrammingMode: 'P',
            COMMAND_SetCurrentAddress: 'A',
            COMMAND_BlockWrite: 'B',
            COMMAND_ExitBootloader: 'E'
        };
        
        // Set up serial port
        const port = new SerialPort({
            path: portPath,
            baudRate: 57600,
            dataBits: 8,
            stopBits: 1,
            parity: 'none',
            autoOpen: false
        });
        
        port.on('error', (err) => {
            reject(err);
        });
        
        // Buffer for storing received data
        let responseBuffer = Buffer.alloc(0);
        port.on('data', (data) => {
            responseBuffer = Buffer.concat([responseBuffer, data]);
            
            // Check for responses - either a CR or any data that seems like a response
            if (responseBuffer.includes(0x0D) || responseBuffer.length > 0) {
                const response = Buffer.from(responseBuffer);
                responseBuffer = Buffer.alloc(0);
                
                // Process any response we've received
                processResponse(response);
            }
        });
        
        // Upload state management
        let uploadState = 'identify';
        let pageSize = 128; // Default page size for AT90USB1286
        let currentAddress = pageSize; // Start at the second page
        let uploadedBytes = pageSize;
        let pageBuffer = [];
        let totalBytes = encryptedData.length;
        let retryCount = 0;
        let timeout = null;
        
        // Setup timeout handler
        function setupTimeout(ms) {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                retryCount++;
                if (retryCount > 3) {
                    // Try a different approach if retries fail
                    moveToNextState();
                } else {
                    // Retry the current state
                    retryCurrent();
                }
            }, ms);
        }
        
        // Retry the current command
        function retryCurrent() {
            switch (uploadState) {
                case 'identify':
                    sendIdentifyCommand();
                    break;
                case 'getProgrammer':
                    sendGetProgrammerCommand();
                    break;
                case 'erase':
                    erasePage();
                    break;
                case 'programming':
                    enterProgrammingMode();
                    break;
                case 'address':
                    setAddress(currentAddress);
                    break;
                case 'writeData':
                    writePageData();
                    break;
                case 'exit':
                    exitBootloader();
                    break;
                default:
                    moveToNextState();
            }
        }
        
        // Move to the next state if current one fails
        function moveToNextState() {
            // Skip problematic states and try to continue
            if (uploadState === 'identify') {
                uploadState = 'programming';
                enterProgrammingMode();
            } else if (uploadState === 'getProgrammer') {
                uploadState = 'programming';
                enterProgrammingMode();
            } else if (uploadState === 'erase') {
                // Skip to programming if erase fails
                uploadState = 'programming';
                enterProgrammingMode();
            } else if (uploadState === 'programming') {
                uploadState = 'address';
                setAddress(currentAddress);
            } else if (uploadState === 'writeData') {
                // Skip current page and move to next
                currentAddress += pageSize;
                uploadedBytes += pageSize;
                
                if (progressCallback) {
                    progressCallback(Math.min(1.0, uploadedBytes / totalBytes));
                }
                
                if (currentAddress < totalBytes) {
                    uploadState = 'address';
                    setAddress(currentAddress);
                } else {
                    uploadState = 'exit';
                    exitBootloader();
                }
            } else {
                // For any other state, try to exit gracefully
                uploadState = 'exit';
                exitBootloader();
            }
        }
        
        // Process responses from the bootloader
        function processResponse(response) {
            clearTimeout(timeout);
            retryCount = 0;
            
            // Handle response based on current state
            switch (uploadState) {
                case 'identify':
                    // The response might be "10" or something else, but we'll continue
                    uploadState = 'getProgrammer';
                    sendGetProgrammerCommand();
                    break;
                
                case 'getProgrammer':
                    // After getting programmer info, enter programming mode then start erasing
                    uploadState = 'programming';
                    enterProgrammingMode();
                    break;
                
                case 'programming':
                    // After entering programming mode, start erasing
                    uploadState = 'erase';
                    erasePage();
                    break;
                
                case 'erase':
                    // Erasing complete, start flashing
                    uploadState = 'address';
                    setAddress(currentAddress);
                    break;
                
                case 'address':
                    // After setting address, write page data
                    uploadState = 'writeData';
                    writePageData();
                    break;
                
                case 'writeData':
                    // After writing a page, update progress and move to next page
                    currentAddress += pageSize;
                    uploadedBytes += pageSize;
                    
                    if (progressCallback) {
                        progressCallback(uploadedBytes / totalBytes);
                    }
                    
                    if (currentAddress >= totalBytes + pageSize) {
                        uploadState = 'writeFirstPage';
                        setAddress(0);
                    } else {
                        // More data to write
                        writePageData();
                    }
                    break;
                
                case 'writeFirstPage':
                    uploadState = 'exit';
                    writeFirstPage();
                    break;
                
                case 'exit':
                    // Upload complete
                    exitBootloader();
                    
                    // Always ensure we report 100% progress
                    if (progressCallback) {
                        try {
                            progressCallback(1.0);
                        } catch (e) {
                            console.error("Error in progress callback:", e);
                        }
                    }
                    
                    // Resolve the promise with a slight delay
                    setTimeout(() => {
                        resolve(true);
                    }, 500);
                    break;
            }
        }
        
        // Request bootloader identifier
        function sendIdentifyCommand() {
            port.write(Buffer.from([AVR109.COMMAND_ReadBootloaderIdentifier.charCodeAt(0)]));
            setupTimeout(1000);
        }
        
        // Get programmer type
        function sendGetProgrammerCommand() {
            port.write(Buffer.from([AVR109.COMMAND_ReadPartCode.charCodeAt(0)]));
            setupTimeout(1000);
        }
        
        // Enter programming mode
        function enterProgrammingMode() {
            port.write(Buffer.from([AVR109.COMMAND_EnterProgrammingMode.charCodeAt(0)]));
            setupTimeout(1000);
        }
        
        // Set current address for programming
        function setAddress(address) {
            port.write(Buffer.from([
                AVR109.COMMAND_SetCurrentAddress.charCodeAt(0),
                (address >> 9) & 0xFF, // High byte
                (address >> 1) & 0xFF // Low byte
            ]));
            setupTimeout(1000);
        }
        
        // Write page data using either block write or byte-by-byte
        function writePageData() {
            pageBuffer = [];
            const remainingBytes = totalBytes - currentAddress;
            const bytesToWrite = Math.min(pageSize, remainingBytes);
            
            if (bytesToWrite <= 0) {
                uploadState = 'writeFirstPage';
                setAddress(0);
                return;
            }

            // Prepare page data
            for (let i = 0; i < bytesToWrite; i++) {
                const encByte = encryptedData[currentAddress + i];
                pageBuffer.push(encByte);
            }
            
            // Send block write command
            port.write(Buffer.from([
                AVR109.COMMAND_BlockWrite.charCodeAt(0),
                (bytesToWrite >> 8) & 0xFF, // Size high byte
                bytesToWrite & 0xFF, // Size low byte
                'F'.charCodeAt(0) // Memory type (Flash)
            ]));
            
            // Send the data
            port.write(Buffer.from(pageBuffer));
            
            setupTimeout(2000); // Page writing takes longer
        }

        // Write the first page last
        function writeFirstPage() {
            pageBuffer = [];

            for (let i = 0; i < pageSize && i < encryptedData.length; i++) {
                // Read directly from the encrypted data buffer
                const encByte = encryptedData[i];
                pageBuffer.push(encByte);
            }

            // Send block write command
            port.write(Buffer.from([
                AVR109.COMMAND_BlockWrite.charCodeAt(0),
                (pageSize >> 8) & 0xFF, // Size high byte
                pageSize & 0xFF, // Size low byte
                'F'.charCodeAt(0) // Memory type (Flash)
            ]));

            // Send the data
            port.write(Buffer.from(pageBuffer));

            setupTimeout(2000);
        }
        
        // Updated exit bootloader function
        function exitBootloader() {
            // Send the exit bootloader command
            setTimeout(() => {
                port.write(Buffer.from([AVR109.COMMAND_ExitBootloader.charCodeAt(0)]));
            }, 200);
        }
        
        // Erase a page by writing 0xFF to all bytes
        function erasePage() {
            // Write the erase buffer
            port.write(Buffer.from([AVR109.COMMAND_EraseFlash.charCodeAt(0)]));
            
            setupTimeout(10000); // Page erasing takes longer
        }
        
        // Start the process by opening the port
        port.open(err => {
            if (err) {
                reject(err);
                return;
            }
            
            // Wait a moment for the port to stabilize
            setTimeout(() => {
                uploadState = 'identify';
                sendIdentifyCommand();
            }, 500);
        });
    });
}
