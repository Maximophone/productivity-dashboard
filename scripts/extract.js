const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { db, initDb } = require('../server/db');
const { extractDailyMetrics, extractProcrastinationEvents } = require('../server/gemini');
const { parseNote } = require('../server/services/extractionService');

// Initialize DB if needed
initDb();

const NOTES_PATH = process.env.OBSIDIAN_NOTES_PATH;
const RECORD_PATH = process.env.PROCRASTINATION_RECORD_PATH;

async function processDailyNotes() {
    console.log('Processing Daily Notes...');
    if (!NOTES_PATH || !fs.existsSync(NOTES_PATH)) {
        console.error('Obsidian Notes Path not found or invalid.');
        return;
    }

    const files = fs.readdirSync(NOTES_PATH)
        .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
        .sort()
        .reverse();

    const isFull = process.argv.includes('--full');

    // Get existing dates
    const existing = isFull ? [] : db.prepare('SELECT date FROM daily_metrics').all().map(r => r.date);

    // Process new files
    for (const file of files) {
        const date = file.replace('.md', '');
        if (!isFull && existing.includes(date)) continue;

        try {
            await parseNote(date);
            console.log(`Saved metrics for ${date}`);
        } catch (e) {
            console.error(`Failed to process ${date}:`, e);
        }
    }
}

async function processProcrastinationRecord() {
    console.log('Processing Procrastination Record...');
    if (!RECORD_PATH || !fs.existsSync(RECORD_PATH)) {
        console.error('Procrastination Record path not found.');
        return;
    }

    const content = fs.readFileSync(RECORD_PATH, 'utf-8');
    const events = await extractProcrastinationEvents(content);

    if (events && events.length > 0) {
        const deleteOld = db.prepare("DELETE FROM procrastination_events WHERE source = 'Procrastination Record'");
        deleteOld.run();

        const insert = db.prepare(`
            INSERT INTO procrastination_events (
                date, time, type, duration_minutes, activity, trigger, feeling, action_taken, source
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Procrastination Record')
        `); // fixed source value

        const insertMany = db.transaction((events) => {
            for (const event of events) {
                insert.run(
                    event.date || 'UNKNOWN', // robustness
                    event.time || null,
                    event.type || 'Procrastination',
                    event.duration_minutes || 0,
                    event.activity || '',
                    event.trigger || '',
                    event.feeling || '',
                    event.action_taken || ''
                );
            }
        });

        insertMany(events);
        console.log(`Updated ${events.length} events from Procrastination Record.`);
    }
}

async function main() {
    await processDailyNotes();
    await processProcrastinationRecord();
    console.log('Extraction complete.');
}

main();
