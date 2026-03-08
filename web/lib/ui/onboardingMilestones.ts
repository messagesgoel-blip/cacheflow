'use client'

export type OnboardingMilestoneKey = 'uploadCompleted' | 'transferCompleted'

export type OnboardingMilestones = {
  uploadCompleted: boolean
  transferCompleted: boolean
  dismissed: boolean
}

export const ONBOARDING_MILESTONE_EVENT = 'cacheflow:onboarding-updated'

const STORAGE_KEY = 'cacheflow:onboarding-milestones'

const DEFAULT_STATE: OnboardingMilestones = {
  uploadCompleted: false,
  transferCompleted: false,
  dismissed: false,
}

export function readOnboardingMilestones(): OnboardingMilestones {
  if (typeof window === 'undefined') return DEFAULT_STATE

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STATE
    const parsed = JSON.parse(raw) as Partial<OnboardingMilestones>
    return {
      uploadCompleted: Boolean(parsed.uploadCompleted),
      transferCompleted: Boolean(parsed.transferCompleted),
      dismissed: Boolean(parsed.dismissed),
    }
  } catch {
    return DEFAULT_STATE
  }
}

function writeOnboardingMilestones(next: OnboardingMilestones) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent(ONBOARDING_MILESTONE_EVENT, { detail: next }))
}

export function markOnboardingMilestone(key: OnboardingMilestoneKey) {
  const current = readOnboardingMilestones()
  if (current[key]) return
  writeOnboardingMilestones({ ...current, [key]: true })
}

export function setOnboardingDismissed(dismissed: boolean) {
  const current = readOnboardingMilestones()
  writeOnboardingMilestones({ ...current, dismissed })
}
