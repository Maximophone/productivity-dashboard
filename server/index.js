const express = require('express');
const cors = require('cors');
const path = require('path');
const { db, initDb } = require('./db');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files from React app
app.use(express.static(path.join(__dirname, '../dist')));

/* --- API ENDPOINTS --- */

// Get all daily metrics
app.get('/api/metrics', (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM daily_metrics ORDER BY date DESC').all();
        // Parse JSON fields
        const data = rows.map(row => ({
            ...row,
            textual_info: JSON.parse(row.textual_info || '{}')
        }));
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get all procrastination events
app.get('/api/procrastination', (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM procrastination_events ORDER BY date DESC, time DESC').all();
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Trigger extraction script
app.post('/api/refresh', (req, res) => {
    console.log('Refresh triggered...');
    exec('node scripts/extract.js', (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            // We don't fail the request immediately if it's long running, but here we just wait?
            // Usually valid to return 202 Accepted and run in background, but user might want to know when done.
            // For simplicity, let's just log.
        }
        console.log(`stdout: ${stdout}`);
        console.error(`stderr: ${stderr}`);
    });
    // Return immediately to not block UI
    res.json({ message: 'Refresh started in background.' });
});

// Serve React App for any other route
app.get('*all', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
