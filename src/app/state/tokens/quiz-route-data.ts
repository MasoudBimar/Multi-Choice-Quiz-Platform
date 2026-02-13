import { QuizCatalogEntry, QuizDefinition } from '../../data/models/quiz.models';

export interface QuizResolvedData {
  entry: QuizCatalogEntry;
  definition: QuizDefinition;
}
