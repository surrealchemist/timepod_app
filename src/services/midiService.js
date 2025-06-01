const MESSAGE_TYPES = require('../constants/messageTypes');

class MidiService {
    constructor() {
        this.selectedOutput = null;
        this.selectedInput = null;
        this.initialized = false;
        this.brightnessTimeout = null;
        this.messageHandlers = new Map();
    }

    async initialize() {
        try {
            this.initialized = await window.midi.initialize();
            return this.initialized;
        } catch (error) {
            console.error('Failed to initialize MIDI:', error);
            return false;
        }
    }

    // Input device handling
    setInput(inputId) {
        // Remove existing listener if any
        if (this.selectedInput) {
            window.midi.removeInputListener(this.selectedInput);
        }

        this.selectedInput = inputId;
        if (inputId) {
            window.midi.addInputListener(inputId, this.handleSysExMessage.bind(this));
        }
    }

    // Register message handlers
    onMessage(type, handler) {
        this.messageHandlers.set(type, handler);
    }

    // Handle incoming SysEx messages
    handleSysExMessage(parsedData) {
        const handler = this.messageHandlers.get(parsedData.type);
        if (handler) {
            handler(parsedData);
        }
    }

    // Get available MIDI devices
    getInputs() {
        return window.midi.getInputs();
    }

    getOutputs() {
        return window.midi.getOutputs();
    }

    sendMessage(data) {
        if (!this.selectedOutput) {
            console.warn('No MIDI output selected');
            return;
        }
        
        // Convert data array to regular array
        const message = Array.from(data);

        console.log('MIDI: Preparing message:', message.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
        
        window.midi.sendSysEx(this.selectedOutput, message);
    }

    setOutput(outputId) {
        this.selectedOutput = outputId;
    }

    packKnobType(type) {
        switch (type) {
            case 'fill':
                return 0;
            case 'bipolar':
                return 1;
            case 'pointer':
                return 2;
            default:
                return 0;
        }
    }

    packKnobCcType(type) {
        switch (type) {
            case 'standard7':
                return 0;
            case 'standard14':
                return 1;
            case 'nrpn14':
                return 2;
        }
    }

    // Knob-related messages
    sendKnobColorChange(bankIndex, knobIndex, snapshot, colorIndex) {
        if (!this.selectedOutput) return;
        const colorMessageType = MESSAGE_TYPES.KNOB_COLOR;
        const message = [colorMessageType, bankIndex, snapshot, knobIndex, colorIndex];
        console.log(`MIDI: Knob Color Change - Bank: ${bankIndex}, Knob: ${knobIndex}, Snapshot: ${snapshot}, Color: ${colorIndex}`, message);
        this.sendMessage(message);
    }

    sendKnobColorAllChange(bankIndex, knobIndex, colorIndex) {
        if (!this.selectedOutput) return;
        const message = [MESSAGE_TYPES.KNOB_COLOR, bankIndex, 8, knobIndex, colorIndex];
        console.log(`MIDI: Knob Color All Change - Bank: ${bankIndex}, Knob: ${knobIndex}, Color: ${colorIndex}`, message);
        this.sendMessage(message);
    }

    sendKnobTypeChange(bankIndex, knobIndex, type) {
        if (!this.selectedOutput) return;
        const message = [MESSAGE_TYPES.KNOB_TYPE, bankIndex, knobIndex, this.packKnobType(type)];
        console.log(`MIDI: Knob Type Change - Bank: ${bankIndex}, Knob: ${knobIndex}, Type: ${type}`, message);
        this.sendMessage(message);
    }

    sendKnobCcTypeChange(bankIndex, knobIndex, ccType) {
        if (!this.selectedOutput) return;
        const message = [MESSAGE_TYPES.KNOB_CC_TYPE, bankIndex, knobIndex, this.packKnobCcType(ccType)];
        console.log(`MIDI: Knob CC Type Change - Bank: ${bankIndex}, Knob: ${knobIndex}, CC Type: ${ccType}`, message);
        this.sendMessage(message);
    }

    sendKnobMidiChannel(bankIndex, knobIndex, channel) {
        if (!this.selectedOutput) return;
        const message = [MESSAGE_TYPES.KNOB_MIDI_CHANNEL, bankIndex, knobIndex, channel - 1];
        console.log(`MIDI: Knob MIDI Channel - Bank: ${bankIndex}, Knob: ${knobIndex}, Channel: ${channel}`, message);
        this.sendMessage(message);
    }

    sendKnobMidiCC1(bankIndex, knobIndex, cc) {
        if (!this.selectedOutput) return;
        const message = [MESSAGE_TYPES.KNOB_MIDI_CC1, bankIndex, knobIndex, cc];
        console.log(`MIDI: Knob MIDI CC1 - Bank: ${bankIndex}, Knob: ${knobIndex}, CC: ${cc}`, message);
        this.sendMessage(message);
    }

    sendKnobMidiCC2(bankIndex, knobIndex, cc) {
        if (!this.selectedOutput) return;
        const message = [MESSAGE_TYPES.KNOB_MIDI_CC2, bankIndex, knobIndex, cc];
        console.log(`MIDI: Knob MIDI CC2 - Bank: ${bankIndex}, Knob: ${knobIndex}, CC: ${cc}`, message);
        this.sendMessage(message);
    }

    // Bank-related messages
    sendBankColorChange(bankIndex, colorIndex) {
        if (!this.selectedOutput) return;
        const message = [MESSAGE_TYPES.BANK_COLOR, bankIndex, colorIndex];
        console.log(`MIDI: Bank Color Change - Bank: ${bankIndex}, Color: ${colorIndex}`, message);
        this.sendMessage(message);
    }

    sendSnapshotColorChange(bankIndex, snapshotIndex, colorIndex) {
        if (!this.selectedOutput) return;
        const message = [MESSAGE_TYPES.BANK_SNAPSHOT_COLOR, bankIndex, snapshotIndex, colorIndex];
        console.log(`MIDI: Snapshot Color Change - Bank: ${bankIndex}, Snapshot: ${snapshotIndex}, Color: ${colorIndex}`, message);
        this.sendMessage( message);
    }

    sendSnapshotColorAllChange(bankIndex, colorIndex) {
        if (!this.selectedOutput) return;
        const message = [MESSAGE_TYPES.BANK_SNAPSHOT_COLOR, bankIndex, 8, colorIndex];
        console.log(`MIDI: Snapshot Color All Change - Bank: ${bankIndex}, Color: ${colorIndex}`, message);
        this.sendMessage(message);
    }

    // Global messages
    sendBrightnessUpdate(brightness) {
        if (!this.selectedOutput) return;
        
        // Clear any existing timeout
        if (this.brightnessTimeout) {
            clearTimeout(this.brightnessTimeout);
            this.brightnessTimeout = null;
        }

        // Set new timeout
        this.brightnessTimeout = setTimeout(() => {
            const message = [MESSAGE_TYPES.BRIGHTNESS, brightness];
            console.log(`MIDI: Brightness Update - Value: ${brightness}`, message);
            this.sendMessage(message);
            this.brightnessTimeout = null;
        }, 100);
    }

    // Sync configuration
    sendSyncConfiguration() {
        if (!this.selectedOutput) return;
        const message = [MESSAGE_TYPES.SYNC];
        console.log(`MIDI: Sync Configuration`, message);
        this.sendMessage(message);
    }
}

export default new MidiService(); 