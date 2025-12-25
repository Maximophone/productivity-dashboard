const { parseNote } = require('../server/services/extractionService');

async function reprocess(date) {
    console.log(`Reprocessing ${date}...`);
    try {
        await parseNote(date);
        console.log(`Successfully reprocessed ${date}`);
    } catch (e) {
        console.error(`Failed to reprocess ${date}:`, e);
    }
}

const targetDate = process.argv[2];
if (!targetDate) {
    console.error('Please provide a date (YYYY-MM-DD)');
} else {
    reprocess(targetDate);
}
