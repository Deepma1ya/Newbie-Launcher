import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowSquareOut,
  Copy,
  TerminalWindow,
  Trash,
  X,
  StopCircle
} from '@phosphor-icons/react'
import { toast, useUi } from '../store/ui'
import { useInstance } from '../hooks/queries'
import { cn, errorMessage } from '../lib/utils'
import { Button, IconButton } from './ui/Button'

const EMPTY_LOGS: string[] = []

export function ConsoleDrawer() {
  const consoleState = useUi((state) => state.modal.console)
  const closeModal = useUi((state) => state.closeModal)
  const logs = useUi((state) => (consoleState ? state.logs[consoleState.instanceId] ?? EMPTY_LOGS : EMPTY_LOGS))
  const appendLog = useUi((state) => state.appendLog)
  const clearLogs = useUi((state) => state.clearLogs)
  const running = useUi((state) => state.running)
  const instance = useInstance(consoleState?.instanceId).data
  const scrollRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [stopping, setStopping] = useState(false)

  const open = Boolean(consoleState)
  const instanceId = consoleState?.instanceId
  const isRunning = running.some((entry) => entry.instanceId === instanceId)

  useEffect(() => {
    if (!open || !instanceId) return
    if ((useUi.getState().logs[instanceId] ?? []).length > 0) return
    void window.newbie.instances
      .logs(instanceId)
      .then((lines) => {
        for (const line of lines) appendLog(instanceId, line)
      })
      .catch(() => undefined)
  }, [open, instanceId, appendLog])

  useEffect(() => {
    if (!autoScroll || !scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [logs, autoScroll])

  const handleScroll = (): void => {
    const element = scrollRef.current
    if (!element) return
    setAutoScroll(element.scrollHeight - element.scrollTop - element.clientHeight < 40)
  }

  const copyLogs = async (): Promise<void> => {
    await navigator.clipboard.writeText(logs.join('\n'))
    toast('success', 'Console copied', `${logs.length} lines copied to the clipboard`)
  }

  const stop = async (): Promise<void> => {
    if (!instanceId) return
    setStopping(true)
    try {
      await window.newbie.instances.stop(instanceId)
    } catch (error) {
      toast('error', 'Could not stop Minecraft', errorMessage(error))
    } finally {
      setStopping(false)
    }
  }

  return (
    <AnimatePresence>
      {consoleState && (
        <motion.section
          initial={{ y: 320, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 320, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          className="fixed bottom-0 left-[218px] right-0 z-[80] flex h-[310px] flex-col border-t border-line/70 bg-[#080C09]/97 shadow-[0_-24px_80px_-20px_rgba(0,0,0,0.85)] backdrop-blur-xl"
          aria-label="Minecraft console"
        >
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-line/40 px-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className={cn('h-2 w-2 rounded-full', isRunning ? 'bg-grass shadow-[0_0_8px_rgba(110,231,160,0.8)]' : 'bg-muted/50')} />
              <TerminalWindow size={16} className="text-muted" aria-hidden="true" />
              <span className="truncate text-[12px] font-medium text-ink">{instance?.name ?? 'Minecraft'} console</span>
              {isRunning && <span className="text-[10px] uppercase tracking-[0.1em] text-grass/80">Live</span>}
              {!isRunning && <span className="text-[10px] uppercase tracking-[0.1em] text-muted/60">History</span>}
            </div>
            <div className="flex items-center gap-0.5">
              <IconButton label="Open log folder" onClick={() => instanceId && void window.newbie.instances.openFolder(instanceId, 'logs')}>
                <ArrowSquareOut size={15} />
              </IconButton>
              <IconButton label="Copy console" onClick={() => void copyLogs()}>
                <Copy size={15} />
              </IconButton>
              <IconButton label="Clear console" onClick={() => instanceId && clearLogs(instanceId)}>
                <Trash size={15} />
              </IconButton>
              {isRunning && (
                <Button variant="danger" size="sm" loading={stopping} onClick={() => void stop()} icon={<StopCircle size={14} />}>
                  Stop
                </Button>
              )}
              <IconButton label="Close console" onClick={() => closeModal('console')}>
                <X size={15} />
              </IconButton>
            </div>
          </div>
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="scroll-mask min-h-0 flex-1 overflow-y-auto bg-[#060907] px-4 py-2.5 font-mono text-[11.5px] leading-[1.65]"
          >
            {logs.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted/60">
                <TerminalWindow size={22} />
                <p className="text-[11px]">Launch an instance to see its live log here.</p>
              </div>
            ) : (
              logs.map((line, index) => (
                <div
                  key={`${index}-${line.slice(0, 12)}`}
                  className={cn(
                    'whitespace-pre-wrap break-all',
                    line.startsWith('Hint:') || line.startsWith('Launching') || line.startsWith('Java:') || line.startsWith('Memory:')
                      ? 'text-grass/75'
                      : /error|exception|failed|crash/i.test(line)
                        ? 'text-danger/90'
                        : /warn/i.test(line)
                          ? 'text-gold/80'
                          : 'text-[#A9B8AC]/85'
                  )}
                >
                  {line}
                </div>
              ))
            )}
            {!autoScroll && (
              <button
                onClick={() => setAutoScroll(true)}
                className="sticky bottom-2 left-1/2 mx-auto mt-2 block rounded-full border border-line bg-elevated px-3 py-1 text-[10px] text-muted shadow-lift hover:text-ink"
              >
                Jump to latest
              </button>
            )}
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
