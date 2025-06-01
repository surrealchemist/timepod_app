import React from 'react';
import { COLORS } from './ColorPicker';

const ButtonRow = ({ onButtonSelect, selectedButton, snapshotStates, useSingleSnapshotColor }) => {
    return (
        <div className="button-grid">
            {snapshotStates.map((button, index) => (
                <div
                    key={index}
                    className={`button ${selectedButton === index ? 'selected' : ''}`}
                    onClick={() => onButtonSelect(index)}
                >
                    <div 
                        className="button-rect"
                        style={{ '--button-color': COLORS[useSingleSnapshotColor ? snapshotStates[0].colorIndex : snapshotStates[index].colorIndex] }}
                    />
                </div>
            ))}
        </div>
    );
};

export default ButtonRow; 