export interface ThrottleConfig {
  maxBytesPerSecond: number | null
}

export interface ScheduledJob {
  id: string
  name: string
  jobType: string
  cronExpression: string
  enabled: boolean
  throttle?: ThrottleConfig
  lastRunAt: string | null
  nextRunAt: string | null
  createdAt: string
  updatedAt: string
}
