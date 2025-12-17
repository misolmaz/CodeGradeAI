import { Assignment, Announcement, Submission } from '../types';
import { INITIAL_ASSIGNMENTS, INITIAL_ANNOUNCEMENTS, INITIAL_SUBMISSIONS } from '../constants';

const KEYS = {
  ASSIGNMENTS: 'codegrade_assignments',
  SUBMISSIONS: 'codegrade_submissions',
  ANNOUNCEMENTS: 'codegrade_announcements'
};

export const db = {
  // Assignments
  getAssignments: (): Assignment[] => {
    try {
      const stored = localStorage.getItem(KEYS.ASSIGNMENTS);
      if (!stored) {
        // Initialize with default data if empty
        localStorage.setItem(KEYS.ASSIGNMENTS, JSON.stringify(INITIAL_ASSIGNMENTS));
        return INITIAL_ASSIGNMENTS;
      }
      return JSON.parse(stored);
    } catch (e) {
      console.error("Storage error", e);
      return INITIAL_ASSIGNMENTS;
    }
  },

  saveAssignment: (assignment: Assignment): Assignment[] => {
    const current = db.getAssignments();
    const updated = [assignment, ...current];
    localStorage.setItem(KEYS.ASSIGNMENTS, JSON.stringify(updated));
    return updated;
  },

  // Submissions
  getSubmissions: (): Submission[] => {
    try {
      const stored = localStorage.getItem(KEYS.SUBMISSIONS);
      if (!stored) {
        localStorage.setItem(KEYS.SUBMISSIONS, JSON.stringify(INITIAL_SUBMISSIONS));
        return INITIAL_SUBMISSIONS;
      }
      return JSON.parse(stored);
    } catch (e) {
      return INITIAL_SUBMISSIONS;
    }
  },

  saveSubmission: (submission: Submission): Submission[] => {
    const current = db.getSubmissions();
    const updated = [submission, ...current];
    localStorage.setItem(KEYS.SUBMISSIONS, JSON.stringify(updated));
    return updated;
  },

  deleteSubmission: (submissionId: string): Submission[] => {
    const current = db.getSubmissions();
    const updated = current.filter(s => s.id !== submissionId);
    localStorage.setItem(KEYS.SUBMISSIONS, JSON.stringify(updated));
    return updated;
  },

  // Announcements (Read-only for now, but prepped for storage)
  getAnnouncements: (): Announcement[] => {
    try {
      const stored = localStorage.getItem(KEYS.ANNOUNCEMENTS);
      if (!stored) return INITIAL_ANNOUNCEMENTS;
      return JSON.parse(stored);
    } catch (e) {
      return INITIAL_ANNOUNCEMENTS;
    }
  }
};
