// Gestione errori standardizzata
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number = 400
  ) {
    super(message);
  }
}

export const Errors = {
  UNAUTHORIZED: new AppError('Non autorizzato', 'UNAUTHORIZED', 401),
  FORBIDDEN: new AppError('Non hai i permessi', 'FORBIDDEN', 403),
  NOT_FOUND: new AppError('Risorsa non trovata', 'NOT_FOUND', 404),
  ALREADY_MEMBER: new AppError('Utente già membro', 'ALREADY_MEMBER', 409),
  BANNED: new AppError('Sei stato bannato da questo workspace', 'BANNED', 403),
  INVALID_ROLE: new AppError('Ruolo non valido', 'INVALID_ROLE', 400),
  CANNOT_MODERATE: new AppError('Non puoi moderare questo utente', 'CANNOT_MODERATE', 403),
};

export function success(data: any) {
  return new Response(JSON.stringify({ success: true, data }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  });
}

export function error(err: AppError | Error) {
  const isAppError = err instanceof AppError;
  return new Response(
    JSON.stringify({
      success: false,
      error: err.message,
      code: isAppError ? (err as AppError).code : 'INTERNAL_ERROR',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      status: isAppError ? (err as AppError).status : 500,
    }
  );
}
