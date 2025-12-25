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

const { parseNote, listAvailableNotes } = require('./services/extractionService');

/* --- API ENDPOINTS --- */

// List all notes and their status
app.get('/api/notes', (req, res) => {
    try {
        const notes = listAvailableNotes();
        res.json(notes);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Parse specific notes
app.post('/api/notes/parse', async (req, res) => {
    const { dates } = req.body;
    if (!dates || !Array.isArray(dates)) {
        return res.status(400).json({ error: 'Dates array required' });
    }

    // We run this in the background but return immediate feedback
    // or we can wait for them all? For a few, waiting is fine.
    try {
        const results = [];
        for (const date of dates) {
            const data = await parseNote(date);
            results.push({ date, success: !!data });
        }
        res.json({ message: 'Parsing complete', results });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get full data for a note (metrics + raw)
app.get('/api/notes/:date/raw', (req, res) => {
    const { date } = req.params;
    try {
        const row = db.prepare('SELECT * FROM daily_metrics WHERE date = ?').get(date);
        if (!row) return res.status(404).json({ error: 'Note not found' });

        // Parse JSON fields
        const data = {
            ...row,
            textual_info: JSON.parse(row.textual_info || '{}')
        };
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

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

// Trigger extraction for missing notes
app.post('/api/refresh', async (req, res) => {
    console.log('Refresh triggered via Service...');
    try {
        const notes = listAvailableNotes();
        const missing = notes.filter(n => n.status === 'Missing');

        // We can process them in sequence to avoid overloading Gemini
        // or just return and let it run in background.
        // Let's run in background but using the service.
        (async () => {
            for (const note of missing) {
                try {
                    await parseNote(note.date);
                } catch (e) {
                    console.error(`Failed to parse ${note.date} during sync:`, e.message);
                }
            }
            console.log('Background sync complete.');
        })();

        res.json({ message: `Sync started for ${missing.length} missing notes.` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Serve React App for any other route
app.get('*all', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
