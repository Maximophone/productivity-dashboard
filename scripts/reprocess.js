const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { db } = require('../server/db');
const { extractDailyMetrics } = require('../server/gemini');

const NOTES_PATH = process.env.OBSIDIAN_NOTES_PATH;

async function reprocess(date) {
    console.log(`Reprocessing ${date}...`);
    const file = `${date}.md`;
    const fullPath = path.join(NOTES_PATH, file);

    if (!fs.existsSync(fullPath)) {
        console.error(`File not found: ${fullPath}`);
        return;
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const metrics = await extractDailyMetrics(content, date);

    if (metrics) {
        db.prepare('DELETE FROM daily_metrics WHERE date = ?').run(date);

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
        console.log(`Successfully reprocessed ${date}`);
        console.log('New metrics:', metrics);
    }
}

const targetDate = process.argv[2];
if (!targetDate) {
    console.error('Please provide a date (YYYY-MM-DD)');
} else {
    reprocess(targetDate);
}
