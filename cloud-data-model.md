# Kids BJJ App Cloud Data Model

This is the proposed Supabase data structure for the app. It is a planning document only. It does not create tables, upload data, or change the app.

## Core Tables

### `students`

One row per student, for both kids and adults.

- `id`: unique student ID
- `first_name`
- `last_name`
- `program`: `kids` or `adult`
- `active`: whether the student is currently active
- `rank`: current belt/rank
- `belt_size`
- `notes`
- `created_at`
- `updated_at`

Keeping kids and adults in one table makes searching, reporting, waivers, and student information simpler. The `program` field keeps the two programs distinguishable.

### `class_sessions`

The adult schedule and any future kids class schedule.

- `id`: unique session ID
- `program`: `kids` or `adult`
- `day_of_week`
- `slot`: for example, Morning or Evening
- `label`: for example, Beginners or Advanced
- `start_time`
- `end_time`
- `active`

### `attendance`

One row for a student's attendance at a class date and, when applicable, a specific session.

- `id`: unique attendance record ID
- `student_id`: links to `students.id`
- `class_date`
- `session_id`: links to `class_sessions.id`; optional for the current kids attendance model
- `present`
- `created_at`
- `updated_at`

A uniqueness rule should prevent duplicate attendance for the same student, date, and session.

### `promotions`

A history of rank or belt promotions.

- `id`: unique promotion ID
- `student_id`: links to `students.id`
- `promotion_date`
- `previous_rank`
- `new_rank`
- `notes`
- `created_at`

A student can have many promotion records.

### `waivers`

Signed waiver records and the contact information captured at signing.

Waiver history must be retained. A new waiver or updated contact information will create or update the appropriate current record without deleting older signed waiver records.

- `id`: unique waiver ID
- `student_id`: links to `students.id`
- `waiver_version`
- `participant_name`
- `parent_guardian_name`
- `phone`
- `email`
- `emergency_name`
- `emergency_phone`
- `signed_at`
- `created_at`
- `updated_at`

A student can have multiple waivers over time. Keeping old waiver records preserves the signing history instead of overwriting it.

### `class_notes`

Lesson notes organized by class date.

Kids and adult notes will share this table and be separated by the `program` field.

- `id`: unique note ID
- `program`: `kids` or `adult`
- `class_date`
- `title`
- `content`
- `created_at`
- `updated_at`

If there should only be one note per program per date, add a uniqueness rule for `program` and `class_date`.

### `idea_notes`

Shared ideas available to authorized staff on every device.

- `id`: unique idea ID
- `title`
- `content`
- `created_by`: links to the Supabase Auth user
- `created_at`
- `updated_at`

## Supporting Tables

### `app_settings`

Configuration that should be shared across devices.

- `id`
- `setting_key`
- `setting_value`
- `updated_at`

Examples include class start dates, adult schedules, belt-size lists, and other configuration currently stored in browser storage.

### `user_profiles`

A profile connected to a Supabase Auth account.

- `user_id`: links to the Supabase Auth user
- `display_name`
- `role`: for example, `owner`, `admin`, or `instructor`
- `active`
- `created_at`

This table controls which staff members can access or edit administrative data.

## Relationships

- One `student` has many `attendance` records.
- One `student` has many `promotions`.
- One `student` has many `waivers`.
- One `class_session` has many `attendance` records.
- One `user_profile` belongs to one Supabase Auth user.
- `class_notes` are associated with a program and date, not directly with an individual student.

## Initial Access Rules

- `owner`: full access, including users, settings, and backups.
- `admin`: manage students, attendance, promotions, waivers, class notes, settings, and backups, but not user accounts unless explicitly granted that responsibility.
- `instructor`: full operational access to students, attendance, promotions, waivers, class notes, and app settings, but no user access management, user management, or backups.

Instructors are intentionally allowed to manage all operational records, including waivers, because that matches the academy's workflow. The final implementation should still restrict access to authenticated staff accounts and reserve account administration and backups for the appropriate roles.

## Backup Policy

- Supabase automatic database backups will be enabled for production.
- Owner and Admin users can create manual full-app exports.
- Instructor users cannot create backups.
- Full-app exports should include students, attendance, promotions, waivers, class notes, settings, and idea notes.

## Current App Data Mapping

| Current browser storage | Proposed cloud destination |
|---|---|
| `bjj_students` | `students` |
| `bjj_adult_students` | `students` with `program = adult` |
| `bjj_attendance` | `attendance` with no required session |
| `bjj_adult_attendance` | `attendance` with `session_id` |
| `bjj_promotions` | `promotions` |
| `bjj_adult_promotions` | `promotions` |
| `bjj_waivers` | `waivers` |
| `bjj_class_notes` | `class_notes` |
| `bjj_adult_class_settings` | `class_sessions` and/or `app_settings` |
| belt-size storage keys | `app_settings` |
| `bjj_idea_notebook` | `idea_notes` |

## Important Decisions Before Implementation

1. Whether kids and adult students should share one student list, or remain in separate tables.
2. Which staff roles can view waivers and personal contact information.
3. Whether instructors can edit student records or only attendance and class notes.
4. Whether class notes should be private to staff.
5. Waiver history must be retained rather than overwritten.
6. The idea notebook is shared between authorized staff users.
7. Automatic database backups plus manual full-app exports for Owner and Admin users.

## Recommended Direction

Use one `students` table with a `program` field, separate history tables for attendance, promotions, and waivers, and Supabase Auth plus `user_profiles` for staff access. This matches the relationships already present in the app while keeping the design understandable and flexible.
