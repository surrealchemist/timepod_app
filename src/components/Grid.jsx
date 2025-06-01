import React from 'react';
import { COLORS } from './ColorPicker';
import { createSnakeOrderedPads } from '../utils/knobUtils';

const Grid = ({ onPadSelect, selectedPad, padStates, selectedButton, snapshotStates }) => {
    const pads = createSnakeOrderedPads();

    return (
        <div className="grid">
            {pads.map(pad => (
                <div
                    key={pad.id}
                    className={`pad ${selectedPad?.id === pad.id ? 'selected' : ''}`}
                    onClick={() => onPadSelect({ id: pad.id, number: pad.number })}
                >
                    <div 
                        className="pad-circle"
                        style={{ 
                            '--pad-color': padStates[pad.id].useSingleColor 
                                ? COLORS[padStates[pad.id].colorIndices[0]]
                                : COLORS[padStates[pad.id].colorIndices[selectedButton]]
                        }}
                    />
                </div>
            ))}
        </div>
    );
};

export default Grid; 