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

    const fetchData = async () => {
        try {
            const [mRes, pRes] = await Promise.all([
                fetch('/api/metrics'),
                fetch('/api/procrastination')
            ]);
            const mData = await mRes.json();
            const pData = await pRes.json();

            // Sort metrics by date ascending for charts
            setMetrics([...mData].reverse());
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

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await fetch('/api/refresh', { method: 'POST' });
            // Poll for updates or just wait a bit (basic implementation)
            setTimeout(() => {
                fetchData();
                setRefreshing(false);
            }, 5000); // Wait 5s then reload data
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
                <button onClick={handleRefresh} disabled={refreshing}>
                    {refreshing ? 'Syncing...' : 'Sync Notes'}
                </button>
            </header>

            {/* KPI Cards */}
            <section className="grid">
                <div className="card">
                    <div className="stat-label">Work Hours (Last)</div>
                    <div className="stat-value">{latest.work_hours?.toFixed(2) || '-'}</div>
                    <div style={{ fontSize: '0.8rem', color: latest.work_hours >= 6 ? 'var(--success-color)' : 'var(--warning-color)' }}>
                        Target: 6h+
                    </div>
                </div>
                <div className="card">
                    <div className="stat-label">Destractions (Last)</div>
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
            <h2>Productivity Trends</h2>
            <div className="card" style={{ height: '400px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={metrics}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="date" stroke="var(--text-secondary)" tick={{ fontSize: 12 }} />
                        <YAxis yAxisId="left" stroke="var(--text-secondary)" label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
                        <YAxis yAxisId="right" orientation="right" stroke="var(--text-secondary)" label={{ value: 'Minutes', angle: 90, position: 'insideRight' }} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                            labelStyle={{ color: '#fff' }}
                        />
                        <Legend />
                        <Bar yAxisId="left" dataKey="work_hours" NAME="Work Hours" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="procrastination_minutes" name="Procrastination (m)" stroke="#f87171" strokeWidth={2} />
                        <Line yAxisId="right" type="monotone" dataKey="dispersion_minutes" name="Dispersion (m)" stroke="#facc15" strokeWidth={2} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            <div className="grid">
                <div>
                    <h2>Wellbeing</h2>
                    <div className="card" style={{ height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={metrics}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                <XAxis dataKey="date" stroke="var(--text-secondary)" />
                                <YAxis domain={[0, 10]} stroke="var(--text-secondary)" />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="sleep_quality" name="Sleep" stroke="#818cf8" strokeWidth={2} />
                                <Line type="monotone" dataKey="mood_score" name="Mood" stroke="#c084fc" strokeWidth={2} />
                                <Line type="monotone" dataKey="meditation_quality" name="Meditation Q" stroke="#4ade80" strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div>
                    <h2>Mindfulness</h2>
                    <div className="card" style={{ height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={metrics}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                <XAxis dataKey="date" stroke="var(--text-secondary)" />
                                <YAxis stroke="var(--text-secondary)" />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="mindfulness_moments" name="Moments Logged" fill="#2dd4bf" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="meditation_time" name="Duration (min)" fill="#0d9488" radius={[4, 4, 0, 0]} />
                            </BarChart>
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
                            <th>Reason/Feeling</th>
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
