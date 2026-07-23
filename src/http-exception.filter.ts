import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Response } from 'express';
import { HttpProblem } from './types';

@Catch()
export class HttpProblemFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpProblem) {
      response.status(exception.statusCode).json({ error: exception.message });
      return;
    }
    console.error(exception);
    response.status(500).json({ error: 'internal server error' });
  }
}
