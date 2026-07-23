export const STEPS = [
  'CONTACT_VERIFIED',
  'CONSENT_CAPTURED',
  'ELIGIBILITY_COMPLETED',
  'APPOINTMENT_BOOKED',
] as const;

export type Step = (typeof STEPS)[number];
export type Eligibility = 'PENDING' | 'ELIGIBLE' | 'INELIGIBLE';
export type WorkflowStatus = 'ACTIVE' | 'COMPLETED' | 'VERIFICATION_FAILED';

export interface WorkflowRow {
  id: string;
  patient_id: string;
  age: number;
  status: WorkflowStatus;
  eligibility: Eligibility;
  completed_steps: Step[];
  current_step: Step | null;
  version: number;
}

export class HttpProblem extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
