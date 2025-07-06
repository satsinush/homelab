// C:\dev\homelab-api-server\server.js
const express = require('express');
const wol = require('wake_on_lan');
const cors = require('cors');
const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

// Define MAC addresses for your devices. You'll need to find these.
// For example, your PC: Andrew-Computer, 10.10.10.13, 10.10.20.13
// You'll need to find its MAC address separately.
const DEVICE_MACS = {
    "Andrew-Computer": "00:11:22:33:44:55", // <<< REPLACE WITH YOUR PC's MAC ADDRESS
    // Add other devices here as needed, e.g., "rpi5-server": "AA:BB:CC:DD:EE:FF"
};

app.post('/api/wol', (req, res) => {
    const deviceName = req.body.device;
    const macAddress = DEVICE_MACS[deviceName];

    if (!macAddress) {
        return res.status(400).json({ error: "Device not found or MAC address missing." });
    }

    wol.wake(macAddress, (error) => {
        if (error) {
            console.error(`Error sending WoL packet to ${deviceName}:`, error);
            return res.status(500).json({ error: `Failed to send WoL packet: ${error.message}` });
        }
        res.status(200).json({ message: `WoL packet sent to ${deviceName} (${macAddress}).` });
    });
});

app.get('/api/devices', (req, res) => {
    res.status(200).json(Object.keys(DEVICE_MACS));
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Node.js API listening at http://0.0.0.0:${port}`);
});