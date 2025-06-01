export const createSnakeOrderedPads = () => {
    const pads = [];
    for (let row = 0; row < 4; row++) {
        const rowStart = row * 4 + 1;
        const rowNumbers = row % 2 === 0 
            ? [rowStart + 3, rowStart + 2, rowStart + 1, rowStart] // Right to left
            : [rowStart, rowStart + 1, rowStart + 2, rowStart + 3]; // Left to right
        
        rowNumbers.forEach((number, colIndex) => {
            const regularIndex = row * 4 + colIndex;  // Calculate regular left-to-right, top-to-bottom index
            pads.push({
                id: number - 1,                 // Snake order index (0-15)
                number: regularIndex + 1,          // Display number (1-16)
            });
        });
    }
    return pads;
}; 