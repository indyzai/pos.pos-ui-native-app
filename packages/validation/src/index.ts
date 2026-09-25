export type ValidationResult<T> =
  | { success: true; value: T }
  | { success: false; errors: readonly string[] };

export interface Validator<T> {
  validate(value: unknown): ValidationResult<T>;
}
