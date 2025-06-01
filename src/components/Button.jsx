import React from 'react';

const Button = ({ number, onClick, selectedButton, color }) => {
    return (
        <div className={`button ${selectedButton?.number === number ? 'selected' : ''}`} onClick={onClick}>
            <div 
                className="button-rect"
                style={{'--button-color': color}}
            />
        </div>
    );
};

export default Button; 