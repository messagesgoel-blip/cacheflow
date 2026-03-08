'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  ONBOARDING_MILESTONE_EVENT,
  readOnboardingMilestones,
  setOnboardingDismissed,
  type OnboardingMilestones,
} from '@/lib/ui/onboardingMilestones'

type ChecklistStep = {
  id: string
  label: string
  description: string
  href: string
  cta: string
  completed: boolean
}

export default function OnboardingChecklist({ connectedProviderCount }: { connectedProviderCount: number }) {
  const [milestones, setMilestones] = useState<OnboardingMilestones>(() => readOnboardingMilestones())
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)

  useEffect(() => {
    const syncMilestones = () => setMilestones(readOnboardingMilestones())

    syncMilestones()
    window.addEventListener(ONBOARDING_MILESTONE_EVENT, syncMilestones)

    return () => {
      window.removeEventListener(ONBOARDING_MILESTONE_EVENT, syncMilestones)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadTwoFactorStatus = async () => {
      try {
        const response = await fetch('/api/auth/2fa/status', {
          credentials: 'include',
          cache: 'no-store',
        })
        if (!response.ok) return
        const payload = await response.json().catch(() => ({}))
        if (!cancelled) {
          setTwoFactorEnabled(Boolean(payload?.enabled))
        }
      } catch {
        if (!cancelled) setTwoFactorEnabled(false)
      }
    }

    void loadTwoFactorStatus()
    return () => {
      cancelled = true
    }
  }, [])

  const steps = useMemo<ChecklistStep[]>(() => {
    return [
      {
        id: 'providers',
        label: 'Connect a provider',
        description: 'Add at least one storage provider or VPS endpoint to the control plane.',
        href: '/providers',
        cta: connectedProviderCount > 0 ? 'Review providers' : 'Connect provider',
        completed: connectedProviderCount > 0,
      },
      {
        id: 'upload',
        label: 'Upload your first file',
        description: 'Use the file browser upload action against a writable provider scope.',
        href: '/files',
        cta: milestones.uploadCompleted ? 'Open files' : 'Upload file',
        completed: milestones.uploadCompleted,
      },
      {
        id: 'transfer',
        label: 'Run a transfer',
        description: 'Copy or move a file across providers using the transfer modal.',
        href: '/files',
        cta: milestones.transferCompleted ? 'Review transfers' : 'Start transfer',
        completed: milestones.transferCompleted,
      },
      {
        id: 'security',
        label: 'Enable two-factor auth',
        description: 'Secure your account with the existing TOTP setup and recovery flow.',
        href: '/settings/security',
        cta: twoFactorEnabled ? 'Review security' : 'Enable 2FA',
        completed: twoFactorEnabled,
      },
    ]
  }, [connectedProviderCount, milestones.transferCompleted, milestones.uploadCompleted, twoFactorEnabled])

  const completedCount = steps.filter((step) => step.completed).length
  const progressPercent = Math.round((completedCount / steps.length) * 100)

  if (milestones.dismissed || completedCount === steps.length) return null

  return (
    <section data-testid="cf-dashboard-onboarding" className="cf-panel overflow-hidden rounded-[28px]">
      <div className="h-1 bg-[var(--cf-bg3)]">
        <div
          className="h-full bg-[linear-gradient(90deg,var(--cf-blue),var(--cf-teal))] transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="border-b border-[var(--cf-border)] px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="cf-kicker">Onboarding</div>
            <h2 className="mt-2 text-xl font-semibold text-[var(--cf-text-0)]">Complete the core CacheFlow setup path.</h2>
            <p className="mt-2 text-sm text-[var(--cf-text-1)]">
              {completedCount} of {steps.length} milestones completed.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOnboardingDismissed(true)}
            className="rounded-xl border border-[var(--cf-border)] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--cf-text-2)] hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)]"
          >
            Dismiss
          </button>
        </div>
      </div>

      <div className="space-y-3 px-6 py-5">
        {steps.map((step, index) => (
          <div
            key={step.id}
            data-testid={`cf-dashboard-onboarding-step-${step.id}`}
            className={`rounded-[22px] border px-4 py-4 transition ${
              step.completed
                ? 'border-[rgba(74,222,128,0.22)] bg-[rgba(74,222,128,0.08)]'
                : 'border-[var(--cf-border)] bg-[var(--cf-panel-soft)]'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full border font-mono text-[10px] font-bold uppercase ${
                      step.completed
                        ? 'border-[rgba(74,222,128,0.22)] bg-[rgba(74,222,128,0.14)] text-[var(--cf-green)]'
                        : 'border-[var(--cf-border)] text-[var(--cf-text-3)]'
                    }`}
                  >
                    {step.completed ? 'OK' : index + 1}
                  </span>
                  <div>
                    <div className={`text-sm ${step.completed ? 'font-medium text-[var(--cf-text-1)]' : 'font-semibold text-[var(--cf-text-0)]'}`}>
                      {step.label}
                    </div>
                    <div className="mt-1 text-[12px] leading-5 text-[var(--cf-text-2)]">{step.description}</div>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] ${
                    step.completed
                      ? 'border-[rgba(74,222,128,0.22)] bg-[rgba(74,222,128,0.12)] text-[var(--cf-green)]'
                      : 'border-[rgba(74,158,255,0.22)] bg-[rgba(74,158,255,0.08)] text-[var(--cf-blue)]'
                  }`}
                >
                  {step.completed ? 'Complete' : 'Pending'}
                </span>
                <Link
                  href={step.href}
                  className="rounded-xl border border-[var(--cf-border)] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--cf-text-2)] hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)]"
                >
                  {step.cta}
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
