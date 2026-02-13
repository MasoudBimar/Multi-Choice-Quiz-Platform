import { QuizCompatibilityResult, QuizAttemptPersisted, QuizDefinition } from '../../data/models/quiz.models';

export function checkAttemptCompatibility(
  attempt: QuizAttemptPersisted,
  definition: QuizDefinition,
): QuizCompatibilityResult {
  if (attempt.quizVersion !== definition.version) {
    return {
      compatible: false,
      reason: `Saved attempt version ${attempt.quizVersion} does not match current quiz version ${definition.version}.`,
    };
  }

  const questionIds = new Set(definition.questions.map((question) => question.id));

  for (const questionId of attempt.order.questionIds) {
    if (!questionIds.has(questionId)) {
      return {
        compatible: false,
        reason: `Saved attempt references removed question '${questionId}'.`,
      };
    }
  }

  for (const question of definition.questions) {
    if (!attempt.order.choiceOrderByQuestionId[question.id]) {
      return {
        compatible: false,
        reason: `Saved attempt is missing choice order for question '${question.id}'.`,
      };
    }

    const savedChoiceIds = attempt.order.choiceOrderByQuestionId[question.id];
    const currentChoiceIds = question.choices.map((choice) => choice.id);

    if (savedChoiceIds.length !== currentChoiceIds.length) {
      return {
        compatible: false,
        reason: `Choice count changed for question '${question.id}'.`,
      };
    }

    const savedSet = new Set(savedChoiceIds);
    if (savedSet.size !== currentChoiceIds.length || currentChoiceIds.some((id) => !savedSet.has(id))) {
      return {
        compatible: false,
        reason: `Choices changed for question '${question.id}'.`,
      };
    }
  }

  return { compatible: true };
}
