// frontend/src/constants/synopsisSchema.js
/**
 * Synopsis Schema - Single Source of Truth for Field Names
 * ⚠️ CRITICAL: Keep in sync with backend/schemas/synopsis_schema.py
 */

export const SynopsisWeekFields = {
  WEEK_ID: 'week_id',
  LABEL: 'label',
  START_DATE: 'start_date',
  END_DATE: 'end_date',
  IS_ACTIVE: 'is_active',
  DRIVE_LINK: 'drive_link',
  CREATED_BY: 'created_by',
  CREATED_AT: 'created_at',
};

export const SynopsisCampFields = {
  CAMP_ID: 'camp_id',
  WEEK_ID: 'week_id',
  GROUP_NAME: 'group_name',     // e.g. "Junior Robotics, Art, & Sports Camp"
  CAMP_NAME: 'camp_name',       // e.g. "Junior Robotics"
  AGE_GROUP: 'age_group',       // e.g. "Ages 5–8" or "Grades 1–3"
  TEACHER_NAME: 'teacher_name',
  TIME_START: 'time_start',     // e.g. "9:00 AM"
  TIME_END: 'time_end',         // e.g. "12:00 PM"
  CREATED_AT: 'created_at',
};

export const SynopsisEntryFields = {
  ENTRY_ID: 'entry_id',
  CAMP_ID: 'camp_id',
  WEEK_ID: 'week_id',
  DAY: 'day',
  DAY_TITLE: 'day_title',
  RAW_TEXT: 'raw_text',
  POLISHED_TEXT: 'polished_text',
  PHOTO_URLS: 'photo_urls',
  STATUS: 'status',
  UPDATED_AT: 'updated_at',
};

export const VALID_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];

export const DAY_LABELS = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
};

export const PHOTO_MIN = 3;
export const PHOTO_MAX = 6;
export const ICC_ADMIN_DOMAIN = 'indiacc.org';

export const FoodFields = {
  MORNING_SNACK: 'morning_snack',
  LUNCH: 'lunch',
  AFTERNOON_SNACK: 'afternoon_snack',
};
