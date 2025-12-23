const { extractProcrastinationEvents } = require('../server/gemini');
const { db, initDb } = require('../server/db');
const fs = require('fs');
require('dotenv').config();

initDb();

const RECORD_PATH = process.env.PROCRASTINATION_RECORD_PATH;

async function run() {
    console.log('Processing Procrastination Record ONLY...');
    if (!RECORD_PATH || !fs.existsSync(RECORD_PATH)) {
        console.error('Procrastination Record path not found.');
        return;
    }

    const content = fs.readFileSync(RECORD_PATH, 'utf-8');
    const events = await extractProcrastinationEvents(content);

    console.log(`Extracted ${events.length} events.`);

    if (events && events.length > 0) {
        const deleteOld = db.prepare("DELETE FROM procrastination_events WHERE source = 'Procrastination Record'");
        deleteOld.run();

        const insert = db.prepare(`
            INSERT INTO procrastination_events (
                date, time, type, duration_minutes, activity, trigger, feeling, action_taken, source
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Procrastination Record')
        `);

        const insertMany = db.transaction((events) => {
            for (const event of events) {
                insert.run(
                    event.date || 'UNKNOWN',
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
        console.log(`Saved ${events.length} events to DB.`);
    }
}

run();
