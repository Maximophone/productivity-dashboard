require('dotenv').config();
const fs = require('fs');

const NOTES_PATH = process.env.OBSIDIAN_NOTES_PATH;
const RECORD_PATH = process.env.PROCRASTINATION_RECORD_PATH;

console.log('--- DEBUG INFO ---');
console.log(`NOTES_PATH: '[${NOTES_PATH}]'`);
console.log('Exists:', NOTES_PATH ? fs.existsSync(NOTES_PATH) : 'N/A');

console.log(`RECORD_PATH: '[${RECORD_PATH}]'`);
console.log('Exists:', RECORD_PATH ? fs.existsSync(RECORD_PATH) : 'N/A');

if (NOTES_PATH) {
    try {
        console.log('Files in NOTES_PATH:', fs.readdirSync(NOTES_PATH).length);
    } catch (e) {
        console.log('Error reading NOTES_PATH:', e.message);
    }
}
console.log('--- END DEBUG ---');
