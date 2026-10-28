const mongoose = require('mongoose');
const { Schema } = mongoose;
const ObjectId = Schema.Types.ObjectId;

const TASK_STATUSES = ['todo', 'in_progress', 'in_review', 'qa', 'done', 'blocked'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];

// Every scoped item lives in a workspace and optionally in a sub-project/module.
// project === null means "workspace level".
const scope = {
  workspace: { type: ObjectId, ref: 'Workspace', required: true, index: true },
  project: { type: ObjectId, ref: 'Project', default: null, index: true },
};

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, default: 'developer', index: true }, // Role.key
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const RoleSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: String,
    color: { type: String, default: '#5c5b57' },
    permissions: [String],
    system: { type: Boolean, default: false }, // built-in: cannot be deleted
    locked: { type: Boolean, default: false }, // admin: cannot be edited
  },
  { timestamps: true }
);

// Key/value app settings (e.g. the story point matrix)
const SettingSchema = new Schema({ key: { type: String, unique: true, required: true }, value: Schema.Types.Mixed }, { timestamps: true });

const WorkspaceSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    key: { type: String, trim: true, uppercase: true },
    description: String,
    owner: { type: ObjectId, ref: 'User' },
    members: [{ type: ObjectId, ref: 'User' }],
    // Workspace-specific story point matrix (5×5, rows = complexity 1..5). null = organisation default.
    pointMatrix: { type: [[Number]], default: undefined },
  },
  { timestamps: true }
);

// Sub-project or module. parent === null means it hangs directly off the workspace.
const ProjectSchema = new Schema(
  {
    workspace: { type: ObjectId, ref: 'Workspace', required: true, index: true },
    parent: { type: ObjectId, ref: 'Project', default: null, index: true },
    name: { type: String, required: true, trim: true },
    description: String,
    kind: { type: String, enum: ['subproject', 'module'], default: 'subproject' },
    members: [{ type: ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

const SprintSchema = new Schema(
  {
    ...scope,
    name: { type: String, required: true },
    goal: String,
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ['planned', 'active', 'completed'], default: 'planned' },
    sequence: { type: Number, default: 1 },
    // story-point budget: total, optionally split per member
    capacity: { type: Number, default: 0 },
    memberCapacity: [{ user: { type: ObjectId, ref: 'User' }, points: { type: Number, default: 0 } }],
    recurrence: {
      enabled: { type: Boolean, default: false },
      lengthDays: { type: Number, default: 14 },
      carryOver: { type: Boolean, default: true }, // move unfinished tasks to the next sprint
      spawnedNext: { type: Boolean, default: false },
    },
    createdBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const FeatureSchema = new Schema(
  {
    ...scope,
    title: { type: String, required: true },
    description: String,
    priority: { type: String, enum: PRIORITIES, default: 'medium' },
    status: { type: String, enum: ['proposed', 'approved', 'in_progress', 'done'], default: 'proposed' },
    owner: { type: ObjectId, ref: 'User' },
    createdBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const TaskSchema = new Schema(
  {
    ...scope,
    feature: { type: ObjectId, ref: 'Feature', index: true },
    sprint: { type: ObjectId, ref: 'Sprint', default: null, index: true },
    title: { type: String, required: true },
    description: String,
    type: { type: String, enum: ['task', 'story', 'bug', 'ui', 'test'], default: 'task' },
    status: { type: String, enum: TASK_STATUSES, default: 'todo', index: true },
    priority: { type: String, enum: PRIORITIES, default: 'medium' },
    assignee: { type: ObjectId, ref: 'User', default: null, index: true },
    reporter: { type: ObjectId, ref: 'User' },
    estimate: Number, // hours
    points: { type: Number, default: null }, // story points (from the matrix when complexity+size are set)
    pointsMode: { type: String, enum: ['matrix', 'manual'], default: 'manual' },
    complexity: { type: Number, min: 1, max: 5, default: null },
    size: { type: Number, min: 1, max: 5, default: null },
    dueDate: Date,
    completedAt: Date,
    comments: [
      {
        author: { type: ObjectId, ref: 'User' },
        text: String,
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);
TaskSchema.pre('save', function (next) {
  if (this.isModified('status')) this.completedAt = this.status === 'done' ? new Date() : null;
  next();
});

const RoadmapItemSchema = new Schema(
  {
    ...scope,
    title: { type: String, required: true },
    description: String,
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ['planned', 'in_progress', 'done', 'at_risk'], default: 'planned' },
    feature: { type: ObjectId, ref: 'Feature', default: null },
    createdBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const DocSchema = new Schema(
  {
    ...scope,
    title: { type: String, required: true },
    content: { type: String, default: '' },
    author: { type: ObjectId, ref: 'User' },
    updatedBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const DiagramSchema = new Schema(
  {
    ...scope,
    title: { type: String, required: true },
    kind: { type: String, enum: ['sequence', 'flowchart', 'class', 'other'], default: 'sequence' },
    source: { type: String, default: '' },
    author: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const ChannelSchema = new Schema(
  {
    ...scope,
    name: { type: String, default: 'general' },
    isDefault: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const MessageSchema = new Schema(
  {
    channel: { type: ObjectId, ref: 'Channel', required: true, index: true },
    workspace: { type: ObjectId, ref: 'Workspace', required: true },
    author: { type: ObjectId, ref: 'User' },
    delegatedFrom: String, // original author's name if the user was deleted
    text: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = {
  STORY_POINTS: [0, 1, 2, 3, 5, 8, 13, 21],
  TASK_STATUSES,
  PRIORITIES,
  User: mongoose.model('User', UserSchema),
  Role: mongoose.model('Role', RoleSchema),
  Setting: mongoose.model('Setting', SettingSchema),
  Workspace: mongoose.model('Workspace', WorkspaceSchema),
  Project: mongoose.model('Project', ProjectSchema),
  Sprint: mongoose.model('Sprint', SprintSchema),
  Feature: mongoose.model('Feature', FeatureSchema),
  Task: mongoose.model('Task', TaskSchema),
  RoadmapItem: mongoose.model('RoadmapItem', RoadmapItemSchema),
  Doc: mongoose.model('Doc', DocSchema),
  Diagram: mongoose.model('Diagram', DiagramSchema),
  Channel: mongoose.model('Channel', ChannelSchema),
  Message: mongoose.model('Message', MessageSchema),
};
