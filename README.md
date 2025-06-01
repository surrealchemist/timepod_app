# Timepod Desktop Editor

A desktop application for configuring the Timepod MIDI controller.

## Features

- **Visual Configuration**: Interactive grid interface matching the physical controller layout
- **Color Customization**: Configure LED colors for each knob and snapshot button
- **MIDI Settings**: Set MIDI channels, CC numbers, and message types (7-bit, 14-bit, NRPN)
- **Multiple Banks**: 8 banks of settings for different configurations
- **Copy Functions**: Copy settings between knobs and banks
- **Real-time Sync**: Bidirectional communication with the hardware device
- **Firmware Updates**: Built-in firmware update functionality

## Technology Stack

- **Framework**: Electron + React
- **Language**: JavaScript
- **MIDI Communication**: Web MIDI API
- **Serial Communication**: Node.js SerialPort
- **Build System**: Webpack + Electron Forge

## Installation

### Prerequisites
- Node.js (version 16 or higher)
- npm or yarn

### Setup
```bash
# Clone the repository
git clone [your-repo-url]
cd timepod_desktop

# Install dependencies
npm install

# Start development server
npm run dev
```

### Building
```bash
# Package the app
npm run package

# Create distributable
npm run make
```

## Usage

1. Connect your Timepod controller via USB
2. Launch the application
3. The app will automatically detect the device
4. Configure knob colors, MIDI settings, and display modes
5. Settings are automatically synced to the device

## Project Structure

```
src/
├── components/          # React components
│   ├── Grid.jsx        # 4x4 knob grid interface
│   ├── Sidebar.jsx     # Settings panel
│   ├── BankSelector.jsx # Bank switching
│   └── ColorPicker.jsx # Color selection
├── services/           # Core services
│   ├── midiService.js  # MIDI communication
│   └── firmwareService.js # Firmware updates
├── utils/              # Utility functions
└── constants/          # Message type definitions
```

## Hardware Communication

The app communicates with the Timepod controller using:
- **MIDI SysEx messages** for real-time parameter changes
- **Serial communication** for firmware updates
- **Bidirectional sync** to keep software and hardware in sync

## Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open source and available under the [MIT License](LICENSE).

## Support

- **Issues**: Report bugs and request features via GitHub Issues
- **Hardware**: Visit [modernmidi.com](https://modernmidi.com) for Timepod controller information

## Development

### Key Features Implemented

- **Snake-ordered grid**: Matches physical controller layout
- **Bank management**: Switch between 8 configuration banks
- **Color copying**: Copy color settings between knobs/banks
- **MIDI parameter management**: Full control over MIDI settings
- **Firmware updates**: Over-the-air firmware updates via serial

### Architecture Notes

- React components handle UI state and user interactions
- MIDI service manages all device communication
- Electron provides desktop app capabilities and system access
- Webpack bundles the React app for Electron consumption

