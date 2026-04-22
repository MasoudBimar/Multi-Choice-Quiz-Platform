import {
  QuizCatalog,
  QuizCatalogEntry,
  QuizDefinition,
  QuizQuestion,
  QuizQuestionType,
} from '../models/quiz.models';

export interface ValidationResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isQuestionType(value: unknown): value is QuizQuestionType {
  return value === 'single' || value === 'multi';
}

function unique(values: string[]): boolean {
  return new Set(values).size === values.length;
}

function validateCatalogEntry(value: unknown, index: number): ValidationResult<QuizCatalogEntry> {
  if (!isRecord(value)) {
    return { ok: false, error: `Catalog item at index ${index} must be an object.` };
  }

  const { id, title, description, jsonPath, timeLimitSeconds, shuffleQuestions, shuffleAnswers, quizzBackgroundColor } = value;

  if (!isNonEmptyString(id)) {
    return { ok: false, error: `Catalog item at index ${index} has an invalid id.` };
  }

  if (!isNonEmptyString(quizzBackgroundColor)) {
    return { ok: false, error: `Background Color at index ${index} has an invalid data.` };
  }

  if (!isNonEmptyString(title) || !isNonEmptyString(description) || !isNonEmptyString(jsonPath)) {
    return { ok: false, error: `Catalog item '${id}' is missing title, description, or jsonPath.` };
  }

  if (timeLimitSeconds !== undefined && (typeof timeLimitSeconds !== 'number' || timeLimitSeconds <= 0)) {
    return { ok: false, error: `Catalog item '${id}' has an invalid timeLimitSeconds.` };
  }

  if (shuffleQuestions !== undefined && typeof shuffleQuestions !== 'boolean') {
    return { ok: false, error: `Catalog item '${id}' has invalid shuffleQuestions.` };
  }

  if (shuffleAnswers !== undefined && typeof shuffleAnswers !== 'boolean') {
    return { ok: false, error: `Catalog item '${id}' has invalid shuffleAnswers.` };
  }

  return {
    ok: true,
    value: {
      id,
      title,
      description,
      jsonPath,
      timeLimitSeconds,
      shuffleQuestions,
      shuffleAnswers,
      quizzBackgroundColor
    },
  };
}

export function validateQuizCatalog(value: unknown): ValidationResult<QuizCatalog> {
  if (!isRecord(value) || !Array.isArray(value['quizzes'])) {
    return { ok: false, error: "Catalog file must be an object with a 'quizzes' array." };
  }

  const parsed: QuizCatalogEntry[] = [];

  for (const [index, item] of value['quizzes'].entries()) {
    const result = validateCatalogEntry(item, index);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    parsed.push(result.value as QuizCatalogEntry);
  }

  const ids = parsed.map((quiz) => quiz.id);
  if (!unique(ids)) {
    return { ok: false, error: 'Catalog contains duplicate quiz ids.' };
  }

  return { ok: true, value: { quizzes: parsed } };
}

function validateQuestion(valueData: unknown, index: number): ValidationResult<QuizQuestion> {
  if (!isRecord(valueData)) {
    return { ok: false, error: `Question at index ${index} must be an object.` };
  }

  const { id, type, prompt, choices, correctChoiceIds, explanation, key, label, title, controlType } = valueData;

  if (!isNonEmptyString(id) || !isQuestionType(type) || !isNonEmptyString(prompt)) {
    return { ok: false, error: `Question at index ${index} is missing id, type, or prompt.` };
  }

  if (!Array.isArray(choices) || choices.length < 2) {
    return { ok: false, error: `Question '${id}' must have at least two choices.` };
  }

  const parsedChoices: { id: string; text: string }[] = [];
  for (const [choiceIndex, choice] of choices.entries()) {
    if (!isRecord(choice) || !isNonEmptyString(choice['id']) || !isNonEmptyString(choice['text'])) {
      return { ok: false, error: `Question '${id}' has an invalid choice at index ${choiceIndex}.` };
    }
    parsedChoices.push({ id: choice['id'], text: choice['text'] });
  }

  const choiceIds = parsedChoices.map((choice) => choice.id);
  if (!unique(choiceIds)) {
    return { ok: false, error: `Question '${id}' contains duplicate choice ids.` };
  }

  if (correctChoiceIds === undefined || !Array.isArray(correctChoiceIds)) {
    return { ok: false, error: `Question '${id}' has an invalid correctChoiceIds.` };
  }

  if (type === 'multi') {
    if ((!Array.isArray(correctChoiceIds) || correctChoiceIds.length === 0)) {
      return { ok: false, error: `Question '${id}' must include correctChoiceIds.` };
    }

    if (!correctChoiceIds.every((choiceId) => typeof choiceId === 'string' && choiceIds.includes(choiceId))) {
      return {
        ok: false,
        error: `Question '${id}' has correctChoiceIds that do not match available choices.`,
      };
    }
  }

  if (type === 'single' && ((correctChoiceIds.length !== 1) || !Array.isArray(correctChoiceIds))) {
    return { ok: false, error: `Question '${id}' is single-choice and must have exactly one correct answer.` };
  }

  if (explanation !== undefined && typeof explanation !== 'string') {
    return { ok: false, error: `Question '${id}' has an invalid explanation.` };
  }

  if (key === undefined || key === null || typeof key !== 'string') {
    return { ok: false, error: `Question '${id}' has an invalid key.` };
  }

  if (label === undefined || label === null || typeof label !== 'string') {
    return { ok: false, error: `Question '${id}' has an invalid label.` };
  }

  if (title === undefined || title === null || typeof title !== 'string') {
    return { ok: false, error: `Question '${id}' has an invalid title.` };
  }

  if (controlType === undefined || controlType === null || typeof controlType !== 'string' || (controlType !== 'textbox' && controlType !== 'unknown')) {
    return { ok: false, error: `Question '${id}' has an invalid controlType.` };
  }



  return {
    ok: true,
    value: {
      id,
      type,
      prompt,
      key,
      label,
      title,
      controlType,
      choices: parsedChoices,
      correctChoiceIds: correctChoiceIds,
      explanation,
    },
  };
}

export function validateQuizDefinition(value: unknown): ValidationResult<QuizDefinition> {
  if (!isRecord(value)) {
    return { ok: false, error: 'Quiz file must be an object.' };
  }

  const { id, title, version, questions } = value;

  if (!isNonEmptyString(id) || !isNonEmptyString(title) || typeof version !== 'number') {
    return { ok: false, error: 'Quiz file is missing id, title, or version.' };
  }

  if (!Array.isArray(questions) || questions.length === 0) {
    return { ok: false, error: `Quiz '${id}' must include a non-empty questions array.` };
  }

  const parsedQuestions: QuizQuestion[] = [];
  for (const [index, question] of questions.entries()) {
    const result = validateQuestion(question, index);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    parsedQuestions.push(result.value as QuizQuestion);
  }

  const questionIds = parsedQuestions.map((question) => question.id);
  if (!unique(questionIds)) {
    return { ok: false, error: `Quiz '${id}' contains duplicate question ids.` };
  }

  return {
    ok: true,
    value: {
      id,
      title,
      version,
      questions: parsedQuestions,
    },
  };
}
