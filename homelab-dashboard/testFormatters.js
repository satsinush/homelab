// Test the frontend formatters
import { formatMacForDisplay, normalizeMacForApi, formatDeviceForDisplay } from './src/utils/formatters.js';

console.log('Testing frontend MAC formatters:');

const testMacs = [
    '00d86178e934',  // Normalized format from server
    '00:11:22:33:44:55',  // Colon format
    '00-11-22-33-44-55',  // Dash format
    '001122334455'   // No separators
];

testMacs.forEach(mac => {
    console.log(`${mac} -> display: ${formatMacForDisplay(mac)} -> normalized: ${normalizeMacForApi(mac)}`);
});

// Test device formatting
const testDevice = {
    name: 'Test Device',
    mac: '00d86178e934',
    ip: '192.168.1.100'
};

console.log('\nDevice formatting:');
console.log('Original:', testDevice);
console.log('Formatted:', formatDeviceForDisplay(testDevice));
