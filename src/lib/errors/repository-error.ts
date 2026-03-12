export class RepositoryError extends Error {
  constructor(
    message: string,
    public originalError?: unknown,
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

export function handleRepositoryError(context: string, error: unknown): never {
  console.error(`${context} error:`, error);

  if (error instanceof RepositoryError) {
    throw error;
  }

  if (error instanceof Error) {
    throw new RepositoryError(`${context} failed: ${error.message}`, error);
  }

  throw new RepositoryError(`${context} failed: Unknown error`, error);
}
