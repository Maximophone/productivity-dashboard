const { db, initDb } = require('../server/db');
initDb();

const count = db.prepare('SELECT count(*) as count FROM daily_metrics').get();
const events = db.prepare('SELECT count(*) as count FROM procrastination_events').get();

console.log(`Daily Metrics Count: ${count.count}`);
console.log(`Procrastination Events Count: ${events.count}`);

if (count.count > 0) {
    const first = db.prepare('SELECT * FROM daily_metrics LIMIT 1').get();
    console.log('Sample Metric:', first);
}
