const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { db, initDb } = require('../server/db');
const { extractDailyMetrics, extractProcrastinationEvents } = require('../server/gemini');

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

        console.log(`Processing ${date}...`);
        const content = fs.readFileSync(path.join(NOTES_PATH, file), 'utf-8');

        try {
            const metrics = await extractDailyMetrics(content, date);
            if (metrics) {
                const insert = db.prepare(`
                    INSERT OR REPLACE INTO daily_metrics (
                        date, start_time, work_hours, procrastination_minutes, dispersion_minutes,
                        total_hours, mindfulness_moments, meditation_time, meditation_quality,
                        sleep_quality, mood_score, mood_sentiment, textual_info, is_workday
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);

                insert.run(
                    date,
                    metrics.start_time || null,
                    metrics.work_hours ?? 0,
                    metrics.procrastination_minutes ?? 0,
                    metrics.dispersion_minutes ?? 0,
                    metrics.total_hours ?? 0,
                    metrics.mindfulness_moments ?? 0,
                    metrics.meditation_time ?? null,
                    metrics.meditation_quality ?? null,
                    metrics.sleep_quality ?? null,
                    metrics.mood_score ?? null,
                    metrics.mood_sentiment || '',
                    JSON.stringify(metrics.textual_info || {}),
                    metrics.is_workday === false ? 0 : 1
                );
                console.log(`Saved metrics for ${date}`);
            }
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
