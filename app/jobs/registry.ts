import { generateDemo } from '#jobs/generate_demo'
import type { GenerationPlan } from '#services/generation/plan'

/**
 * Every generation plan, one per content type. The worker finds a job's
 * plan by job name; the web finds a generation's plan by template key.
 */
const plans: GenerationPlan[] = [generateDemo]

export function planForJob(jobName: string) {
  return plans.find((plan) => plan.jobName === jobName)
}

export function planForTemplate(templateKey: string) {
  return plans.find((plan) => plan.templateKey === templateKey)
}
