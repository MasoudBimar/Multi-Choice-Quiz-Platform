export const STORAGE_KEYS = {
  uiPrefs: 'ui_prefs',
  quizHistory: 'quiz_history',
  quizAttempt: (quizId: string) => `quiz_attempt::${quizId}`,
  quizStats: (quizId: string) => `quiz_stats::${quizId}`,
  quizAttemptArchive: (attemptId: string) => `quiz_attempt_archive::${attemptId}`,
};
