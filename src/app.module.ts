import { Module } from '@nestjs/common';
import { Database } from './database';
import { DebugController } from './debug.controller';
import { HttpProblemFilter } from './http-exception.filter';
import { UiController } from './ui.controller';
import { MockVerificationClient } from './verification.client';
import { WorkflowController } from './workflow.controller';
import { VERIFICATION_CLIENT, WorkflowService } from './workflow.service';

@Module({
  controllers: [UiController, WorkflowController, DebugController],
  providers: [
    Database,
    WorkflowService,
    HttpProblemFilter,
    { provide: VERIFICATION_CLIENT, useClass: MockVerificationClient },
  ],
})
export class AppModule {}
