class FirmwareService {
    constructor() {
        this.uploadProgress = 0;
        this.isUploading = false;
        this.remoteUrl = 'https://api.modernmidi.io/timepod.bin';
        this.remoteFirmwareBuffer = null;
    }

    async getPorts() {
        try {
            return await window.firmware.getPorts();
        } catch (error) {
            console.error('Error getting serial ports:', error);
            throw error;
        }
    }

    getFirmwarePath() {
        return window.firmware.getFirmwarePath();
    }

    async downloadFirmware(progressCallback) {
        try {
            this.remoteFirmwareBuffer = await window.firmware.downloadFirmware(
                this.remoteUrl,
                (progress) => {
                    if (progressCallback) {
                        progressCallback(progress);
                    }
                }
            );
            return true;
        } catch (error) {
            console.error('Error downloading firmware:', error);
            throw error;
        }
    }

    async uploadFirmware(midiDeviceId, progressCallback) {
        if (this.isUploading) {
            throw new Error('Firmware upload already in progress');
        }

        if (!this.remoteFirmwareBuffer) {
            throw new Error('No firmware downloaded. Please download firmware first.');
        }

        this.isUploading = true;
        this.uploadProgress = 0;
        
        // Create a wrapped progress callback that ensures we never exceed 100%
        const safeProgressCallback = (progress) => {
            // Keep progress between 0 and 1
            const safeProgress = Math.min(Math.max(0, progress), 1);
            this.uploadProgress = safeProgress;
            
            if (progressCallback) {
                progressCallback(safeProgress);
            }
        };
        
        try {
            if (progressCallback) {
                safeProgressCallback(0);
            }

            const result = await window.firmware.uploadFirmware(
                midiDeviceId,
                safeProgressCallback,
                this.remoteFirmwareBuffer
            );
            
            // Make absolutely sure we report 100% at the end
            safeProgressCallback(1.0);
            
            return result;
        } catch (error) {
            console.error('Error uploading firmware:', error);
            throw error;
        } finally {
            // Add a delay before marking upload as not in progress
            await new Promise(resolve => setTimeout(resolve, 500));
            this.isUploading = false;
        }
    }
}

export default new FirmwareService(); 