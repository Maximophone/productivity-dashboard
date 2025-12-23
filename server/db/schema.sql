CREATE TABLE IF NOT EXISTS daily_metrics (
  date TEXT PRIMARY KEY,
  start_time TEXT,
  work_hours REAL,
  procrastination_minutes INTEGER,
  dispersion_minutes INTEGER,
  total_hours REAL,
  mindfulness_moments INTEGER,
  meditation_time INTEGER,
  meditation_quality REAL,
  sleep_quality REAL,
  mood_score REAL,
  mood_sentiment TEXT,
  textual_info TEXT, -- Stored as JSON
  is_workday BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS procrastination_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  time TEXT,
  type TEXT CHECK(type IN ('Procrastination', 'Dispersion')),
  duration_minutes INTEGER,
  activity TEXT,
  trigger TEXT,
  feeling TEXT,
  action_taken TEXT,
  source TEXT, -- 'Daily Note' or 'Procrastination Record'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
