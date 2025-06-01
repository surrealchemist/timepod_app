import React, { useState } from 'react';

const BankSelector = ({ currentBank, onBankChange, handleCopyBankSettings }) => {
    const [showCopyPopup, setShowCopyPopup] = useState(false);
    const [selectedBanksToCopy, setSelectedBanksToCopy] = useState(new Set());

    const handleSelectAllBanks = () => {
        const allBanks = new Set();
        for (let i = 0; i < 8; i++) {
            if (i !== currentBank) { // Don't include the current bank
                allBanks.add(i);
            }
        }
        setSelectedBanksToCopy(allBanks);
    };

    const handleSelectNoneBanks = () => {
        setSelectedBanksToCopy(new Set());
    };

    const handleBankToggle = (bankId) => {
        const newSelected = new Set(selectedBanksToCopy);
        if (newSelected.has(bankId)) {
            newSelected.delete(bankId);
        } else {
            newSelected.add(bankId);
        }
        setSelectedBanksToCopy(newSelected);
    };

    const handleCopyBankSettingsLocal = () => {
        if (selectedBanksToCopy.size === 0) return;

        // Convert Set to Array for the callback
        const targetBankIds = Array.from(selectedBanksToCopy);
        
        // Call the parent callback which handles both state update and MIDI messages
        handleCopyBankSettings(currentBank, targetBankIds);
        
        // Reset UI state
        setShowCopyPopup(false);
        setSelectedBanksToCopy(new Set());
    };

    const renderCopyPopup = () => {
        if (!showCopyPopup) return null;

        return (
            <div className="copy-popup-overlay" onClick={() => setShowCopyPopup(false)}>
                <div className="copy-popup" onClick={(e) => e.stopPropagation()}>
                    <div className="copy-popup-header">
                        <h4>Copy bank settings to other banks</h4>
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
                                onClick={handleSelectAllBanks}
                            >
                                Select All
                            </button>
                            <button 
                                className="select-none-button"
                                onClick={handleSelectNoneBanks}
                            >
                                Select None
                            </button>
                        </div>
                        
                        <div className="bank-grid">
                            {Array(8).fill().map((_, index) => {
                                const isCurrentBank = index === currentBank;
                                const isSelected = selectedBanksToCopy.has(index);
                                
                                return (
                                    <div 
                                        key={index}
                                        className={`bank-item ${isCurrentBank ? 'current-bank' : ''} ${isSelected ? 'selected' : ''}`}
                                        onClick={() => !isCurrentBank && handleBankToggle(index)}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            disabled={isCurrentBank}
                                            onChange={() => {}} // Controlled by parent onClick
                                            onClick={(e) => e.stopPropagation()} // Prevent double-toggle
                                        />
                                        <span>Bank {index + 1}</span>
                                    </div>
                                );
                            })}
                        </div>
                        
                        <div className="copy-popup-footer">
                            <button 
                                className="copy-settings-button"
                                onClick={handleCopyBankSettingsLocal}
                                disabled={selectedBanksToCopy.size === 0}
                            >
                                Copy Settings ({selectedBanksToCopy.size} bank{selectedBanksToCopy.size !== 1 ? 's' : ''})
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="bank-selector">
            <div className="bank-header">
                <label className="bank-label">Bank</label>
                <button 
                    className="copy-button"
                    onClick={() => setShowCopyPopup(true)}
                    title="Copy bank settings to other banks"
                >
                    Copy
                </button>
            </div>
            <div className="bank-tabs">
                {Array(8).fill().map((_, index) => (
                    <button
                        key={index}
                        className={`bank-tab ${currentBank === index ? 'active' : ''}`}
                        onClick={() => onBankChange(index)}
                    >
                        {index + 1}
                    </button>
                ))}
            </div>
            {renderCopyPopup()}
        </div>
    );
};

export default BankSelector; 