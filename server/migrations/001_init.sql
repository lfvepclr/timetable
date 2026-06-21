-- 001_init.sql — 初始化 7 张表 + 索引

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  openid TEXT UNIQUE NOT NULL,
  capabilities TEXT DEFAULT '{"teacher":true,"parent":false}',
  name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  grade TEXT DEFAULT '',
  school TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  tags TEXT DEFAULT '[]',
  active INTEGER DEFAULT 1,
  parents TEXT DEFAULT '[]',
  bind_codes TEXT DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  max_students INTEGER DEFAULT 1,
  default_duration INTEGER DEFAULT 90,
  color TEXT DEFAULT '#4A90D9',
  active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS packages (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  course_name TEXT DEFAULT '',
  total_lessons INTEGER NOT NULL,
  consumed_lessons INTEGER DEFAULT 0,
  remaining INTEGER NOT NULL,
  status TEXT DEFAULT 'active',
  purchase_date INTEGER NOT NULL,
  consume_records TEXT DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS weekly_patterns (
  id TEXT PRIMARY KEY,
  course_id TEXT,
  course_name TEXT,
  course_type TEXT,
  color TEXT DEFAULT '#4A90D9',
  day_of_week INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  student_ids TEXT DEFAULT '[]',
  student_names TEXT DEFAULT '[]',
  valid_from TEXT,
  valid_until TEXT,
  status TEXT DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  start_ts INTEGER NOT NULL,
  end_ts INTEGER NOT NULL,
  course_id TEXT,
  course_name TEXT,
  course_type TEXT,
  color TEXT DEFAULT '#4A90D9',
  start_time TEXT,
  end_time TEXT,
  students TEXT NOT NULL,
  lesson_status TEXT DEFAULT 'scheduled',
  feedback_id TEXT,
  pattern_id TEXT,
  source TEXT DEFAULT 'pattern',
  note TEXT DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS feedbacks (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL,
  student_id TEXT,
  course_id TEXT,
  course_name TEXT,
  lesson_date TEXT,
  content TEXT DEFAULT '',
  performance TEXT DEFAULT '',
  homework TEXT DEFAULT '',
  teacher_comment TEXT DEFAULT '',
  photos TEXT DEFAULT '[]',
  card_image_url TEXT DEFAULT '',
  teacher_openid TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_lessons_date ON lessons(date);
CREATE INDEX IF NOT EXISTS idx_lessons_status ON lessons(lesson_status);
CREATE INDEX IF NOT EXISTS idx_lessons_start_ts ON lessons(start_ts);
CREATE INDEX IF NOT EXISTS idx_packages_student ON packages(student_id);
CREATE INDEX IF NOT EXISTS idx_packages_course ON packages(course_id);
CREATE INDEX IF NOT EXISTS idx_packages_status ON packages(status);
CREATE INDEX IF NOT EXISTS idx_feedbacks_lesson ON feedbacks(lesson_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_student ON feedbacks(student_id);
CREATE INDEX IF NOT EXISTS idx_patterns_status ON weekly_patterns(status);
