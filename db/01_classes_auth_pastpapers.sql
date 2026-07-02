-- =====================================================================
-- Migration 01: Class/school grouping, auth hardening, password reset
-- Run after 00_schema.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. SCHOOLS & CLASSES
-- Dashboards previously showed every student to every teacher, which
-- isn't usable. A class is a teacher's roster: students self-enroll with
-- a join code rather than a teacher needing to add them one by one.
-- ---------------------------------------------------------------------
CREATE TABLE schools (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR(255) NOT NULL,
  district   VARCHAR(255),
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  is_deleted BOOLEAN DEFAULT FALSE
);
CREATE TRIGGER trg_schools_updated_at BEFORE UPDATE ON schools
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE classes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id   UUID REFERENCES schools(id) ON DELETE SET NULL,
  teacher_id  UUID REFERENCES users(id) ON DELETE CASCADE,
  subject_id  UUID REFERENCES subjects(id) ON DELETE SET NULL,
  name        VARCHAR(255) NOT NULL,
  level       academic_level NOT NULL,
  join_code   VARCHAR(10) UNIQUE NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  is_deleted  BOOLEAN DEFAULT FALSE
);
CREATE TRIGGER trg_classes_updated_at BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE class_students (
  class_id   UUID REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (class_id, student_id)
);

CREATE INDEX idx_classes_teacher       ON classes(teacher_id);
CREATE INDEX idx_class_students_student ON class_students(student_id);

-- ---------------------------------------------------------------------
-- 2. AUTH HARDENING: real logout for stateless JWTs
-- A JWT can't be "deleted" server-side by nature -- logout instead
-- records the token's unique id (jti) as revoked. Every authenticated
-- request checks this table, so a logged-out token stops working
-- immediately instead of remaining valid until its 30-day expiry.
-- ---------------------------------------------------------------------
CREATE TABLE revoked_tokens (
  jti         UUID PRIMARY KEY,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  revoked_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  expires_at  TIMESTAMPTZ NOT NULL -- mirrors the token's own expiry; safe to purge rows past this
);
CREATE INDEX idx_revoked_tokens_expires ON revoked_tokens(expires_at);

-- ---------------------------------------------------------------------
-- 3. PASSWORD RESET
-- ---------------------------------------------------------------------
CREATE TABLE password_reset_tokens (
  token       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN DEFAULT FALSE
);
