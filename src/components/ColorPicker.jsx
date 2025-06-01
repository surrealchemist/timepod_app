import React, { useState, useRef, useEffect } from 'react';

export const COLORS = [
    "#000000", "#000061", "#00009E", "#0000FF",
    "#006100", "#006161", "#00619E", "#0061FF",
    "#009E00", "#009E61", "#009E9E", "#009EFF",
    "#00FF00", "#00FF61", "#00FF9E", "#00FFFF",
    
    "#61FF00", "#61FF61", "#61FF9E", "#61FFFF",
    "#619E00", "#619E61", "#619E9E", "#619EFF",
    "#616100", "#616161", "#61619E", "#6161FF",
    "#610000", "#610061", "#61009E", "#6100FF",
    
    "#9E0000", "#9E0061", "#9E009E", "#9E00FF",
    "#9E6100", "#9E6161", "#9E619E", "#9E61FF",
    "#9E9E00", "#9E9E61", "#9E9E9E", "#9E9EFF",
    "#9EFF00", "#9EFF61", "#9EFF9E", "#9EFFFF",
    
    "#FFFF00", "#FFFF61", "#FFFF9E", "#FFFFFF",
    "#FF9E00", "#FF9E61", "#FF9E9E", "#FF9EFF",
    "#FF6100", "#FF6161", "#FF619E", "#FF61FF",
    "#FF0000", "#FF0061", "#FF009E", "#FF00FF",
];

const ColorPicker = ({ colorIndex, onChange, onClose }) => {
    const pickerRef = useRef();
    const timeoutRef = useRef();
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setIsClosing(true);
        timeoutRef.current = setTimeout(() => {
            onClose();
        }, 100); // Match animation duration
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            // Ignore clicks on color-swatch elements
            if (event.target.classList.contains('color-swatch')) {
                if (event.target.classList.contains('active')) {
                    handleClose();
                }
                return;
            }

            if (pickerRef.current && !pickerRef.current.contains(event.target)) {
                handleClose();
            }
        };

        document.addEventListener('mouseup', handleClickOutside);
        return () => document.removeEventListener('mouseup', handleClickOutside);
    }, [onClose]);

    return (
        <div 
            className={`color-picker-popover ${isClosing ? 'closing' : ''}`} 
            ref={pickerRef}
        >
            <div className="color-grid">
                {COLORS.map((colorValue, index) => (
                    <button
                        key={index}
                        className={`color-cell ${index === colorIndex ? 'selected' : ''}`}
                        style={{ backgroundColor: colorValue }}
                        onClick={() => {
                            onChange(index);
                            handleClose();
                        }}
                    />
                ))}
            </div>
        </div>
    );
};

export default ColorPicker; 