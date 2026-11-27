import { AiUsageLogSchema } from '#database/schema'

/**
 * One AI attempt: who, which key (never the key itself), which step,
 * outcome, tokens and latency. No prompt or response text.
 */
export default class AiUsageLog extends AiUsageLogSchema {}
