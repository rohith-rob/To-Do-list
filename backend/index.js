const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/studystreak';

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

mongoose
  .connect(MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((error) => console.error('MongoDB connection error:', error));

const getLevel = (xp) => Math.max(1, Math.floor(xp / 200) + 1);
const formatDate = () => new Date().toISOString().slice(0, 10);

const revisionSteps = [
  { label: '1 day', days: 1 },
  { label: '1 week', days: 7 },
  { label: '1 month', days: 30 },
  { label: '2 months', days: 60 }
];

const buildTaskRevisionSchedule = (task) => {
  if (!task.done || !task.completedAt || task.reminderEnabled === false) return [];
  const completedAt = new Date(task.completedAt);
  return revisionSteps.map((step) => {
    const dueDate = new Date(completedAt.getTime() + step.days * 24 * 60 * 60 * 1000);
    return {
      label: step.label,
      due: dueDate <= new Date(),
      dueDate: dueDate.toISOString().slice(0, 10)
    };
  });
};

const buildExamPrepData = (user) => {
  if (!user.examDate) return null;
  const examDate = new Date(user.examDate);
  const now = new Date();
  const diffDays = Math.ceil((examDate - now) / (1000 * 60 * 60 * 24));
  if (diffDays < 0 || diffDays > 7) return null;
  return {
    examDate: user.examDate,
    daysLeft: diffDays,
    schedule: [
      '08:00 - 10:00: Intensive topic review',
      '10:00 - 11:00: Break',
      '11:00 - 13:00: Practice past papers',
      '14:00 - 16:00: Focus on weak concepts',
      '16:00 - 17:00: Do a full question paper'
    ],
    note: 'Follow this tight week plan and practice one question paper every day.'
  };
};

const buildRevisionData = (user) => {
  const now = new Date();
  const isSunday = now.getDay() === 0;
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const todayDay = now.getDate();
  const weeklyHours = Number((user.todayHours * 0.5).toFixed(1));
  const monthlyHours = Number((user.monthHours * 0.5).toFixed(1));

  return {
    weekly: {
      due: isSunday,
      label: 'Weekly Revision',
      hours: weeklyHours || 0,
      message: isSunday ? 'Time for your weekly review session.' : 'Sunday revision is coming soon.'
    },
    monthly: {
      due: todayDay === lastDayOfMonth,
      label: 'Monthly Revision',
      hours: monthlyHours || 0,
      message: todayDay === lastDayOfMonth ? 'Finish your monthly revision today.' : 'Monthly review is due on the last day of the month.'
    }
  };
};

const ensureUser = async () => {
  let user = await User.findOne();
  if (!user) {
    user = await User.create({
      streak: 0,
      todayHours: 0,
      monthHours: 0,
      xp: 0,
      level: 1,
      tasks: [
        { text: 'Review flashcards', done: false, reminderEnabled: true, completedAt: null },
        { text: 'Plan today’s study sessions', done: false, reminderEnabled: true, completedAt: null },
        { text: 'Practice problem set', done: false, reminderEnabled: true, completedAt: null }
      ],
      lastCompletedDate: null
    });
  }
  return user;
};

app.get('/api/user', async (req, res) => {
  const user = await ensureUser();
  const userObj = user.toObject();
  const tasks = userObj.tasks.map((task) => ({
    ...task,
    revisions: buildTaskRevisionSchedule(task)
  }));
  return res.json({
    ...userObj,
    tasks,
    level: getLevel(user.xp),
    xpProgress: user.xp % 200,
    revision: buildRevisionData(user),
    revisionReminders: tasks.filter((task) => task.revisions.some((rev) => rev.due)),
    examPrep: buildExamPrepData(user)
  });
});

app.post('/api/tasks', async (req, res) => {
  const { text, reminderEnabled } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Task text is required.' });
  }
  const user = await ensureUser();
  user.tasks.push({ text: text.trim(), done: false, reminderEnabled: reminderEnabled !== false, completedAt: null });
  await user.save();
  return res.json(user);
});

app.patch('/api/tasks/:taskId', async (req, res) => {
  const { taskId } = req.params;
  const { done, text } = req.body;
  const user = await ensureUser();
  const task = user.tasks.id(taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found.' });
  }
  if (typeof text === 'string') {
    task.text = text.trim();
  }
  if (typeof done === 'boolean' && task.done !== done) {
    task.done = done;
    if (done) {
      task.completedAt = new Date();
      user.xp += 20;
    } else {
      task.completedAt = null;
    }
  }
  if (typeof reminderEnabled === 'boolean') {
    task.reminderEnabled = reminderEnabled;
  }
  user.level = getLevel(user.xp);
  await user.save();
  return res.json(user);
});

app.delete('/api/tasks/:taskId', async (req, res) => {
  const { taskId } = req.params;
  const user = await ensureUser();
  user.tasks.id(taskId)?.remove();
  await user.save();
  return res.json(user);
});

app.post('/api/study', async (req, res) => {
  const { hours } = req.body;
  const added = Number(hours) || 0;
  if (added <= 0) {
    return res.status(400).json({ error: 'Study hours must be greater than 0.' });
  }
  const user = await ensureUser();
  user.todayHours = Number((user.todayHours + added).toFixed(1));
  user.monthHours = Number((user.monthHours + added).toFixed(1));
  user.xp += Math.round(added * 10);
  user.level = getLevel(user.xp);
  await user.save();
  return res.json({
    ...user.toObject(),
    level: user.level,
    xpProgress: user.xp % 200,
    revision: buildRevisionData(user)
  });
});

app.post('/api/streak', async (req, res) => {
  const { extraAction } = req.body;
  const user = await ensureUser();
  const allDone = user.tasks.length > 0 && user.tasks.every((task) => task.done);
  const today = formatDate();

  if (!allDone) {
    if (user.lastCompletedDate !== today) {
      user.streak = 0;
    }
    await user.save();
    return res.json({
      ...user.toObject(),
      message: 'Complete all tasks to preserve your streak.'
    });
  }

  if (extraAction) {
    user.streak += 1;
    user.xp += 30;
    user.lastCompletedDate = today;
    user.level = getLevel(user.xp);
    await user.save();
    return res.json({
      ...user.toObject(),
      message: 'Streak recovered with an extra action!'
    });
  }

  return res.json({
    ...user.toObject(),
    message: 'All tasks are complete, add one extra action to lock in the streak.'
  });
});

app.post('/api/exam-date', async (req, res) => {
  const { examDate } = req.body;
  if (!examDate || Number.isNaN(new Date(examDate).getTime())) {
    return res.status(400).json({ error: 'Provide a valid exam date.' });
  }
  const user = await ensureUser();
  user.examDate = examDate;
  await user.save();
  return res.json({
    ...user.toObject(),
    level: getLevel(user.xp),
    xpProgress: user.xp % 200,
    revision: buildRevisionData(user),
    examPrep: buildExamPrepData(user)
  });
});

app.get('/api/revision', async (req, res) => {
  const user = await ensureUser();
  return res.json({ revision: buildRevisionData(user) });
});

app.listen(PORT, () => {
  console.log(`StudyStreak API listening on http://localhost:${PORT}`);
});
