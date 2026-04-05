import { useEffect, useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

function App() {
  const [user, setUser] = useState(null);
  const [taskText, setTaskText] = useState('');
  const [taskReminderEnabled, setTaskReminderEnabled] = useState(true);
  const [goalText, setGoalText] = useState('');
  const [examDateInput, setExamDateInput] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [timerActive, setTimerActive] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerOverlayOpen, setTimerOverlayOpen] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    refreshUser();
    fetchLeaderboard();
  }, []);

  useEffect(() => {
    if (user?.examDate) {
      setExamDateInput(user.examDate);
    }
  }, [user]);

  useEffect(() => {
    let timer;
    if (timerActive) {
      timer = window.setInterval(() => setElapsedSeconds((prev) => prev + 1), 1000);
    }
    return () => window.clearInterval(timer);
  }, [timerActive]);

  const formatTimer = (seconds) => {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${secs}`;
  };

  const examPrep = useMemo(() => {
    if (!user?.examPrep) return null;
    return user.examPrep;
  }, [user]);

  const stats = useMemo(() => {
    if (!user) return {};
    const completedCount = user.tasks.filter((task) => task.done).length;
    const progress = user.tasks.length ? Math.round((completedCount / user.tasks.length) * 100) : 0;
    const averageHours = user.monthHours / Math.max(1, new Date().getDate());
    return {
      completedCount,
      progress,
      averageHours: averageHours.toFixed(1),
      xpProgress: user.xp % 200
    };
  }, [user]);

  const refreshUser = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/user`);
      const data = await response.json();
      setUser(data);
      await fetchLeaderboard();
    } catch (error) {
      setStatusMessage('Unable to load your StudyStreak data.');
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/leaderboard`);
      const data = await response.json();
      setLeaderboard(data.leaderboard);
    } catch (error) {
      console.error('Unable to load leaderboard.');
    }
  };

  const setMessage = (message) => {
    setStatusMessage(message);
    window.setTimeout(() => setStatusMessage(''), 3800);
  };

  const saveExamDate = async () => {
    if (!examDateInput) {
      setMessage('Choose your exam date first.');
      return;
    }
    setLoading(true);
    try {
      await fetch(`${API_BASE}/api/exam-date`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examDate: examDateInput })
      });
      await refreshUser();
      setMessage('Exam date saved. Prep schedule activated when 1 week remains.');
    } catch (error) {
      setMessage('Unable to save exam date.');
    }
    setLoading(false);
  };

  const addTask = async () => {
    if (!taskText.trim()) {
      setMessage('Type a task before adding it.');
      return;
    }
    setLoading(true);
    try {
      await fetch(`${API_BASE}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: taskText, reminderEnabled: taskReminderEnabled })
      });
      setTaskText('');
      setTaskReminderEnabled(true);
      await refreshUser();
      setMessage('Task added to your streak path.');
    } catch (error) {
      setMessage('Could not add the task.');
    }
    setLoading(false);
  };

  const toggleTask = async (taskId, currentDone) => {
    setLoading(true);
    try {
      await fetch(`${API_BASE}/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: !currentDone })
      });
      await refreshUser();
    } catch (error) {
      setMessage('Unable to update task status.');
    }
    setLoading(false);
  };

  const deleteTask = async (taskId) => {
    setLoading(true);
    try {
      await fetch(`${API_BASE}/api/tasks/${taskId}`, { method: 'DELETE' });
      await refreshUser();
      setMessage('Task removed from the list.');
    } catch (error) {
      setMessage('Unable to delete the task.');
    }
    setLoading(false);
  };

  const updateTaskReminder = async (taskId, enabled) => {
    setLoading(true);
    try {
      await fetch(`${API_BASE}/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminderEnabled: enabled })
      });
      await refreshUser();
    } catch (error) {
      setMessage('Unable to update task reminder setting.');
    }
    setLoading(false);
  };

  const startTimer = () => {
    setTimerOverlayOpen(true);
    setTimerActive(true);
    setMessage(elapsedSeconds > 0 ? 'Timer resumed. Keep going.' : 'Study timer started. Keep it running while you study.');
  };

  const pauseTimer = () => {
    setTimerActive(false);
    setMessage('Timer paused. You can resume or close the overlay.');
  };

  const saveStudySession = async () => {
    const hours = Number((elapsedSeconds / 3600).toFixed(1));
    if (hours <= 0) {
      setMessage('Study session must run for at least 30 seconds.');
      return;
    }

    setLoading(true);
    try {
      await fetch(`${API_BASE}/api/study`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours })
      });
      await refreshUser();
      setMessage(`Logged ${hours}h from your session!`);
      setTimerOverlayOpen(false);
      setElapsedSeconds(0);
      setTimerActive(false);
    } catch (error) {
      setMessage('Could not log study time.');
    }
    setLoading(false);
  };

  const resetStudyTimer = () => {
    setTimerActive(false);
    setElapsedSeconds(0);
    setMessage('Study timer reset.');
  };

  const closeTimerOverlay = () => {
    setTimerOverlayOpen(false);
    setTimerActive(false);
    setMessage('Stopwatch closed.');
  };

  const completeAllTasks = async () => {
    if (!user) return;
    const incomplete = user.tasks.filter((task) => !task.done);
    if (!incomplete.length) {
      setMessage('All tasks are already complete.');
      return;
    }
    setLoading(true);
    try {
      await Promise.all(
        incomplete.map((task) =>
          fetch(`${API_BASE}/api/tasks/${task._id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ done: true })
          })
        )
      );
      await refreshUser();
      setMessage('Task streak progress updated.');
    } catch (error) {
      setMessage('Unable to complete tasks.');
    }
    setLoading(false);
  };

  const startRevision = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/revision`);
      const data = await response.json();
      setUser((prev) => ({ ...prev, revision: data.revision }));
      setMessage('Revision reminders refreshed.');
    } catch (error) {
      setMessage('Unable to load revision reminders.');
    }
    setLoading(false);
  };

  const updateStreak = async (useExtraAction = false) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/streak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extraAction: useExtraAction ? 'extra' : '' })
      });
      const data = await response.json();
      setUser(data);
      setMessage(data.message || 'Streak status updated.');
    } catch (error) {
      setMessage('Unable to update your streak.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-glow backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3">
              <p className="text-sm uppercase tracking-[0.25em] text-emerald-400/80">StudyStreak</p>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">🎮 StudyStreak</h1>
              <input
                value={goalText}
                onChange={(e) => setGoalText(e.target.value)}
                placeholder="Enter your study goal..."
                className="w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-500"
              />
            </div>
            <div className="grid gap-3 rounded-3xl bg-slate-800/90 px-4 py-3 text-sm text-slate-300 shadow-sm">
              <label className="text-xs uppercase tracking-[0.25em] text-slate-400">Exam date</label>
              <input
                type="date"
                value={examDateInput}
                onChange={(e) => setExamDateInput(e.target.value)}
                className="rounded-3xl border border-slate-700 bg-slate-950/90 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-500"
              />
              <button
                onClick={saveExamDate}
                disabled={loading}
                className="rounded-3xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110"
              >
                Save exam date
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-5 xl:grid-cols-[1.4fr_0.9fr]">
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="🔥 Streak" value={`${user?.streak ?? 0} days`} accent="from-rose-500 to-orange-400" />
              <StatCard label="⏳ Studied" value={`${user?.todayHours ?? 0}h today`} accent="from-cyan-500 to-blue-500" />
              <StatCard label="📅 Monthly" value={`${user?.monthHours ?? 0}h`} accent="from-violet-500 to-fuchsia-500" />
              <StatCard label="📊 Progress" value={`${stats.progress ?? 0}%`} accent="from-emerald-400 to-lime-400" />
            </div>
            {examPrep ? (
              <div className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-6 text-amber-100 shadow-glow">
                <p className="text-sm uppercase tracking-[0.2em] text-amber-300">Exam prep</p>
                <p className="mt-4 text-xl font-semibold text-white">Exam in {examPrep.daysLeft} day{examPrep.daysLeft === 1 ? '' : 's'}</p>
                <p className="mt-2 text-sm text-slate-300">Follow this tight schedule and finish a question paper every day.</p>
                <div className="mt-4 space-y-2 text-sm">
                  {examPrep.schedule.map((item) => (
                    <div key={item} className="rounded-2xl bg-slate-900/80 px-4 py-3 text-slate-200">
                      {item}
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs text-slate-400">{examPrep.note}</p>
              </div>
            ) : null}

            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-glow">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-slate-400">🎯 XP Points</p>
                  <p className="mt-2 text-3xl font-semibold text-white">{user?.xp ?? 0}</p>
                  <p className="text-sm text-slate-400">Level {user?.level ?? 1}</p>
                </div>
                <div className="rounded-full bg-slate-800/70 px-4 py-2 text-sm text-slate-300">
                  {stats.xpProgress ?? 0}/200 XP to next level
                </div>
              </div>
              <div className="mt-5 h-4 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-700" style={{ width: `${stats.xpProgress ?? 0}%` }} />
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-glow">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Study partners</p>
                  <h2 className="mt-2 text-xl font-semibold text-white">Competitive Leaderboard</h2>
                </div>
                <span className="rounded-2xl bg-slate-800/90 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">AI Partners</span>
              </div>
              <p className="mt-4 text-sm text-slate-400">Compete with AI study partners and see how you rank!</p>
              <div className="mt-5 space-y-3">
                {leaderboard.slice(0, 5).map((entry) => (
                  <div key={entry.name} className={`flex items-center justify-between rounded-3xl border p-4 transition ${entry.name === 'You' ? 'border-cyan-500/50 bg-cyan-500/5' : 'border-slate-800 bg-slate-950/80'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${entry.rank === 1 ? 'bg-yellow-500 text-slate-950' : entry.rank === 2 ? 'bg-slate-400 text-slate-950' : entry.rank === 3 ? 'bg-amber-600 text-slate-950' : 'bg-slate-700 text-slate-200'}`}>
                        {entry.rank}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{entry.name}</p>
                        <p className="text-xs text-slate-400">Level {entry.level} • {entry.streak} day streak</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">{entry.xp} XP</p>
                      <p className="text-xs text-slate-400">{entry.todayHours}h today</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-glow">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Daily To-Do</p>
                    <p className="mt-1 text-xl font-semibold text-white">{stats.completedCount ?? 0}/{user?.tasks.length ?? 0} completed</p>
                  </div>
                  <div className="inline-flex items-center justify-center rounded-2xl bg-emerald-500/15 px-3 py-2 text-sm text-emerald-300">
                    {stats.progress ?? 0}%
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  {user?.tasks.map((task) => (
                    <div key={task._id} className="flex items-start justify-between rounded-3xl border border-slate-800 bg-slate-950/80 p-4 transition hover:border-cyan-500/50">
                      <div className="flex-1">
                        <button
                          className={`text-left text-sm ${task.done ? 'text-slate-400 line-through' : 'text-slate-100'}`}
                          onClick={() => toggleTask(task._id, task.done)}
                          disabled={loading}
                        >
                          {task.text}
                        </button>
                        {task.done && task.revisions?.length ? (
                          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-300">
                            {task.revisions.map((rev) => (
                              <span
                                key={rev.label}
                                className={`rounded-full px-2 py-1 ${rev.due ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800/80 text-slate-400'}`}
                              >
                                {rev.label} {rev.due ? 'due' : `on ${rev.dueDate}`}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="ml-4 flex items-center gap-2">
                        <button
                          className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${task.reminderEnabled ? 'border-emerald-500 text-emerald-300 hover:bg-emerald-500/10' : 'border-slate-700 text-slate-400 hover:bg-slate-700/80'}`}
                          onClick={() => updateTaskReminder(task._id, !task.reminderEnabled)}
                          disabled={loading}
                        >
                          {task.reminderEnabled ? 'Reminder On' : 'Reminder Off'}
                        </button>
                        <button
                          className="rounded-full bg-slate-800 px-3 py-2 text-xs text-slate-300 transition hover:bg-slate-700"
                          onClick={() => deleteTask(task._id)}
                          disabled={loading}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-[1.4fr_0.6fr]">
                  <div className="grid gap-3">
                    <input
                      value={taskText}
                      onChange={(e) => setTaskText(e.target.value)}
                      placeholder="Add a new task"
                      className="w-full rounded-3xl border border-slate-800 bg-slate-950/90 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-500"
                    />
                    <label className="inline-flex items-center gap-3 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={taskReminderEnabled}
                        onChange={(e) => setTaskReminderEnabled(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                      />
                      Send review reminders for this task
                    </label>
                  </div>
                  <button
                    onClick={addTask}
                    disabled={loading}
                    className="rounded-3xl bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110"
                  >
                    Add Task
                  </button>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-glow">
                <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Core habits</p>
                <div className="mt-5 rounded-3xl border border-slate-800 bg-slate-950/90 p-5 text-center">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Study Timer</p>
                  <p className="mt-5 text-6xl font-bold text-white tracking-[0.08em]">{formatTimer(elapsedSeconds)}</p>
                  <p className="mt-3 text-sm text-slate-400">
                    {timerActive ? 'Running… stop to log your session.' : 'Start the timer before you begin studying.'}
                  </p>
                  <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <button
                      onClick={startTimer}
                      disabled={loading}
                      className="flex-1 rounded-3xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110"
                    >
                      {timerActive ? 'Pause Timer' : elapsedSeconds > 0 ? 'Resume Timer' : 'Start Timer'}
                    </button>
                    <button
                      onClick={resetStudyTimer}
                      disabled={loading}
                      className="rounded-3xl bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-700"
                    >
                      Reset
                    </button>
                  </div>
                </div>
                <div className="mt-5 space-y-4">
                  <ActionButton label="Complete All" onClick={completeAllTasks} />
                  <ActionButton label="Start Revision" onClick={startRevision} secondary />
                  <ActionButton label="Recover Streak" onClick={() => updateStreak(true)} accent />
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-5">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-glow">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Streak dashboard</p>
              <div className="mt-5 space-y-4">
                <ProgressBlock label="Tasks complete" value={`${stats.completedCount ?? 0}/${user?.tasks.length ?? 0}`} progress={stats.progress} />
                <ProgressBlock label="Daily average" value={`${stats.averageHours ?? '0.0'}h`} progress={Math.min(100, (stats.averageHours / 6) * 100)} />
                <ProgressBlock label="XP to next level" value={`${stats.xpProgress ?? 0}/200`} progress={stats.xpProgress} accent="from-fuchsia-500 to-indigo-500" />
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-glow">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Revision</p>
                  <h2 className="mt-2 text-xl font-semibold text-white">Weekly + Monthly</h2>
                </div>
                <span className="rounded-2xl bg-slate-800/90 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                  Reminder
                </span>
              </div>
              <div className="mt-5 space-y-4">
                <RevisionCard revision={user?.revision?.weekly} />
                <RevisionCard revision={user?.revision?.monthly} />
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-glow">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Task Review Reminders</p>
              <div className="mt-5 space-y-3">
                {user?.revisionReminders?.length ? (
                  user.revisionReminders.map((task) => (
                    <div key={task.id} className="rounded-3xl border border-slate-800 bg-slate-950/90 p-4">
                      <p className="text-sm font-semibold text-white">{task.text}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-300">
                        {task.revisions.map((rev) => (
                          <span
                            key={rev.label}
                            className={`rounded-full px-2 py-1 ${rev.due ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800/80 text-slate-400'}`}
                          >
                            {rev.label} {rev.due ? 'due' : `on ${rev.dueDate}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">No task review reminders due yet. Complete tasks to activate the review cycle.</p>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-slate-950/95 p-6 shadow-glow">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Extra recovery</p>
              <div className="mt-5 space-y-3 text-slate-200">
                <RecoveryItem label="30-min study session" />
                <RecoveryItem label="Revise a weak topic" />
                <RecoveryItem label="Practice questions" />
                <RecoveryItem label="Teach a concept" />
              </div>
            </div>
          </aside>
        </section>

        <footer className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/80 p-6 text-sm text-slate-500 shadow-glow">
          <p>Designed to feel like a study game. Complete tasks, log hours, and keep your streak alive.</p>
        </footer>

        {timerOverlayOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 px-4 py-6 transition-opacity duration-500 ease-out">
            <div className="w-full max-w-4xl rounded-[2rem] border border-slate-700 bg-slate-950/95 p-8 shadow-[0_0_80px_rgba(15,23,42,0.65)] transition-transform duration-500 ease-out">
              <div className="flex items-start justify-between gap-4 text-white">
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-cyan-300/80">Study timer active</p>
                </div>
                <button
                  onClick={closeTimerOverlay}
                  className="rounded-full border border-slate-700 bg-slate-900/90 px-3 py-2 text-lg font-bold text-slate-200 transition hover:bg-slate-800"
                >
                  ✕
                </button>
              </div>
              <div className="mt-8 flex flex-col items-center gap-6 text-center">
                <p className="text-[5rem] font-black uppercase tracking-[0.1em] text-white md:text-[6rem]">{formatTimer(elapsedSeconds)}</p>
                <p className="max-w-xl text-sm text-slate-400 sm:text-base">
                  Keep this screen open while you study. Pause to save your place, or log when you're ready to end the session.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
                  {timerActive ? (
                    <button
                      onClick={pauseTimer}
                      className="min-w-[12rem] rounded-3xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-4 text-sm font-semibold text-slate-950 transition hover:brightness-110"
                    >
                      Pause
                    </button>
                  ) : (
                    <button
                      onClick={startTimer}
                      className="min-w-[12rem] rounded-3xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-4 text-sm font-semibold text-slate-950 transition hover:brightness-110"
                    >
                      {elapsedSeconds > 0 ? 'Resume' : 'Start'}
                    </button>
                  )}
                  <button
                    onClick={saveStudySession}
                    disabled={loading || elapsedSeconds === 0}
                    className="min-w-[12rem] rounded-3xl border border-slate-700 bg-slate-900/90 px-6 py-4 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Save & Log
                  </button>
                  <button
                    onClick={resetStudyTimer}
                    className="min-w-[12rem] rounded-3xl border border-slate-700 bg-slate-900/90 px-6 py-4 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {statusMessage ? (
          <div className="fixed bottom-5 left-1/2 z-50 w-[min(90vw,30rem)] -translate-x-1/2 rounded-3xl bg-slate-900/95 px-5 py-4 text-center text-sm text-slate-100 shadow-lg backdrop-blur-xl">
            {statusMessage}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const StatCard = ({ label, value, accent = 'from-cyan-500 to-blue-500' }) => (
  <div className={`rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-glow backdrop-blur-xl`}>
    <p className="text-sm text-slate-400">{label}</p>
    <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
    <div className={`mt-4 h-2 rounded-full bg-gradient-to-r ${accent}`} />
  </div>
);

const ActionButton = ({ label, onClick, secondary, accent }) => (
  <button
    onClick={onClick}
    className={`w-full rounded-3xl px-5 py-4 text-sm font-semibold transition focus:outline-none ${
      accent
        ? 'bg-gradient-to-r from-rose-500 to-orange-400 text-slate-950 hover:brightness-110'
        : secondary
        ? 'bg-slate-800 text-slate-200 hover:bg-slate-700'
        : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
    }`}
  >
    {label}
  </button>
);

const ProgressBlock = ({ label, value, progress, accent = 'from-cyan-500 to-blue-500' }) => (
  <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-5">
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
    <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
      <div className={`h-full rounded-full bg-gradient-to-r ${accent}`} style={{ width: `${progress ?? 0}%` }} />
    </div>
  </div>
);

const RevisionCard = ({ revision }) => {
  if (!revision) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-4 text-slate-400">Loading revision details…</div>
    );

  }
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{revision.label}</p>
          <p className="mt-1 text-sm text-slate-400">{revision.message}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${revision.due ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>
          {revision.due ? 'Due' : 'Scheduled'}
        </span>
      </div>
      <p className="mt-3 text-sm text-slate-300">Estimated {revision.hours}h review</p>
    </div>
  );
};

const RecoveryItem = ({ label }) => (
  <div className="flex items-center justify-between rounded-3xl border border-slate-800 bg-slate-950/90 px-4 py-3 text-sm text-slate-300">
    <span>{label}</span>
    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">Bonus</span>
  </div>
);

export default App;
