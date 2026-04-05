const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  text: { type: String, required: true },
  done: { type: Boolean, default: false },
  reminderEnabled: { type: Boolean, default: true },
  completedAt: { type: Date, default: null }
});

const UserSchema = new mongoose.Schema({
  streak: { type: Number, default: 0 },
  todayHours: { type: Number, default: 0 },
  monthHours: { type: Number, default: 0 },
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  examDate: { type: String, default: null },
  tasks: { type: [TaskSchema], default: [] },
  lastCompletedDate: { type: String, default: null }
});

module.exports = mongoose.model('User', UserSchema);
