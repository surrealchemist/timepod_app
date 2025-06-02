import React, { useState } from 'react';
import ColorPicker, { COLORS } from './ColorPicker';
import { createSnakeOrderedPads } from '../utils/knobUtils';

const Sidebar = ({ 
    selectedPad, 
    selectedButton,
    padStates, 
    snapshotStates, 
    handleColorChange, 
    handleChannelChange, 
    handleCcChange,
    handleColorBlur,
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
    currentBank,
    handleBrightnessChange,
    brightness,
    activeTab,
    setActiveTab,
    midiInputs,
    midiOutputs,
    selectedMidiInput,
    selectedMidiOutput,
    onMidiInputChange,
    onMidiOutputChange,
    serialPorts,
    selectedPort,
    uploadProgress,
    isUploading,
    onPortChange,
    onUploadFirmware,
    appVersion,
    firmwareVersion,
    retryMidiConnection,
    downloadProgress,
    isDownloading,
    isRemoteDownloaded,
    onDownloadFirmware,
    uploadComplete,
    handleCopyColorSettings
}) => {
    const [showColorPicker, setShowColorPicker] = useState(null); // null or {id: number, position: number}
    const [showCopyPopup, setShowCopyPopup] = useState(false);
    const [selectedKnobsToCopy, setSelectedKnobsToCopy] = useState(new Set());

    const getBasename = (filepath) => {
        if (!filepath) return '';
        // Works with both forward slashes (Unix) and backslashes (Windows)
        const parts = filepath.split(/[\\/]/);
        return parts[parts.length - 1];
    };

    const renderColorSwatches = (id, states, type) => {
        if (type === 'button') {
            // For buttons, render single color swatch
            return (
                <div className="color-input-wrapper">
                    <button 
                        className={`color-swatch ${showColorPicker?.id === id ? 'active' : ''}`}
                        style={{ backgroundColor: COLORS[states[id].colorIndex] }}
                        onClick={() => setShowColorPicker({ id, position: 0 })}
                    />
                    {showColorPicker && showColorPicker.id === id && (
                        <ColorPicker
                            colorIndex={states[id].colorIndex}
                            onChange={(index) => {
                                handleColorChange(id, index, type, 0);
                            }}
                            onClose={() => setShowColorPicker(null)}
                        />
                    )}
                </div>
            );
        }

        // For pads, render multiple color swatches plus checkbox
        return (
            <div>
                <div className="color-swatches-row">
                    {Array(states[id].useSingleColor ? 1 : 8).fill().map((_, index) => (
                        <button 
                            key={index}
                            className={`color-swatch ${
                                showColorPicker?.id === id && 
                                showColorPicker?.position === index ? 'active' : ''
                            } ${states[id].useSingleColor ? 'single-color' : ''}`}
                            style={{ backgroundColor: COLORS[states[id].colorIndices[index]] }}
                            onClick={() => setShowColorPicker({ id, position: index })}
                        />
                    ))}
                    {showColorPicker && showColorPicker.id === id && (
                        <ColorPicker
                            colorIndex={states[id].colorIndices[showColorPicker.position]}
                            onChange={(index) => {
                                handleColorChange(
                                    id, 
                                    index, 
                                    type, 
                                    showColorPicker.position
                                );
                            }}
                            onClose={() => setShowColorPicker(null)}
                        />
                    )}
                </div>
                <div className="single-color-checkbox">
                    <label>
                        <input
                            type="checkbox"
                            checked={states[id].useSingleColor}
                            onChange={(e) => handleUseSingleColorChange(id, e.target.checked)}
                        />
                        Use one color for all snapshots
                    </label>
                </div>
            </div>
        );
    };

    const handleSelectAllKnobs = () => {
        const allKnobs = new Set();
        for (let i = 0; i < 16; i++) {
            if (i !== selectedPad.id) { // Don't include the current knob
                allKnobs.add(i);
            }
        }
        setSelectedKnobsToCopy(allKnobs);
    };

    const handleSelectNoneKnobs = () => {
        setSelectedKnobsToCopy(new Set());
    };

    const handleKnobToggle = (knobId) => {
        const newSelected = new Set(selectedKnobsToCopy);
        if (newSelected.has(knobId)) {
            newSelected.delete(knobId);
        } else {
            newSelected.add(knobId);
        }
        setSelectedKnobsToCopy(newSelected);
    };

    const handleCopyColorSettingsLocal = () => {
        if (!selectedPad || selectedKnobsToCopy.size === 0) return;

        // Convert Set to Array for the callback
        const targetKnobIds = Array.from(selectedKnobsToCopy);
        
        // Call the parent callback which handles both state update and MIDI messages
        handleCopyColorSettings(selectedPad.id, targetKnobIds);
        
        // Reset UI state
        setShowCopyPopup(false);
        setSelectedKnobsToCopy(new Set());
    };

    const renderCopyPopup = () => {
        if (!showCopyPopup || !selectedPad) return null;

        const orderedPads = createSnakeOrderedPads();

        return (
            <div className="copy-popup-overlay" onClick={() => setShowCopyPopup(false)}>
                <div className="copy-popup" onClick={(e) => e.stopPropagation()}>
                    <div className="copy-popup-header">
                        <h4>Copy color settings to other knobs</h4>
                        <button 
                            className="close-button"
                            onClick={() => setShowCopyPopup(false)}
                        >
                            ×
                        </button>
                    </div>
                    
                    <div className="copy-popup-content">
                        <div className="knob-selection-controls">
                            <button 
                                className="select-all-button"
                                onClick={handleSelectAllKnobs}
                            >
                                Select All
                            </button>
                            <button 
                                className="select-none-button"
                                onClick={handleSelectNoneKnobs}
                            >
                                Select None
                            </button>
                        </div>
                        
                        <div className="knob-grid">
                            {orderedPads.map((pad) => {
                                const isCurrentKnob = pad.id === selectedPad.id;
                                const isSelected = selectedKnobsToCopy.has(pad.id);
                                
                                return (
                                    <div 
                                        key={pad.id}
                                        className={`knob-item ${isCurrentKnob ? 'current-knob' : ''} ${isSelected ? 'selected' : ''}`}
                                        onClick={() => !isCurrentKnob && handleKnobToggle(pad.id)}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            disabled={isCurrentKnob}
                                            onChange={() => {}} // Controlled by parent onClick
                                            onClick={(e) => e.stopPropagation()} // Prevent double-toggle
                                        />
                                        <span>Knob {pad.number}</span>
                                    </div>
                                );
                            })}
                        </div>
                        
                        <div className="copy-popup-footer">
                            <button 
                                className="copy-settings-button"
                                onClick={handleCopyColorSettingsLocal}
                                disabled={selectedKnobsToCopy.size === 0}
                            >
                                Copy Settings ({selectedKnobsToCopy.size} knob{selectedKnobsToCopy.size !== 1 ? 's' : ''})
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderKnobSettings = () => (
        <div className="info-section">
            {selectedPad ? (
                <>
                    <div className="control-group color-control">
                        <div className="color-control-header">
                            <label>
                                {padStates[selectedPad.id].useSingleColor ? 'Color' : 'Colors by snapshot'}
                            </label>
                            <button 
                                className="copy-button"
                                onClick={() => setShowCopyPopup(true)}
                                title="Copy color settings to other knobs"
                            >
                                Copy
                            </button>
                        </div>
                        <div className="color-input-wrapper">
                            {renderColorSwatches(selectedPad.id, padStates, 'pad')}
                        </div>
                    </div>
                    <div className="control-group">
                        <label>Ring display</label>
                        <select
                            value={padStates[selectedPad.id].displayMode}
                            onChange={(e) => handleDisplayModeChange(selectedPad.id, e.target.value)}
                        >
                            <option value="fill">Standard fill</option>
                            <option value="bipolar">Bipolar fill</option>
                            <option value="pointer">Pointer</option>
                        </select>
                    </div>
                    <div className="control-group">
                        <label>MIDI CC type</label>
                        <select
                            value={padStates[selectedPad.id].ccType}
                            onChange={(e) => handleCcTypeChange(selectedPad.id, e.target.value)}
                        >
                            <option value="standard7">Standard</option>
                            <option value="standard14">14-bit</option>
                            <option value="nrpn14">NRPN</option>
                        </select>
                    </div>
                    <div className="control-group">
                        <label>MIDI channel</label>
                        <input 
                            type="number"
                            min="1"
                            max="16"
                            step="1"
                            value={padStates[selectedPad.id].channel}
                            onChange={(e) => handleChannelChange(selectedPad.id, e.target.value)}
                            onBlur={(e) => handleChannelBlur(selectedPad.id, e.target.value)}
                        />
                    </div>
                    <div className="control-group">
                        <label>
                            {padStates[selectedPad.id].ccType === 'standard7' ? 'MIDI CC:' : 'MIDI CC MSB:'}
                        </label>
                        <input 
                            type="number"
                            min="0"
                            max="127" 
                            step="1"
                            value={padStates[selectedPad.id].cc}
                            onChange={(e) => handleCcChange(selectedPad.id, e.target.value)}
                            onBlur={(e) => handleCcBlur(selectedPad.id, e.target.value)}
                        />
                    </div>
                    {padStates[selectedPad.id].ccType !== 'standard7' && (
                        <div className="control-group">
                            <label>MIDI CC LSB:</label>
                            <input 
                                type="number"
                                min="0"
                                max="127" 
                                step="1"
                                value={padStates[selectedPad.id].ccLsb}
                                onChange={(e) => handleCcLsbChange(selectedPad.id, e.target.value)}
                                onBlur={(e) => handleCcLsbBlur(selectedPad.id, e.target.value)}
                                readOnly={padStates[selectedPad.id].ccType === 'standard14'}
                                className={padStates[selectedPad.id].ccType === 'standard14' ? 'readonly-input' : ''}
                            />
                        </div>
                    )}
                </>
            ) : selectedButton !== null ? (
                <div className="control-group color-control">
                    <label>Snapshot button color</label>
                    <div className="color-input-wrapper">
                        <button 
                            className={`color-swatch single-color ${showColorPicker?.id === 'button' ? 'active' : ''}`}
                            style={{ backgroundColor: COLORS[snapshotStates[selectedButton].colorIndex] }}
                            onClick={() => setShowColorPicker({ id: 'button', position: selectedButton })}
                        />
                        {showColorPicker?.id === 'button' && (
                            <ColorPicker
                                colorIndex={snapshotStates[selectedButton].colorIndex}
                                onChange={(index) => {
                                    handleColorChange(selectedButton, index, 'button', selectedButton);
                                }}
                                onClose={() => setShowColorPicker(null)}
                            />
                        )}
                    </div>
                </div>
            ) : (
                <div>Select a knob or button to view details</div>
            )}
        </div>
    );

    const renderAppVersion = () => (
        <div className="app-version-section">
            <h5>Desktop App Version {appVersion.major}.{appVersion.minor}</h5>
        </div>
    );

    const renderFirmwareUpload = () => {
        // Compute button text
        const downloadButtonText = isDownloading 
            ? 'Downloading...' 
            : isRemoteDownloaded 
                ? 'Redownload Firmware' 
                : 'Download Firmware';
                
        const uploadButtonText = isUploading 
            ? 'Uploading...' 
            : 'Upload Firmware';
        
        return (
            <div className="firmware-upload-section">
                <h5>Firmware Version {firmwareVersion.major}.{firmwareVersion.minor}</h5>
                <h5>Firmware Update</h5>
                
                <div className="remote-firmware">
                    {downloadProgress > 0 && (
                        <div className="progress-bar-container">
                            <div 
                                className="progress-bar" 
                                style={{ width: `${downloadProgress * 100}%` }}
                            ></div>
                            <span className="progress-text">{Math.round(downloadProgress * 100)}%</span>
                        </div>
                    )}
                    
                    {isRemoteDownloaded && downloadProgress === 0 && (
                        <div className="success-message">
                            ✓ Firmware downloaded successfully
                        </div>
                    )}
                    
                    <button 
                        onClick={onDownloadFirmware}
                        disabled={isDownloading || isUploading}
                        className={`download-firmware-button ${isDownloading ? 'downloading' : ''} ${isRemoteDownloaded && !isDownloading ? 'success' : ''}`}
                    >
                        {downloadButtonText}
                    </button>
                </div>
                
                {uploadProgress > 0 && (
                    <div className="progress-bar-container">
                        <div 
                            className="progress-bar" 
                            style={{ width: `${uploadProgress * 100}%` }}
                        ></div>
                        <span className="progress-text">{Math.round(uploadProgress * 100)}%</span>
                    </div>
                )}
                
                {(uploadComplete || (uploadProgress >= 0.99 && !isUploading)) && (
                    <div className="success-message">
                        ✓ Firmware uploaded successfully
                    </div>
                )}
                
                <button 
                    onClick={onUploadFirmware}
                    disabled={isUploading || !isRemoteDownloaded}
                    className={`upload-firmware-button ${isUploading ? 'uploading' : ''} ${(uploadComplete || (uploadProgress >= 0.99 && !isUploading)) ? 'success' : ''}`}
                >
                    {uploadButtonText}
                </button>
            </div>
        );
    };

    const renderGlobalSettings = () => (
        <div className="info-section">
            <div className="control-group color-control">
                <label>LED brightness</label>
                <input 
                    type="range"
                    min="0"
                    max="10"
                    value={Math.round(brightness / 10)}
                    onChange={(e) => handleBrightnessChange(parseInt(e.target.value) * 10)}
                    className="brightness-slider"
                />
                <span className="brightness-value">{Math.round(brightness / 10)}</span>
            </div>
            {renderAppVersion()}
            {renderFirmwareUpload()}
        </div>
    );

    const renderNoDeviceDetected = () => (
        <div className="no-device-section">
            <div className="no-device-message">
                <h3>No Timepod detected</h3>
                <button 
                    className="retry-button"
                    onClick={retryMidiConnection}
                >
                    Refresh Connection
                </button>
            </div>
        </div>
    );

    // Check if a MIDI device is connected and selected
    const isDeviceConnected = selectedMidiInput || selectedMidiOutput;

    return (
        <div className="sidebar">
            <label className="settings-label">Settings</label>
            
            {isDeviceConnected ? (
                <>
                    <div className="settings-tabs">
                        <button 
                            className={`settings-tab ${activeTab === 'knob' ? 'active' : ''}`}
                            onClick={() => setActiveTab('knob')}
                        >
                            {selectedButton !== null ? 
                                `Snapshot${` ${selectedButton+1}`}` : 
                             selectedPad !== null ? 
                                `Knob${` ${selectedPad.number}`}` : 
                             'Details'}
                        </button>
                        <button 
                            className={`settings-tab ${activeTab === 'global' ? 'active' : ''}`}
                            onClick={() => setActiveTab('global')}
                        >
                            Global
                        </button>
                    </div>

                    {activeTab === 'knob' && renderKnobSettings()}
                    {activeTab === 'global' && renderGlobalSettings()}
                </>
            ) : (
                renderNoDeviceDetected()
            )}
            {renderCopyPopup()}
        </div>
    );
};

export default Sidebar; 