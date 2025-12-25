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
    const [view, setView] = useState('daily'); // 'daily', 'weekly', or 'management'
    const [notes, setNotes] = useState([]);
    const [parsing, setParsing] = useState(false);
    const [rawData, setRawData] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedNotes, setSelectedNotes] = useState([]);
    const [parsingProgress, setParsingProgress] = useState(null); // { total, completed, current }
    const [lastClickedIndex, setLastClickedIndex] = useState(null); // For shift-click range selection

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

    const fetchNotes = async () => {
        try {
            const res = await fetch('/api/notes');
            const data = await res.json();
            setNotes(data);
        } catch (e) {
            console.error('Error fetching notes:', e);
        }
    };

    const handleParse = async (date) => {
        setParsing(true);
        setParsingProgress({ total: 1, completed: 0, current: date });
        try {
            await fetch('/api/notes/parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dates: [date] })
            });
            await fetchNotes();
            await fetchData();
        } catch (e) {
            console.error('Error parsing note:', e);
        } finally {
            setParsing(false);
            setParsingProgress(null);
        }
    };

    const handleParseSelected = async () => {
        if (selectedNotes.length === 0) return;
        setParsing(true);
        setParsingProgress({ total: selectedNotes.length, completed: 0, current: null });

        for (let i = 0; i < selectedNotes.length; i++) {
            const date = selectedNotes[i];
            setParsingProgress({ total: selectedNotes.length, completed: i, current: date });
            try {
                await fetch('/api/notes/parse', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dates: [date] })
                });
            } catch (e) {
                console.error(`Error parsing ${date}:`, e);
            }
        }

        setParsingProgress({ total: selectedNotes.length, completed: selectedNotes.length, current: null });
        await fetchNotes();
        await fetchData();
        setSelectedNotes([]);
        setParsing(false);
        setParsingProgress(null);
    };

    const handleNoteClick = (date, index, event) => {
        if (event.shiftKey && lastClickedIndex !== null) {
            // Shift-click: select range
            const start = Math.min(lastClickedIndex, index);
            const end = Math.max(lastClickedIndex, index);
            const rangeNotes = notes.slice(start, end + 1).map(n => n.date);

            // Add range to selection (union)
            setSelectedNotes(prev => {
                const newSelection = new Set(prev);
                rangeNotes.forEach(d => newSelection.add(d));
                return [...newSelection];
            });
        } else if (event.metaKey || event.ctrlKey) {
            // Cmd/Ctrl-click: toggle individual
            setSelectedNotes(prev =>
                prev.includes(date)
                    ? prev.filter(d => d !== date)
                    : [...prev, date]
            );
            setLastClickedIndex(index);
        } else {
            // Regular click: toggle individual and reset anchor
            setSelectedNotes(prev =>
                prev.includes(date)
                    ? prev.filter(d => d !== date)
                    : [...prev, date]
            );
            setLastClickedIndex(index);
        }
    };

    const toggleSelectAll = () => {
        if (selectedNotes.length === notes.length) {
            setSelectedNotes([]);
        } else {
            setSelectedNotes(notes.map(n => n.date));
        }
    };

    const handleDelete = async (date) => {
        if (!confirm(`Are you sure you want to delete parsed data for ${date}?`)) return;
        try {
            await fetch('/api/notes', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dates: [date] })
            });
            await fetchNotes();
            await fetchData();
            if (selectedDate === date) {
                setSelectedDate(null);
                setRawData(null);
            }
        } catch (e) {
            console.error('Error deleting note:', e);
        }
    };

    const handleDeleteSelected = async () => {
        const parsedSelected = selectedNotes.filter(date =>
            notes.find(n => n.date === date)?.status === 'Parsed'
        );
        if (parsedSelected.length === 0) return;
        if (!confirm(`Are you sure you want to delete parsed data for ${parsedSelected.length} note(s)?`)) return;

        try {
            await fetch('/api/notes', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dates: parsedSelected })
            });
            await fetchNotes();
            await fetchData();
            setSelectedNotes([]);
            if (parsedSelected.includes(selectedDate)) {
                setSelectedDate(null);
                setRawData(null);
            }
        } catch (e) {
            console.error('Error deleting notes:', e);
        }
    };

    const fetchRaw = async (date) => {
        try {
            const res = await fetch(`/api/notes/${date}/raw`);
            const data = await res.json();
            setRawData(data); // Stores the full row now
            setSelectedDate(date);
        } catch (e) {
            console.error('Error fetching raw data:', e);
        }
    };

    useEffect(() => {
        fetchData();
        fetchNotes();
        const interval = setInterval(fetchData, 60000);
        return () => clearInterval(interval);
    }, [view]);

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

    const chartData = view === 'weekly' ? getWeeklyData(metrics) : metrics;

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await fetch('/api/refresh', { method: 'POST' });
            setTimeout(() => {
                fetchData();
                fetchNotes();
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
                    <h1>Productivity <span style={{ color: 'var(--accent-color)' }}>Nexus</span></h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Deep insights from your personal knowledge base</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div className="tab-group" style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '8px' }}>
                        <button
                            onClick={() => setView('daily')}
                            style={{ padding: '6px 12px', border: 'none', background: view === 'daily' ? 'rgba(255,255,255,0.1)' : 'transparent', color: '#fff', borderRadius: '6px', cursor: 'pointer' }}
                        >Daily</button>
                        <button
                            onClick={() => setView('weekly')}
                            style={{ padding: '6px 12px', border: 'none', background: view === 'weekly' ? 'rgba(255,255,255,0.1)' : 'transparent', color: '#fff', borderRadius: '6px', cursor: 'pointer' }}
                        >Weekly</button>
                        <button
                            onClick={() => setView('management')}
                            style={{ padding: '6px 12px', border: 'none', background: view === 'management' ? 'rgba(255,255,255,0.1)' : 'transparent', color: '#fff', borderRadius: '6px', cursor: 'pointer' }}
                        >Notes</button>
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="refresh-btn"
                        style={{ padding: '8px 16px', background: 'var(--accent-color)', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                        {refreshing ? 'Syncing...' : 'Sync All'}
                    </button>
                </div>
            </header>

            {view === 'management' ? (
                <div className="management-view">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem' }}>
                        <div className="card" style={{ padding: '1.5rem', maxHeight: '80vh', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ margin: 0 }}>Obsidian Notes</h3>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <button
                                        onClick={toggleSelectAll}
                                        disabled={parsing}
                                        style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                                    >
                                        {selectedNotes.length === notes.length ? 'Deselect All' : 'Select All'}
                                    </button>
                                    <button
                                        onClick={handleParseSelected}
                                        disabled={parsing || selectedNotes.length === 0}
                                        style={{
                                            background: selectedNotes.length > 0 ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)',
                                            border: 'none',
                                            color: selectedNotes.length > 0 ? '#000' : '#666',
                                            padding: '6px 12px',
                                            borderRadius: '4px',
                                            cursor: selectedNotes.length > 0 ? 'pointer' : 'not-allowed',
                                            fontSize: '0.8rem',
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        Parse ({selectedNotes.length})
                                    </button>
                                    <button
                                        onClick={handleDeleteSelected}
                                        disabled={parsing || selectedNotes.filter(d => notes.find(n => n.date === d)?.status === 'Parsed').length === 0}
                                        style={{
                                            background: 'transparent',
                                            border: '1px solid rgba(248, 113, 113, 0.5)',
                                            color: '#f87171',
                                            padding: '6px 12px',
                                            borderRadius: '4px',
                                            cursor: selectedNotes.filter(d => notes.find(n => n.date === d)?.status === 'Parsed').length > 0 ? 'pointer' : 'not-allowed',
                                            fontSize: '0.8rem',
                                            opacity: selectedNotes.filter(d => notes.find(n => n.date === d)?.status === 'Parsed').length > 0 ? 1 : 0.5
                                        }}
                                    >
                                        Delete ({selectedNotes.filter(d => notes.find(n => n.date === d)?.status === 'Parsed').length})
                                    </button>
                                </div>
                            </div>

                            {/* Progress Tracker */}
                            {parsingProgress && (
                                <div style={{
                                    marginBottom: '1rem',
                                    padding: '12px 16px',
                                    background: 'rgba(56, 189, 248, 0.1)',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(56, 189, 248, 0.2)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <span style={{ color: '#38bdf8', fontWeight: '500' }}>
                                            Parsing {parsingProgress.completed}/{parsingProgress.total}
                                        </span>
                                        {parsingProgress.current && (
                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                Current: {parsingProgress.current}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{
                                        height: '6px',
                                        background: 'rgba(255,255,255,0.1)',
                                        borderRadius: '3px',
                                        overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            height: '100%',
                                            width: `${(parsingProgress.completed / parsingProgress.total) * 100}%`,
                                            background: '#38bdf8',
                                            borderRadius: '3px',
                                            transition: 'width 0.3s ease'
                                        }} />
                                    </div>
                                </div>
                            )}

                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                        <th style={{ width: '40px', textAlign: 'center', padding: '10px' }}></th>
                                        <th style={{ textAlign: 'left', padding: '10px' }}>Date</th>
                                        <th style={{ textAlign: 'left', padding: '10px' }}>Status</th>
                                        <th style={{ textAlign: 'right', padding: '10px' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {notes.map((note, index) => (
                                        <tr key={note.date} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ textAlign: 'center', padding: '10px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedNotes.includes(note.date)}
                                                    onClick={(e) => handleNoteClick(note.date, index, e)}
                                                    onChange={() => { }} // Controlled by onClick
                                                    disabled={parsing}
                                                    style={{ cursor: parsing ? 'not-allowed' : 'pointer' }}
                                                />
                                            </td>
                                            <td style={{ padding: '10px' }}>{note.date}</td>
                                            <td style={{ padding: '10px' }}>
                                                <span style={{
                                                    padding: '2px 8px',
                                                    borderRadius: '4px',
                                                    fontSize: '0.8rem',
                                                    background: note.status === 'Parsed' ? 'rgba(74, 222, 128, 0.1)' : 'rgba(248, 113, 113, 0.1)',
                                                    color: note.status === 'Parsed' ? '#4ade80' : '#f87171'
                                                }}>
                                                    {note.status}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                    <button
                                                        onClick={() => handleParse(note.date)}
                                                        disabled={parsing}
                                                        style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: parsing ? 'not-allowed' : 'pointer', fontSize: '0.8rem' }}
                                                    >
                                                        Parse
                                                    </button>
                                                    {note.status === 'Parsed' && (
                                                        <button
                                                            onClick={() => fetchRaw(note.date)}
                                                            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                                                        >
                                                            Data
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="card" style={{ padding: '1.5rem', maxHeight: '80vh', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ margin: 0 }}>
                                    Note Details
                                    {selectedDate && <span style={{ color: 'var(--accent-color)', marginLeft: '10px' }}>({selectedDate})</span>}
                                </h3>
                                {rawData && (
                                    <button
                                        onClick={() => setSelectedDate(null) || setRawData(null)}
                                        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem' }}
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                            {rawData ? (
                                <div className="data-refinement-view" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    <section>
                                        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Structured Metrics</h4>
                                        <pre style={{
                                            background: 'rgba(0,0,0,0.3)',
                                            padding: '1rem',
                                            borderRadius: '8px',
                                            overflowX: 'auto',
                                            fontSize: '0.85rem',
                                            color: '#38bdf8', // Blue for structured
                                            margin: 0,
                                            border: '1px solid rgba(56, 189, 248, 0.1)'
                                        }}>
                                            {(() => {
                                                const { raw_ai_output, ...metrics } = rawData;
                                                return JSON.stringify(metrics, null, 2);
                                            })()}
                                        </pre>
                                    </section>

                                    <section>
                                        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Raw AI Output</h4>
                                        <pre style={{
                                            background: 'rgba(0,0,0,0.2)',
                                            padding: '1rem',
                                            borderRadius: '8px',
                                            overflowX: 'auto',
                                            fontSize: '0.85rem',
                                            color: '#4ade80', // Green for raw
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word',
                                            margin: 0,
                                            border: '1px solid rgba(74, 222, 128, 0.1)'
                                        }}>
                                            {rawData.raw_ai_output}
                                        </pre>
                                    </section>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-secondary)' }}>
                                    Select a parsed note to view details
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <>
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
                    <h2>Time Utilization {view === 'weekly' ? '(Weekly Aggregated)' : ''}</h2>
                    <div className="card" style={{ height: '400px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                <XAxis dataKey="date" stroke="var(--text-secondary)" tick={{ fontSize: 10 }} />
                                <YAxis stroke="var(--text-secondary)" label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
                                <Tooltip
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            const info = typeof data.textual_info === 'string' ? JSON.parse(data.textual_info) : data.textual_info;

                                            return (
                                                <div className="custom-tooltip" style={{
                                                    backgroundColor: '#1e293b',
                                                    padding: '1rem',
                                                    borderRadius: '12px',
                                                    border: '1px solid rgba(255,255,255,0.1)',
                                                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)',
                                                    maxWidth: '300px'
                                                }}>
                                                    <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', color: '#fff' }}>{label}</p>

                                                    {/* Metrics */}
                                                    <div style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                                                        {payload.map((entry, idx) => (
                                                            <div key={idx} style={{ color: entry.color, fontSize: '0.9rem', marginBottom: '2px' }}>
                                                                {entry.name}: {formatDuration(entry.value)}
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Qualitative Context */}
                                                    {info && (
                                                        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)' }}>
                                                            {info.most_important_task && (
                                                                <div style={{ marginBottom: '0.5rem' }}>
                                                                    <strong style={{ color: 'var(--accent-color)' }}>MIT:</strong> {info.most_important_task}
                                                                </div>
                                                            )}
                                                            {info.summary && (
                                                                <div style={{ marginBottom: '0.5rem', fontStyle: 'italic', borderLeft: '2px solid var(--accent-color)', paddingLeft: '8px' }}>
                                                                    {info.summary}
                                                                </div>
                                                            )}
                                                            {(info.wins && info.wins.length > 0) && (
                                                                <div style={{ marginBottom: '0.5rem' }}>
                                                                    <strong style={{ color: '#4ade80' }}>Wins:</strong> {info.wins[0]}{info.wins.length > 1 ? ` (+${info.wins.length - 1} more)` : ''}
                                                                </div>
                                                            )}
                                                            {(info.blockers && info.blockers.length > 0) && (
                                                                <div style={{ marginBottom: '0.5rem' }}>
                                                                    <strong style={{ color: '#f87171' }}>Blockers:</strong> {info.blockers[0]}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Legend />
                                <Bar stackId="a" dataKey="work_hours" name="Productive" fill="#38bdf8" radius={view === 'weekly' ? [0, 0, 0, 0] : [0, 0, 0, 0]} />
                                <Bar stackId="a" dataKey="dispersion_hours" name="Dispersion" fill="#facc15" />
                                <Bar stackId="a" dataKey="procrastination_hours" name="Procrastination" fill="#f87171" radius={[4, 4, 0, 0]} />
                                {view === 'daily' && (
                                    <Line type="monotone" dataKey="work_hours_rolling" name="7d avg (Productive)" stroke="#4ade80" strokeWidth={3} dot={false} />
                                )}
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div>
                            <h2>Wellbeing Trends (Stacked Lanes)</h2>
                            <div className="card" style={{ height: '500px', display: 'flex', flexDirection: 'column', gap: '0', padding: '1rem 0' }}>
                                {/* Mood Lane */}
                                <div style={{ height: '33.3%', position: 'relative' }}>
                                    <div style={{ position: 'absolute', top: '0', left: '10px', fontSize: '0.7rem', color: 'var(--text-secondary)', zIndex: 1 }}>MOOD</div>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} syncId="wellbeing" margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                            <XAxis dataKey="date" hide />
                                            <YAxis domain={[0, 10]} hide />
                                            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} />
                                            <Bar dataKey="mood_score" name="Mood" fill="#c084fc" radius={[2, 2, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                {/* Sleep Lane */}
                                <div style={{ height: '33.3%', position: 'relative', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ position: 'absolute', top: '5px', left: '10px', fontSize: '0.7rem', color: 'var(--text-secondary)', zIndex: 1 }}>SLEEP</div>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} syncId="wellbeing" margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                            <XAxis dataKey="date" hide />
                                            <YAxis domain={[0, 10]} hide />
                                            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} />
                                            <Bar dataKey="sleep_quality" name="Sleep" fill="#818cf8" radius={[2, 2, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                {/* Meditation Lane */}
                                <div style={{ height: '33.3%', position: 'relative', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ position: 'absolute', top: '5px', left: '10px', fontSize: '0.7rem', color: 'var(--text-secondary)', zIndex: 1 }}>MEDITATION QUALITY</div>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} syncId="wellbeing" margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                            <XAxis dataKey="date" stroke="var(--text-secondary)" tick={{ fontSize: 9 }} />
                                            <YAxis domain={[0, 5]} hide />
                                            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} />
                                            <Bar dataKey="meditation_quality" name="Meditation Quality" fill="#4ade80" radius={[2, 2, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                        <div>
                            <h2>Mindfulness & Meditation (Stacked Lanes)</h2>
                            <div className="card" style={{ height: '350px', display: 'flex', flexDirection: 'column', gap: '0', padding: '1rem 0' }}>
                                {/* Moments Lane */}
                                <div style={{ height: '50%', position: 'relative' }}>
                                    <div style={{ position: 'absolute', top: '0', left: '10px', fontSize: '0.7rem', color: 'var(--text-secondary)', zIndex: 1 }}>MOMENTS LOGGED</div>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} syncId="wellbeing" margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                            <XAxis dataKey="date" hide />
                                            <YAxis hide />
                                            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} />
                                            <Bar dataKey="mindfulness_moments" name="Moments" fill="#2dd4bf" radius={[2, 2, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                {/* Meditation Minutes Lane */}
                                <div style={{ height: '50%', position: 'relative', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ position: 'absolute', top: '5px', left: '10px', fontSize: '0.7rem', color: 'var(--text-secondary)', zIndex: 1 }}>MEDITATION (MINUTES)</div>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} syncId="wellbeing" margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                            <XAxis dataKey="date" stroke="var(--text-secondary)" tick={{ fontSize: 9 }} />
                                            <YAxis hide />
                                            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} />
                                            <Bar dataKey="meditation_time" name="Minutes" fill="#0d9488" radius={[2, 2, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
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
                </>
            )}
        </div>
    );
}

export default App;
