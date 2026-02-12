interface ApiError {
    error?: {
        message?: string;
    };
}

export function ExtractErrorMessage(error: unknown): string {
    if (
        typeof error === 'object' &&
        error !== null &&
        'error' in error
    ) {
        const apiError = error as ApiError;
        return apiError.error?.message ?? 'Došlo je do greške.';
    }
    return 'Došlo je do greške.';
}