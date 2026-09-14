/**
 * מונה קריאות ל-api-football.
 *
 * השכבה החינמית נותנת 100 קריאות ביום. הסקריפט הזה רץ כמה פעמים ביום,
 * ולכן כל הרצה מקבלת תקציב משלה — ואם התקציב נגמר, ההרצה עוצרת בשקט
 * ומשאירה את הקאש הקודם במקומו במקום לחזור עם נתונים חלקיים.
 */
export class Budget {
  constructor(limit) {
    this.limit = limit;
    this.used = 0;
    this.skipped = 0;
  }

  /** האם נשארו מספיק קריאות ל-n קריאות נוספות. */
  can(n = 1) {
    return this.used + n <= this.limit;
  }

  spend(n = 1) {
    this.used += n;
  }

  skip(reason) {
    this.skipped++;
    console.warn(`[budget] דילוג: ${reason} (${this.used}/${this.limit})`);
  }
}
