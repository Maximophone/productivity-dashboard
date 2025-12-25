const fs = require('fs');
const path = require('path');
const { db } = require('../db');
const { extractDailyMetrics } = require('../gemini');

const NOTES_PATH = process.env.OBSIDIAN_NOTES_PATH;

async function parseNote(date) {
    console.log(`Parsing note for ${date}...`);
    const file = `${date}.md`;
    const fullPath = path.join(NOTES_PATH, file);

    if (!fs.existsSync(fullPath)) {
        throw new Error(`File not found: ${fullPath}`);
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const { data: metrics, raw } = await extractDailyMetrics(content, date);

    if (metrics) {
        console.log(`Extracted metrics for ${date}:`, JSON.stringify(metrics, null, 2));
        const insert = db.prepare(`
            INSERT OR REPLACE INTO daily_metrics (
                date, start_time, work_hours, procrastination_minutes, dispersion_minutes,
                total_hours, mindfulness_moments, meditation_time, meditation_quality, meditation_comment,
                sleep_quality, sleep_comment, mood_score, mood_sentiment, mood_comment,
                textual_info, raw_ai_output, is_workday
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            metrics.meditation_comment || null,
            metrics.sleep_quality ?? null,
            metrics.sleep_comment || null,
            metrics.mood_score ?? null,
            metrics.mood_sentiment || '',
            metrics.mood_comment || null,
            JSON.stringify(metrics.textual_info || {}),
            raw, // Store raw text instead of stringified JSON
            metrics.is_workday === false ? 0 : 1
        );
        return metrics;
    }
    return null;
}

function listAvailableNotes() {
    if (!NOTES_PATH || !fs.existsSync(NOTES_PATH)) return [];

    const files = fs.readdirSync(NOTES_PATH)
        .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
        .map(f => f.replace('.md', ''))
        .sort()
        .reverse();

    const parsedDates = db.prepare('SELECT date FROM daily_metrics').all().map(r => r.date);

    return files.map(date => ({
        date,
        status: parsedDates.includes(date) ? 'Parsed' : 'Missing'
    }));
}

module.exports = {
    parseNote,
    listAvailableNotes
};
