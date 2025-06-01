import React from 'react';

const Pad = ({ number, onClick, selectedPad, color }) => {
    return (
        <div className={`pad ${selectedPad?.number === number ? 'selected' : ''}`} onClick={onClick}>
            <div 
                className="pad-circle" 
                style={{'--pad-color': color}}
            />
        </div>
    );
};

export default Pad; 