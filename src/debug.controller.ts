import { Body, Controller, Param, Post } from '@nestjs/common';
import { Step } from './types';
import { WorkflowService } from './workflow.service';

@Controller('debug')
export class DebugController {
  constructor(private readonly workflows: WorkflowService) {}

  @Post('workflows/:id/crash-after-workflow-update')
  async crashAfterWorkflowUpdate(
    @Param('id') id: string,
    @Body() body: { eventId: string; step: Step },
  ) {
    if (process.env.ENABLE_DEBUG_ROUTES !== 'true') {
      return { enabled: false };
    }

    await this.workflows.simulateCrashAfterWorkflowUpdate(id, body.eventId, body.step);
  }
}
