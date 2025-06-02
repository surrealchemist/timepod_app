import React, { useState, useEffect } from 'react';
import Grid from './components/Grid';
import Sidebar from './components/Sidebar';
import ButtonRow from './components/ButtonRow';
import BankSelector from './components/BankSelector';
import './styles.css';
import midiService from './services/midiService';
import firmwareService from './services/firmwareService';

const MESSAGE_TYPES = require('./constants/messageTypes');

const App = () => {
    const [selectedPad, setSelectedPad] = useState(null);
    const [selectedButton, setSelectedButton] = useState(null);
    const [lastSelectedButton, setLastSelectedButton] = useState(0);
    const [currentBank, setCurrentBank] = useState(0);
    const [brightness, setBrightness] = useState(100);
    const [activeTab, setActiveTab] = useState('global');
    const [midiOutputs, setMidiOutputs] = useState([]);
    const [midiInputs, setMidiInputs] = useState([]);
    const [selectedMidiOutput, setSelectedMidiOutput] = useState(null);
    const [selectedMidiInput, setSelectedMidiInput] = useState(null);
    const [serialPorts, setSerialPorts] = useState([]);
    const [selectedPort, setSelectedPort] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [appVersion, setAppVersion] = useState({ major: 0, minor: 2 });
    const [firmwareVersion, setFirmwareVersion] = useState({ major: null, minor: null });
    
    // Remote firmware state
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isRemoteDownloaded, setIsRemoteDownloaded] = useState(false);

    // Add a new state variable to track upload completion
    const [uploadComplete, setUploadComplete] = useState(false);

    // Use useRef to prevent race conditions in timeouts
    const [uploadTimeoutRef, setUploadTimeoutRef] = useState(null);

    const [banks, setBanks] = useState(Array(8).fill().map(() => ({
        padStates: Array(16).fill().map((_, index) => ({
            colorIndices: Array(8).fill(51),
            useSingleColor: true,
            channel: 1,
            cc: 0,
            ccLsb: 32,
            ccType: 'standard7',
            displayMode: 'fill'
        })),
        snapshotStates: Array(8).fill().map(() => ({
            colorIndex: 51,
        })),
        bankColor: 51,
        useSingleSnapshotColor: false,
    })));

    // Add a function to retry MIDI connection
    const retryMidiConnection = async () => {
        const success = await midiService.initialize();
        if (success) {
            const outputs = window.midi.getOutputs();
            const inputs = window.midi.getInputs();

            setMidiOutputs(outputs);
            setMidiInputs(inputs);
            
            // Track if we found a device to sync with
            let foundTimepodOutput = null;
            
            // Set default output if available
            if (outputs.length > 0) {
                // First try to find a Timepod or Modern MIDI output
                const timepodOutput = outputs.find(output => 
                    output.name.includes('TP-001') ||
                    output.name.includes('Modern MIDI')
                );
                
                if (timepodOutput) {
                    setSelectedMidiOutput(timepodOutput.id);
                    midiService.setOutput(timepodOutput.id);
                    foundTimepodOutput = timepodOutput;
                } else {
                    // Don't select any device if no Timepod/Modern MIDI is found
                    setSelectedMidiOutput(null);
                }
            } else {
                setSelectedMidiOutput(null);
            }
            
            // Set default input if available
            if (inputs.length > 0) {
                // First try to find a Timepod or Modern MIDI input
                let timepodInput = inputs.find(input =>
                    input.name.includes('TP-001') ||
                    input.name.includes('Modern MIDI')
                );
                
                if (timepodInput) {
                    setSelectedMidiInput(timepodInput.id);
                    midiService.setInput(timepodInput.id);
                } else {
                    // Don't select any device if no Timepod/Modern MIDI is found
                    setSelectedMidiInput(null);
                }
            } else {
                setSelectedMidiInput(null);
            }

            if (!foundTimepodOutput) {
                // Check for serial ports
                const ports = await window.firmware.getPorts();
                const timepodPort = ports.find(port => port.vendorId === '04D8' && port.productId === 'E514');
                if (timepodPort) {
                    setSelectedMidiInput(timepodPort.path);
                    setSelectedMidiOutput(timepodPort.path);
                }
            }

            // Register message handlers for incoming SysEx
            setupMessageHandlers();

            // Request sync from device - use the foundTimepodOutput variable instead of state
            if (foundTimepodOutput) {
                midiService.sendSyncConfiguration();
            }
        }
    };

    // Initialize MIDI when component mounts
    useEffect(() => {
        retryMidiConnection();
    }, []);

    // Setup message handlers for incoming SysEx messages
    const setupMessageHandlers = () => {
        // Handle brightness updates
        midiService.onMessage(MESSAGE_TYPES.BRIGHTNESS, (data) => {
            setBrightness(data.brightness);
        });

        // Handle firmware version updates
        midiService.onMessage(MESSAGE_TYPES.FIRMWARE_VERSION, (data) => {
            setFirmwareVersion({
                major: data.majorVersion,
                minor: data.minorVersion
            });
        });

        // Handle knob color updates
        midiService.onMessage(MESSAGE_TYPES.KNOB_COLOR, (data) => {
            setBanks(prevBanks => {
                const newBanks = [...prevBanks];
                const { bank, knob, snapshot, colorIndex } = data;

                if (snapshot === 8) { // All snapshots
                    newBanks[bank].padStates[knob].colorIndices = Array(8).fill(colorIndex);
                    newBanks[bank].padStates[knob].useSingleColor = true;
                } else {
                    // Update the specific color
                    newBanks[bank].padStates[knob].colorIndices[snapshot] = colorIndex;

                    // Check if all colors are now the same
                    const allColorsMatch = newBanks[bank].padStates[knob].colorIndices.every(
                        color => color === colorIndex
                    );

                    // Only set useSingleColor to true if all colors match
                    // Otherwise, set it to false because we have different colors
                    newBanks[bank].padStates[knob].useSingleColor = allColorsMatch;
                }

                return newBanks;
            });
        });

        // Handle knob type updates
        midiService.onMessage(MESSAGE_TYPES.KNOB_TYPE, (data) => {
            setBanks(prevBanks => {
                const newBanks = [...prevBanks];
                const { bank, knob, knobType } = data;
                const displayModes = ['fill', 'bipolar', 'pointer'];
                newBanks[bank].padStates[knob].displayMode = displayModes[knobType];
                return newBanks;
            });
        });

        // Handle CC type updates
        midiService.onMessage(MESSAGE_TYPES.KNOB_CC_TYPE, (data) => {
            setBanks(prevBanks => {
                const newBanks = [...prevBanks];
                const { bank, knob, ccType } = data;
                const ccTypes = ['standard7', 'standard14', 'nrpn14'];
                newBanks[bank].padStates[knob].ccType = ccTypes[ccType];
                return newBanks;
            });
        });

        // Handle MIDI channel updates
        midiService.onMessage(MESSAGE_TYPES.KNOB_MIDI_CHANNEL, (data) => {
            setBanks(prevBanks => {
                const newBanks = [...prevBanks];
                const { bank, knob, midiChannel } = data;
                newBanks[bank].padStates[knob].channel = midiChannel + 1;
                return newBanks;
            });
        });

        // Handle CC1 updates
        midiService.onMessage(MESSAGE_TYPES.KNOB_MIDI_CC1, (data) => {
            setBanks(prevBanks => {
                const newBanks = [...prevBanks];
                const { bank, knob, cc1 } = data;
                newBanks[bank].padStates[knob].cc = cc1;
                return newBanks;
            });
        });

        // Handle CC2 updates
        midiService.onMessage(MESSAGE_TYPES.KNOB_MIDI_CC2, (data) => {
            setBanks(prevBanks => {
                const newBanks = [...prevBanks];
                const { bank, knob, cc2 } = data;
                newBanks[bank].padStates[knob].ccLsb = cc2;
                return newBanks;
            });
        });

        // Handle bank color updates
        midiService.onMessage(MESSAGE_TYPES.BANK_COLOR, (data) => {
            setBanks(prevBanks => {
                const newBanks = [...prevBanks];
                const { bank, colorIndex } = data;
                newBanks[bank].bankColor = colorIndex;
                return newBanks;
            });
        });

        // Handle bank snapshot color updates
        midiService.onMessage(MESSAGE_TYPES.BANK_SNAPSHOT_COLOR, (data) => {
            setBanks(prevBanks => {
                const newBanks = [...prevBanks];
                const { bank, snapshot, colorIndex } = data;
                
                if (snapshot === 8) { // All snapshots
                    newBanks[bank].snapshotStates = newBanks[bank].snapshotStates.map(state => ({
                        ...state,
                        colorIndex
                    }));
                    newBanks[bank].useSingleSnapshotColor = true;
                } else {
                    // Update the specific snapshot color
                    newBanks[bank].snapshotStates[snapshot].colorIndex = colorIndex;

                    // Check if all snapshot colors are now the same
                    const allColorsMatch = newBanks[bank].snapshotStates.every(
                        state => state.colorIndex === colorIndex
                    );

                    // Only set useSingleSnapshotColor to true if all colors match
                    // Otherwise, set it to false because we have different colors
                    newBanks[bank].useSingleSnapshotColor = allColorsMatch;
                }
                
                return newBanks;
            });
        });
    };

    // Handle MIDI input/output selection
    const handleMidiOutputChange = (outputId) => {
        setSelectedMidiOutput(outputId);
        midiService.setOutput(outputId);
        
        // Request sync from device when output changes
        if (outputId) {
            midiService.sendSyncConfiguration();
        }
    };

    const handleMidiInputChange = (inputId) => {
        setSelectedMidiInput(inputId);
        midiService.setInput(inputId);
    };

    const handleColorChange = (id, colorIndex, type, colorPosition) => {
        if (type === 'pad') {
            setBanks(prevBanks => {
                const newBanks = [...prevBanks];
                const pad = newBanks[currentBank].padStates[id];
                newBanks[currentBank] = {
                    ...newBanks[currentBank],
                    padStates: newBanks[currentBank].padStates.map((pad, index) =>
                        index === id ? {
                            ...pad,
                            colorIndices: pad.useSingleColor 
                                ? Array(8).fill(colorIndex)
                                : pad.colorIndices.map((ci, i) => 
                                    i === colorPosition ? colorIndex : ci
                                )
                        } : pad
                    )
                };
                
                // Send MIDI update
                if (pad.useSingleColor) {
                    midiService.sendKnobColorAllChange(currentBank, id, colorIndex);
                } else {
                    midiService.sendKnobColorChange(currentBank, id, colorPosition, colorIndex);
                }
                
                return newBanks;
            });
        } else if (type === 'button') {
            setBanks(prevBanks => {
                const newBanks = [...prevBanks];
                newBanks[currentBank] = {
                    ...newBanks[currentBank],
                    snapshotStates: newBanks[currentBank].useSingleSnapshotColor
                        ? newBanks[currentBank].snapshotStates.map(button => ({
                            ...button,
                            colorIndex
                        }))
                        : newBanks[currentBank].snapshotStates.map((button, index) =>
                            index === colorPosition ? { ...button, colorIndex } : button
                        )
                };
                
                // Send MIDI update
                if (newBanks[currentBank].useSingleSnapshotColor) {
                    midiService.sendSnapshotColorAllChange(currentBank, colorIndex);
                } else {
                    midiService.sendSnapshotColorChange(currentBank, id, colorIndex);
                }
                
                return newBanks;
            });
        }
    };

    const handleChannelChange = (id, channel) => {
        // Allow empty string
        if (channel === '') {
            setBanks(prevBanks => {
                const newBanks = [...prevBanks];
                newBanks[currentBank] = {
                    ...newBanks[currentBank],
                    padStates: newBanks[currentBank].padStates.map((pad, index) =>
                        index === id ? { ...pad, channel: '' } : pad
                    )
                };
                return newBanks;
            });
            return;
        }

        // Convert to number and validate
        const value = Number(channel);
        if (isNaN(value)) return;
        
        // Return early if out of bounds
        if (value < 1 || value > 16) return;
        
        // Strip leading zeros by converting to string
        const strippedChannel = value.toString();
        
        setBanks(prevBanks => {
            const newBanks = [...prevBanks];
            newBanks[currentBank] = {
                ...newBanks[currentBank],
                padStates: newBanks[currentBank].padStates.map((pad, index) =>
                    index === id ? { ...pad, channel: strippedChannel } : pad
                )
            };
            
            // Send MIDI update
            midiService.sendKnobMidiChannel(currentBank, id, Number(strippedChannel));
            
            return newBanks;
        });
    };

    const handleCcChange = (id, cc) => {
        // Allow empty string
        if (cc === '') {
            setBanks(prevBanks => {
                const newBanks = [...prevBanks];
                newBanks[currentBank] = {
                    ...newBanks[currentBank],
                    padStates: newBanks[currentBank].padStates.map((pad, index) =>
                        index === id ? { ...pad, cc: '' } : pad
                    )
                };
                return newBanks;
            });
            return;
        }

        // Convert to number and validate
        const value = Number(cc);
        if (isNaN(value)) return;
        
        // Return early if out of bounds
        if (value < 0 || value > 127) return;
        
        // Strip leading zeros by converting to string
        const strippedCc = value.toString();
        
        setBanks(prevBanks => {
            const newBanks = [...prevBanks];
            const padState = newBanks[currentBank].padStates[id];
            const isStandard14 = padState.ccType === 'standard14';

            // For standard14, calculate LSB as MSB+32, clamped to 0-127
            const ccLsb = isStandard14 ?
                Math.min(127, Math.max(0, value + 32)).toString() :
                padState.ccLsb;

            newBanks[currentBank] = {
                ...newBanks[currentBank],
                padStates: newBanks[currentBank].padStates.map((pad, index) =>
                    index === id ? { ...pad, cc: strippedCc, ...(isStandard14 ? { ccLsb } : {}) } : pad
                )
            };

            // Send MIDI update
            midiService.sendKnobMidiCC1(currentBank, id, Number(strippedCc));

            // If standard14, also update the LSB
            if (isStandard14) {
                midiService.sendKnobMidiCC2(currentBank, id, Number(ccLsb));
            }

            return newBanks;
        });
    };

    const handleChannelBlur = (id, channel) => {
        if (channel === '') {
            handleChannelChange(id, 1);
            return;
        }
        if (channel < 1) {
            handleChannelChange(id, 1);
        }
        if (channel > 16) {
            handleChannelChange(id, 16);
        }
    };

    const handleCcBlur = (id, cc) => {
        if (cc === '') {
            handleCcChange(id, 0);
            return;
        }
        if (cc < 0) {
            handleCcChange(id, 0);
        }
        if (cc > 127) {
            handleCcChange(id, 127);
        }
    };

    const handlePadSelect = (pad) => {
        setSelectedPad(pad);
        setActiveTab('knob');
        setSelectedButton(null);
    };

    const handleButtonSelect = (button) => {
        setSelectedButton(button);
        setLastSelectedButton(button);
        setActiveTab('knob');
        setSelectedPad(null);
    };

    const handleCcTypeChange = (id, ccType) => {
        setBanks(prevBanks => {
            const newBanks = [...prevBanks];
            const padState = newBanks[currentBank].padStates[id];

            // If changing to standard14, calculate LSB as MSB+32
            let ccLsb = padState.ccLsb;
            if (ccType === 'standard14') {
                const ccValue = Number(padState.cc);
                ccLsb = Math.min(127, Math.max(0, ccValue + 32)).toString();
            }

            newBanks[currentBank] = {
                ...newBanks[currentBank],
                padStates: newBanks[currentBank].padStates.map((pad, index) =>
                    index === id ? { ...pad, ccType, ...(ccType === 'standard14' ? { ccLsb } : {}) } : pad
                )
            };

            // Send MIDI update
            midiService.sendKnobCcTypeChange(currentBank, id, ccType);

            // If changing to standard14, also update the LSB
            if (ccType === 'standard14') {
                midiService.sendKnobMidiCC2(currentBank, id, Number(ccLsb));
            }

            return newBanks;
        });
    };

    const handleCcLsbChange = (id, ccLsb) => {
        // Allow empty string
        if (ccLsb === '') {
            setBanks(prevBanks => {
                const newBanks = [...prevBanks];
                newBanks[currentBank] = {
                    ...newBanks[currentBank],
                    padStates: newBanks[currentBank].padStates.map((pad, index) =>
                        index === id ? { ...pad, ccLsb: '' } : pad
                    )
                };
                return newBanks;
            });
            return;
        }

        // Convert to number and validate
        const value = Number(ccLsb);
        if (isNaN(value)) return;
        
        // Return early if out of bounds
        if (value < 0 || value > 127) return;
        
        // Strip leading zeros by converting to string
        const strippedCcLsb = value.toString();
        
        setBanks(prevBanks => {
            const newBanks = [...prevBanks];
            newBanks[currentBank] = {
                ...newBanks[currentBank],
                padStates: newBanks[currentBank].padStates.map((pad, index) =>
                    index === id ? { ...pad, ccLsb: strippedCcLsb } : pad
                )
            };
            
            // Send MIDI update
            midiService.sendKnobMidiCC2(currentBank, id, Number(strippedCcLsb));

            return newBanks;
        });
    };

    const handleCcLsbBlur = (id, ccLsb) => {
        if (ccLsb === '') {
            handleCcLsbChange(id, 0);
            return;
        }
        if (ccLsb < 0) {
            handleCcLsbChange(id, 0);
        }
        if (ccLsb > 127) {
            handleCcLsbChange(id, 127);
        }
    };

    const handleUseSingleColorChange = (id, checked) => {
        setBanks(prevBanks => {
            const newBanks = [...prevBanks];
            newBanks[currentBank] = {
                ...newBanks[currentBank],
                padStates: newBanks[currentBank].padStates.map((pad, index) =>
                    index === id ? { ...pad, useSingleColor: checked } : pad
                )
            };

            // Send MIDI update
            if (checked) {
                midiService.sendKnobColorAllChange(currentBank, id, newBanks[currentBank].padStates[id].colorIndices[0]);
            } else {
                // Send MIDI update for all colors
                // Ignore if all color indices are the same
                if (newBanks[currentBank].padStates[id].colorIndices.every(colorIndex => colorIndex === newBanks[currentBank].padStates[id].colorIndices[0])) {
                    return newBanks;
                }
                newBanks[currentBank].padStates[id].colorIndices.forEach((colorIndex, index) => {
                    midiService.sendKnobColorChange(currentBank, id, index, colorIndex);
                });
            }

            return newBanks;
        });
    };

    const handleDisplayModeChange = (id, displayMode) => {
        setBanks(prevBanks => {
            const newBanks = [...prevBanks];
            newBanks[currentBank] = {
                ...newBanks[currentBank],
                padStates: newBanks[currentBank].padStates.map((pad, index) =>
                    index === id ? { ...pad, displayMode } : pad
                )
            };

            // Send MIDI update
            midiService.sendKnobTypeChange(currentBank, id, displayMode);

            return newBanks;
        });
    };

    const handleBankColorChange = (bankIndex, colorIndex) => {
        setBanks(prevBanks => {
            const newBanks = [...prevBanks];
            newBanks[bankIndex] = {
                ...newBanks[bankIndex],
                bankColor: colorIndex
            };

            // Send MIDI update
            midiService.sendBankColorChange(bankIndex, colorIndex);

            return newBanks;
        });
    };

    const handleSnapshotUseSingleColorChange = (checked) => {
        setBanks(prevBanks => {
            const newBanks = [...prevBanks];
            newBanks[currentBank] = {
                ...newBanks[currentBank],
                useSingleSnapshotColor: checked
            };

            // Send MIDI update
            if (checked) {
                midiService.sendSnapshotColorAllChange(currentBank, newBanks[currentBank].snapshotStates[0].colorIndex);
            } else {
                // Send MIDI update for all colors
                // Ignore if all color indices are the same
                if (newBanks[currentBank].snapshotStates.every(button => button.colorIndex === newBanks[currentBank].snapshotStates[0].colorIndex)) {
                    return newBanks;
                }
                newBanks[currentBank].snapshotStates.forEach((button, index) => {
                    midiService.sendSnapshotColorChange(currentBank, index, button.colorIndex);
                });
            }

            return newBanks;
        });
    };

    const handleBrightnessChange = (value) => {
        setBrightness(value);
        // Send MIDI update
        midiService.sendBrightnessUpdate(value);
    };

    const handleCopyColorSettings = (sourceKnobId, targetKnobIds) => {
        if (targetKnobIds.length === 0) return;

        setBanks(prevBanks => {
            const newBanks = [...prevBanks];
            const sourceSettings = newBanks[currentBank].padStates[sourceKnobId];

            targetKnobIds.forEach(targetKnobId => {
                // Update the pad state
                newBanks[currentBank].padStates[targetKnobId] = {
                    ...newBanks[currentBank].padStates[targetKnobId],
                    colorIndices: [...sourceSettings.colorIndices],
                    useSingleColor: sourceSettings.useSingleColor
                };

                // Send appropriate MIDI messages
                if (sourceSettings.useSingleColor) {
                    // Send single color update for all snapshots
                    midiService.sendKnobColorAllChange(currentBank, targetKnobId, sourceSettings.colorIndices[0]);
                } else {
                    // Send individual color updates for each snapshot
                    sourceSettings.colorIndices.forEach((colorIndex, snapshotIndex) => {
                        midiService.sendKnobColorChange(currentBank, targetKnobId, snapshotIndex, colorIndex);
                    });
                }
            });

            return newBanks;
        });
    };

    const handleCopyBankSettings = (sourceBankId, targetBankIds) => {
        if (targetBankIds.length === 0) return;

        setBanks(prevBanks => {
            const newBanks = [...prevBanks];
            const sourceBank = newBanks[sourceBankId];

            targetBankIds.forEach(targetBankId => {
                // Deep copy all bank settings
                newBanks[targetBankId] = {
                    ...newBanks[targetBankId],
                    padStates: sourceBank.padStates.map(pad => ({
                        ...pad,
                        colorIndices: [...pad.colorIndices]
                    })),
                    snapshotStates: sourceBank.snapshotStates.map(snapshot => ({ ...snapshot })),
                    bankColor: sourceBank.bankColor,
                    useSingleSnapshotColor: sourceBank.useSingleSnapshotColor
                };

                // Send MIDI messages for all copied settings
                
                // Copy bank color
                midiService.sendBankColorChange(targetBankId, sourceBank.bankColor);

                // Copy all knob settings
                sourceBank.padStates.forEach((pad, knobId) => {
                    // Copy knob colors
                    if (pad.useSingleColor) {
                        midiService.sendKnobColorAllChange(targetBankId, knobId, pad.colorIndices[0]);
                    } else {
                        pad.colorIndices.forEach((colorIndex, snapshotIndex) => {
                            midiService.sendKnobColorChange(targetBankId, knobId, snapshotIndex, colorIndex);
                        });
                    }

                    // Copy knob MIDI settings
                    midiService.sendKnobMidiChannel(targetBankId, knobId, Number(pad.channel));
                    midiService.sendKnobMidiCC1(targetBankId, knobId, Number(pad.cc));
                    if (pad.ccType !== 'standard7') {
                        midiService.sendKnobMidiCC2(targetBankId, knobId, Number(pad.ccLsb));
                    }
                    midiService.sendKnobCcTypeChange(targetBankId, knobId, pad.ccType);
                    midiService.sendKnobTypeChange(targetBankId, knobId, pad.displayMode);
                });

                // Copy snapshot button settings
                if (sourceBank.useSingleSnapshotColor) {
                    midiService.sendSnapshotColorAllChange(targetBankId, sourceBank.snapshotStates[0].colorIndex);
                } else {
                    sourceBank.snapshotStates.forEach((snapshot, snapshotId) => {
                        midiService.sendSnapshotColorChange(targetBankId, snapshotId, snapshot.colorIndex);
                    });
                }
            });

            return newBanks;
        });
    };
    
    const handleDownloadFirmware = async () => {
        if (isDownloading) return;
        
        try {
            setIsDownloading(true);
            setDownloadProgress(0);
            
            await firmwareService.downloadFirmware((progress) => {
                setDownloadProgress(progress);
            });
            
            // Update the state to mark download as complete
            setIsRemoteDownloaded(true);
            setIsDownloading(false);
            
            // Clear the progress bar after a delay
            setTimeout(() => {
                setDownloadProgress(0);
            }, 3000);
        } catch (error) {
            console.error('Error downloading firmware:', error);
            setIsDownloading(false);
            setIsRemoteDownloaded(false);
            alert(`Firmware download failed: ${error.message}`);
        }
    };
    
    const handleUploadFirmware = async () => {
        if (!selectedMidiOutput || isUploading) {
            return;
        }
        
        // Make sure firmware is downloaded first
        if (!isRemoteDownloaded) {
            alert('Please download the firmware first');
            return;
        }
        
        // Clear any existing timeouts
        if (uploadTimeoutRef) {
            clearTimeout(uploadTimeoutRef);
        }
        
        try {
            // Reset states at the beginning
            setUploadComplete(false);
            setIsUploading(true);
            setUploadProgress(0);
            
            await firmwareService.uploadFirmware(
                selectedMidiOutput,
                (progress) => {
                    setUploadProgress(progress);
                    
                    // If we reached 100%, prepare to mark as complete
                    if (progress >= 0.99) {
                        // Set a completion timeout if none exists
                        if (!uploadTimeoutRef) {
                            const timeoutId = setTimeout(() => {
                                setIsUploading(false);
                                setUploadComplete(true);
                                // Clear progress after a delay
                                setTimeout(() => {
                                    setUploadProgress(0);
                                }, 3000);
                            }, 1000);
                            
                            setUploadTimeoutRef(timeoutId);
                        }
                    }
                }
            );
            
            // Force progress to 100% for good measure
            setUploadProgress(1);
            
            // If we somehow made it here without the timeout firing, force completion
            if (!uploadTimeoutRef) {
                setIsUploading(false);
                setUploadComplete(true);
                
                // Clear progress after a delay
                setTimeout(() => {
                    setUploadProgress(0);
                }, 3000);
            }
        } catch (error) {
            console.error('Error uploading firmware:', error);
            setIsUploading(false);
            setUploadComplete(false);
            alert(`Firmware upload failed: ${error.message}`);
        }
    };

    // Pass these new props to the Sidebar component
    const sidebarProps = {
        selectedPad,
        selectedButton,
        padStates: banks[currentBank].padStates,
        snapshotStates: banks[currentBank].snapshotStates,
        currentBank,
        onBankChange: setCurrentBank,
        handleColorChange,
        handleChannelChange,
        handleCcChange,
        handleChannelBlur,
        handleCcBlur,
        handleCcTypeChange,
        handleCcLsbChange,
        handleCcLsbBlur,
        handleUseSingleColorChange,
        handleDisplayModeChange,
        handleBankColorChange,
        handleSnapshotUseSingleColorChange,
        banks,
        brightness,
        handleBrightnessChange,
        activeTab,
        setActiveTab,
        midiInputs,
        midiOutputs,
        selectedMidiInput,
        selectedMidiOutput,
        onMidiInputChange: handleMidiInputChange,
        onMidiOutputChange: handleMidiOutputChange,
        serialPorts,
        selectedPort,
        uploadProgress,
        isUploading,
        onPortChange: setSelectedPort,
        onUploadFirmware: handleUploadFirmware,
        appVersion,
        firmwareVersion,
        retryMidiConnection,
        downloadProgress,
        isDownloading,
        isRemoteDownloaded,
        onDownloadFirmware: handleDownloadFirmware,
        uploadComplete,
        handleCopyColorSettings,
        handleCopyBankSettings,
    };

    return (
        <div className="app-container">
            <Sidebar {...sidebarProps} />
            <div className="main-content">
                {(selectedMidiInput || selectedMidiOutput) ? (
                    <div className="controls-container">
                        <BankSelector 
                            currentBank={currentBank}
                            onBankChange={setCurrentBank}
                            handleCopyBankSettings={handleCopyBankSettings}
                        />
                        <ButtonRow
                            onButtonSelect={handleButtonSelect}
                            selectedButton={selectedButton !== null ? selectedButton : lastSelectedButton}
                            snapshotStates={banks[currentBank].snapshotStates}
                            useSingleSnapshotColor={banks[currentBank].useSingleSnapshotColor}
                        />
                        <Grid 
                            onPadSelect={handlePadSelect}
                            selectedPad={selectedPad}
                            padStates={banks[currentBank].padStates}
                            selectedButton={selectedButton !== null ? selectedButton : lastSelectedButton}
                        />
                    </div>
                ) : (
                    <div className="no-device-main">
                        <div className="no-device-content">
                            <h2>Timepod Editor</h2>
                            <p>Connect your Timepod to your computer to get started.</p>
                            <img 
                                src="./assets/controller-illustration.svg" 
                                alt="MIDI Controller Illustration" 
                                className="controller-illustration"
                                onError={(e) => e.target.style.display = 'none'}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default App; 