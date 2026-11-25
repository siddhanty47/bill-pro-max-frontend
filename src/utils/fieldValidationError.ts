/**
 * A client-side check refused an inline edit's value (e.g. a malformed credit-note deadline).
 * `EditableField` shows its message under the input; any other thrown error reads "Save failed",
 * so raw runtime messages never reach the screen.
 */
export class FieldValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FieldValidationError';
  }
}
