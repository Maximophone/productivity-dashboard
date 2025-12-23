import React, { useEffect, useState } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line, ComposedChart, Area
} from 'recharts';

function App() {
    const [metrics, setMetrics] = useState([]);
    const [procrastination, setProcrastination] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [viewMode, setViewMode] = useState('daily'); // 'daily' or 'weekly'

    const formatDuration = (decimalHours) => {
        if (decimalHours === null || decimalHours === undefined || isNaN(decimalHours)) return '-';
        const totalMinutes = Math.round(decimalHours * 60);
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        if (h > 0) return `${h}h${m > 0 ? m.toString().padStart(2, '0') + 'm' : ''}`;
        return `${m}m`;
    };

    const fetchData = async () => {
        try {
            const [mRes, pRes] = await Promise.all([
                fetch('/api/metrics'),
                fetch('/api/procrastination')
            ]);
            const mData = await mRes.json();
            const pData = await pRes.json();

            // Reverse for chronological order in charts and filter for workdays
            const cronMetrics = [...mData].reverse().filter(m => m.is_workday !== 0);

            // Process daily data with rolling average and unit conversion
            const processedDaily = cronMetrics.map((day, index) => {
                const window = 7;
                const slice = cronMetrics.slice(Math.max(0, index - window + 1), index + 1);
                const avg = slice.reduce((acc, curr) => acc + (curr.work_hours || 0), 0) / slice.length;

                return {
                    ...day,
                    procrastination_hours: (day.procrastination_minutes || 0) / 60,
                    dispersion_hours: (day.dispersion_minutes || 0) / 60,
                    work_hours_rolling: avg
                };
            });

            setMetrics(processedDaily);
            setProcrastination(pData);
            setLoading(false);
        } catch (error) {
            console.error("Failed to fetch data", error);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const getWeeklyData = (dailyData) => {
        const weeks = {};
        dailyData.forEach(day => {
            const date = new Date(day.date);
            const jan1 = new Date(date.getFullYear(), 0, 1);
            const weekNum = Math.ceil((((date - jan1) / 86400000) + jan1.getDay() + 1) / 7);
            const weekKey = `${date.getFullYear()}-W${weekNum}`;

            if (!weeks[weekKey]) {
                weeks[weekKey] = {
                    date: weekKey,
                    work_hours: 0,
                    procrastination_hours: 0,
                    dispersion_hours: 0,
                    total_hours: 0,
                    mindfulness_moments: 0,
                    meditation_time: 0,
                    sleep_quality: 0,
                    mood_score: 0,
                    count: 0
                };
            }
            weeks[weekKey].work_hours += day.work_hours || 0;
            weeks[weekKey].procrastination_hours += day.procrastination_hours || 0;
            weeks[weekKey].dispersion_hours += day.dispersion_hours || 0;
            weeks[weekKey].total_hours += day.total_hours || 0;
            weeks[weekKey].mindfulness_moments += day.mindfulness_moments || 0;
            weeks[weekKey].meditation_time += day.meditation_time || 0;
            weeks[weekKey].sleep_quality += day.sleep_quality || 0;
            weeks[weekKey].mood_score += day.mood_score || 0;
            weeks[weekKey].count += 1;
        });

        return Object.values(weeks).map(w => ({
            ...w,
            sleep_quality: w.sleep_quality / w.count,
            mood_score: w.mood_score / w.count
        }));
    };

    const chartData = viewMode === 'daily' ? metrics : getWeeklyData(metrics);

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await fetch('/api/refresh', { method: 'POST' });
            setTimeout(() => {
                fetchData();
                setRefreshing(false);
            }, 5000);
        } catch (e) {
            console.error(e);
            setRefreshing(false);
        }
    };

    if (loading) return <div className="loading">Loading dashboard...</div>;

    const latest = metrics[metrics.length - 1] || {};

    return (
        <div className="dashboard">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1>Productivity Dashboard</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Tracking daily habits and focus from Obsidian</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <div className="toggle-group" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '4px' }}>
                        <button
                            onClick={() => setViewMode('daily')}
                            style={{
                                background: viewMode === 'daily' ? 'var(--accent-color)' : 'transparent',
                                color: viewMode === 'daily' ? 'white' : 'var(--text-secondary)',
                                padding: '6px 12px'
                            }}
                        >Daily</button>
                        <button
                            onClick={() => setViewMode('weekly')}
                            style={{
                                background: viewMode === 'weekly' ? 'var(--accent-color)' : 'transparent',
                                color: viewMode === 'weekly' ? 'white' : 'var(--text-secondary)',
                                padding: '6px 12px'
                            }}
                        >Weekly</button>
                    </div>
                    <button onClick={handleRefresh} disabled={refreshing}>
                        {refreshing ? 'Syncing...' : 'Sync Notes'}
                    </button>
                </div>
            </header>

            {/* KPI Cards */}
            <section className="grid">
                <div className="card">
                    <div className="stat-label">Work Hours (Last)</div>
                    <div className="stat-value">{formatDuration(latest.work_hours)}</div>
                    <div style={{ fontSize: '0.8rem', color: latest.work_hours >= 6 ? 'var(--success-color)' : 'var(--warning-color)' }}>
                        Target: 6h+
                    </div>
                </div>
                <div className="card">
                    <div className="stat-label">Distractions (Last)</div>
                    <div className="stat-value">
                        {((latest.procrastination_minutes || 0) + (latest.dispersion_minutes || 0))}m
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Procrastination: {latest.procrastination_minutes || 0}m
                    </div>
                </div>
                <div className="card">
                    <div className="stat-label">Mindfulness</div>
                    <div className="stat-value">{latest.mindfulness_moments || 0}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Meditation: {latest.meditation_time || 0}m
                    </div>
                </div>
                <div className="card">
                    <div className="stat-label">Mood</div>
                    <div className="stat-value" style={{ fontSize: '1.5rem' }}>
                        {latest.mood_sentiment || '-'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Score: {latest.mood_score || '-'}
                    </div>
                </div>
            </section>

            {/* Charts */}
            <h2>Time Utilization {viewMode === 'weekly' ? '(Weekly Aggregated)' : ''}</h2>
            <div className="card" style={{ height: '400px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="date" stroke="var(--text-secondary)" tick={{ fontSize: 10 }} />
                        <YAxis stroke="var(--text-secondary)" label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                            labelStyle={{ color: '#fff' }}
                            formatter={(value, name) => {
                                if (name.includes('avg') || name.includes('hours') || name === 'Productive' || name === 'Dispersion' || name === 'Procrastination') {
                                    return [formatDuration(value), name];
                                }
                                return [value, name];
                            }}
                        />
                        <Legend />
                        <Bar stackId="a" dataKey="work_hours" name="Productive" fill="#38bdf8" radius={viewMode === 'weekly' ? [0, 0, 0, 0] : [0, 0, 0, 0]} />
                        <Bar stackId="a" dataKey="dispersion_hours" name="Dispersion" fill="#facc15" />
                        <Bar stackId="a" dataKey="procrastination_hours" name="Procrastination" fill="#f87171" radius={[4, 4, 0, 0]} />
                        {viewMode === 'daily' && (
                            <Line type="monotone" dataKey="work_hours_rolling" name="7d avg (Productive)" stroke="#4ade80" strokeWidth={3} dot={false} />
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div>
                    <h2>Wellbeing Trends</h2>
                    <div className="card" style={{ height: '350px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                <XAxis dataKey="date" stroke="var(--text-secondary)" tick={{ fontSize: 10 }} />
                                <YAxis domain={[0, 10]} stroke="var(--text-secondary)" />
                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} />
                                <Legend />
                                <Bar dataKey="sleep_quality" name="Sleep" fill="#818cf8" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="mood_score" name="Mood" fill="#c084fc" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="meditation_quality" name="Meditation Quality" fill="#4ade80" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div>
                    <h2>Mindfulness & Meditation</h2>
                    <div className="card" style={{ height: '350px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                <XAxis dataKey="date" stroke="var(--text-secondary)" tick={{ fontSize: 10 }} />
                                <YAxis yAxisId="left" stroke="#2dd4bf" label={{ value: 'Moments', angle: -90, position: 'insideLeft' }} />
                                <YAxis yAxisId="right" orientation="right" stroke="#0d9488" label={{ value: 'Minutes', angle: 90, position: 'insideRight' }} />
                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} />
                                <Legend />
                                <Bar yAxisId="left" dataKey="mindfulness_moments" name="Moments Logged" fill="#2dd4bf" radius={[4, 4, 0, 0]} />
                                <Bar yAxisId="right" dataKey="meditation_time" name="Meditation (min)" fill="#0d9488" radius={[4, 4, 0, 0]} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <h2>Recent Procrastination Events</h2>
            <div className="card" style={{ overflowX: 'auto' }}>
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Time</th>
                            <th>Type</th>
                            <th>Duration</th>
                            <th>Activity</th>
                            <th>Trigger</th>
                            <th>Feeling</th>
                        </tr>
                    </thead>
                    <tbody>
                        {procrastination.slice(0, 10).map((event, i) => (
                            <tr key={i}>
                                <td>{event.date}</td>
                                <td>{event.time}</td>
                                <td>
                                    <span style={{
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        fontSize: '0.8rem',
                                        backgroundColor: event.type === 'Procrastination' ? 'rgba(248, 113, 113, 0.2)' : 'rgba(250, 204, 21, 0.2)',
                                        color: event.type === 'Procrastination' ? '#fca5a5' : '#fde047'
                                    }}>
                                        {event.type}
                                    </span>
                                </td>
                                <td>{event.duration_minutes}m</td>
                                <td>{event.activity}</td>
                                <td>{event.trigger}</td>
                                <td>{event.feeling}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default App;
