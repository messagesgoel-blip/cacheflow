'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { usePathname, useRouter } from 'next/navigation'

type CommandGroup = 'Navigate' | 'Quick Actions'

type PaletteCommand = {
  id: string
  label: string
  hint: string
  keywords: string[]
  group: CommandGroup
  path: string
  eventName?: string
}

const PENDING_COMMAND_KEY = 'cacheflow:pending-command'

const COMMANDS: PaletteCommand[] = [
  { id: 'go-dashboard', label: 'Go to Dashboard', hint: '/dashboard', keywords: ['overview', 'home'], group: 'Navigate', path: '/dashboard' },
  { id: 'go-files', label: 'Go to Files', hint: '/files', keywords: ['storage', 'browser'], group: 'Navigate', path: '/files' },
  { id: 'go-providers', label: 'Go to Providers', hint: '/providers', keywords: ['connections', 'drives'], group: 'Navigate', path: '/providers' },
  { id: 'go-connections', label: 'Go to Connections', hint: '/connections', keywords: ['remotes', 'cloud'], group: 'Navigate', path: '/connections' },
  { id: 'go-schedules', label: 'Go to Schedules', hint: '/schedules', keywords: ['jobs', 'automation'], group: 'Navigate', path: '/schedules' },
  { id: 'go-settings', label: 'Go to Settings', hint: '/settings', keywords: ['preferences'], group: 'Navigate', path: '/settings' },
  { id: 'go-security', label: 'Go to Security', hint: '/settings/security', keywords: ['2fa', 'auth'], group: 'Navigate', path: '/settings/security' },
  { id: 'upload-files', label: 'Upload Files', hint: 'Files action', keywords: ['upload', 'send'], group: 'Quick Actions', path: '/files', eventName: 'cacheflow:command-upload' },
  { id: 'new-folder', label: 'Create Folder', hint: 'Files action', keywords: ['folder', 'mkdir'], group: 'Quick Actions', path: '/files', eventName: 'cacheflow:command-new-folder' },
  { id: 'new-file', label: 'Create Starter File', hint: 'Files action', keywords: ['file', 'template'], group: 'Quick Actions', path: '/files', eventName: 'cacheflow:command-new-file' },
  { id: 'connect-cloud', label: 'Connect Cloud Provider', hint: 'Providers action', keywords: ['google', 'drive', 'onedrive', 'dropbox'], group: 'Quick Actions', path: '/providers', eventName: 'cacheflow:command-connect-cloud' },
  { id: 'connect-vps', label: 'Connect VPS / SFTP', hint: 'Providers action', keywords: ['server', 'ssh', 'sftp'], group: 'Quick Actions', path: '/providers', eventName: 'cacheflow:command-connect-vps' },
]

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

function dispatchCommandEvent(eventName: string) {
  window.dispatchEvent(new CustomEvent(eventName))
}

export default function CommandPalette() {
  const router = useRouter()
  const pathname = usePathname()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const filteredCommands = useMemo(() => {
    const needle = normalize(query)
    if (!needle) return COMMANDS

    return COMMANDS.filter((command) => {
      const haystack = [command.label, command.hint, ...command.keywords].join(' ').toLowerCase()
      return haystack.includes(needle)
    })
  }, [query])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((current) => !current)
        return
      }

      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (!open) return
    setActiveIndex(0)
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = window.sessionStorage.getItem(PENDING_COMMAND_KEY)
    if (!raw) return

    try {
      const pending = JSON.parse(raw) as { path?: string; eventName?: string }
      if (!pending.path || pending.path !== pathname || !pending.eventName) return
      window.sessionStorage.removeItem(PENDING_COMMAND_KEY)
      window.setTimeout(() => dispatchCommandEvent(pending.eventName as string), 80)
    } catch {
      window.sessionStorage.removeItem(PENDING_COMMAND_KEY)
    }
  }, [pathname])

  const runCommand = (command: PaletteCommand) => {
    setOpen(false)
    setQuery('')

    if (!command.eventName) {
      router.push(command.path)
      return
    }

    if (pathname === command.path) {
      dispatchCommandEvent(command.eventName)
      return
    }

    window.sessionStorage.setItem(
      PENDING_COMMAND_KEY,
      JSON.stringify({ path: command.path, eventName: command.eventName }),
    )
    router.push(command.path)
  }

  const groupedCommands = useMemo(
    () =>
      filteredCommands.reduce<Record<CommandGroup, PaletteCommand[]>>(
        (groups, command) => {
          groups[command.group].push(command)
          return groups
        },
        { Navigate: [], 'Quick Actions': [] },
      ),
    [filteredCommands],
  )

  const allVisibleCommands = [...groupedCommands.Navigate, ...groupedCommands['Quick Actions']]

  const handleListKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((current) => (allVisibleCommands.length === 0 ? 0 : (current + 1) % allVisibleCommands.length))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((current) => (allVisibleCommands.length === 0 ? 0 : (current - 1 + allVisibleCommands.length) % allVisibleCommands.length))
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const selected = allVisibleCommands[activeIndex]
      if (selected) runCommand(selected)
    }
  }

  return (
    <>
      <button
        type="button"
        data-testid="cf-command-palette-trigger"
        onClick={() => setOpen(true)}
        className="hidden min-w-[248px] items-center justify-between rounded-xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-3.5 py-1.5 text-left text-[13px] text-[var(--cf-text-2)] transition hover:border-[var(--cf-border-2)] hover:text-[var(--cf-text-0)] lg:flex"
      >
        <span className="truncate pr-3">Jump to page or action</span>
        <span className="rounded-md border border-[var(--cf-border)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--cf-text-3)]">
          Ctrl K
        </span>
      </button>

      {open && (
        <div
          data-testid="cf-command-palette"
          className="fixed inset-0 z-[80] flex items-start justify-center bg-[rgba(3,6,17,0.56)] px-4 pt-[12vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-[var(--cf-border)] bg-[var(--cf-menu-bg)] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-[var(--cf-border)] px-5 py-4">
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleListKeyDown}
                placeholder="Type a route or action"
                className="w-full bg-transparent text-base text-[var(--cf-text-0)] outline-none placeholder:text-[var(--cf-text-3)]"
              />
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-3 py-3">
              {allVisibleCommands.length === 0 ? (
                <div className="rounded-2xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-4 py-6 text-sm text-[var(--cf-text-2)]">
                  No matching routes or actions.
                </div>
              ) : (
                (Object.keys(groupedCommands) as CommandGroup[]).map((group) => {
                  const items = groupedCommands[group]
                  if (items.length === 0) return null
                  const offset = group === 'Navigate' ? 0 : groupedCommands.Navigate.length

                  return (
                    <div key={group} className="mb-3 last:mb-0">
                      <div className="px-2 pb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--cf-text-3)]">
                        {group}
                      </div>
                      <div className="space-y-1">
                        {items.map((command, index) => {
                          const visualIndex = offset + index
                          const isActive = visualIndex === activeIndex

                          return (
                            <button
                              key={command.id}
                              type="button"
                              data-testid={`cf-command-item-${command.id}`}
                              onMouseEnter={() => setActiveIndex(visualIndex)}
                              onClick={() => runCommand(command)}
                              className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left transition ${
                                isActive
                                  ? 'bg-[rgba(74,158,255,0.12)] text-[var(--cf-text-0)]'
                                  : 'text-[var(--cf-text-1)] hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)]'
                              }`}
                            >
                              <span>
                                <span className="block text-sm font-medium">{command.label}</span>
                                <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--cf-text-3)]">
                                  {command.hint}
                                </span>
                              </span>
                              <span className="rounded-full border border-[var(--cf-border)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--cf-text-3)]">
                                {group}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
