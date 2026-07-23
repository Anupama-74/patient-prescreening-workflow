import { Body, Controller, Get, HttpCode, Param, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { Step } from './types';
import { WorkflowService } from './workflow.service';

@Controller('workflows')
export class WorkflowController {
  constructor(private readonly workflows: WorkflowService) {}

  @Post()
  async create(@Body() body: { patientId: string; age: number }) {
    return this.workflows.createWorkflow(body.patientId, body.age);
  }

  @Post(':id/events')
  @HttpCode(202)
  async event(
    @Param('id') id: string,
    @Body() body: { eventId: string; step: Step },
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.workflows.applyEvent(id, body.eventId, body.step);
    response.status(result.code);
    if (result.error) return { error: result.error };
    return { accepted: result.code === 202 };
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.workflows.getWorkflow(id);
  }
}
