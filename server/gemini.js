const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

async function extractDailyMetrics(content, date) {
    const prompt = `
    Analyze the following Obsidian daily note for date ${date}.
    Extract the following metrics in JSON format. 
    IMPORTANT: 
    - Only log "procrastination_minutes" or "dispersion_minutes" if they are EXPLICITLY mentioned in minutes/hours or can be calculated from explicit durations of specifically mentioned activities. 
    - DO NOT assume or infer durations from qualitative phrases like "all day long", "most of the day", or "I procrastinated a lot".
    - DO NOT calculate procrastination by looking at gaps between timestamps (e.g., if day starts at 9:00 and EOD is 18:00 and only 1h work is logged, DO NOT assume 8h of procrastination). 
    - If no explicit duration is given for a procrastination/dispersion event, use 0 for that specific event.
    - If a metric is missing or blank in the note, return null (do not use 0).
    - DO NOT assume a late start time is procrastination unless explicitly labeled.

    Metrics:
    - start_time: HH:MM (24h format)
    - work_hours: number (Net productivity hours. If "Total: 9h - 15 min = 8h45min", work_hours is 8.75. If not explicit, estimate from log)
    - total_hours: number (Gross hours before deductions)
    - procrastination_minutes: number
    - dispersion_minutes: number
    
    - mindfulness_moments: number (Count SHORT mindfulness moments or quick meditations during the day. Look for:
      1. Lines with timestamps followed by "mindfulness" or similar (e.g., "10:30 mindfulness", "14:00 - mindfulness moment")
      2. Ticked checkboxes for meditation items inside "deep work mode" or "radioactive protocol" sections (e.g., "- [x] meditation")
      DO NOT count the main morning meditation session here - only count brief mindfulness breaks throughout the day.
      If no mindfulness moments are found, return 0.)
    
    - meditation_time: number (minutes of the MAIN meditation session, usually in the morning)
    - meditation_quality: number (1-5 scale ONLY if explicitly mentioned as "X/5" or "quality: X". Return null if not explicit.)
    - meditation_comment: string (Any user comment about their meditation experience, technique used, or quality. Return null if no comment.)
    
    - sleep_quality: number (1-5 scale. If given as X/10, divide by 2. Return null if not mentioned.)
    - sleep_comment: string (Any user comment about their sleep, dreams, or rest quality. Return null if no comment.)
    
    - mood_sentiment: string ("Positive", "Neutral", or "Negative" - infer from overall tone of the day)
    - mood_score: number (1-5 scale. Infer from the overall tone, EOD writeup, wins/blockers. 1=very negative, 3=neutral, 5=very positive. Always provide a score based on your analysis.)
    - mood_comment: string (1-2 sentences explaining WHY you assigned this mood sentiment and score based on the note content)
    
    - is_workday: boolean (True if this is a standard workday with work targets/start planning. False if it's a weekend, holiday, or day explicitly mentioned as off where no work was intended.)
    
    - textual_info: JSON object containing:
      - most_important_task: string (The top priority task for the day)
      - wins: string array (Specific achievements or completed tasks)
      - blockers: string array (Distractions, illness, or inhibitors)
      - summary: string (1-2 sentences summarizing the overall day, focus, or EOD writeup)
      - radioactive_tasks: string array (Tasks causing stress or avoidance)

    Content:
    ${content}
  `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);

        return {
            data: jsonMatch ? JSON.parse(jsonMatch[0]) : null,
            raw: text
        };
    } catch (error) {
        console.error("Error parsing daily note:", error);
        return { data: null, raw: `Error: ${error.message}` };
    }
}

async function extractProcrastinationEvents(content) {
    const prompt = `
    Analyze the following Procrastination Record markdown file.
    Extract a list of all events in a JSON array.
    Each event object should have:
    - date: "YYYY-MM-DD" (If date is missing, infer from context or leave null)
    - time: "HH:MM"
    - type: "Procrastination" or "Dispersion" (Infer from section headers or content)
    - duration_minutes: number
    - activity: string
    - trigger: string
    - feeling: string
    - action_taken: string

    Content:
    ${content}
  `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) return [];
        return JSON.parse(jsonMatch[0]);
    } catch (error) {
        console.error("Error parsing procrastination record:", error);
        return [];
    }
}

module.exports = {
    extractDailyMetrics,
    extractProcrastinationEvents
};
