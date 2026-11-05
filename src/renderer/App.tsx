import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AppShell } from './components/AppShell'
import { useAppEvents } from './hooks/useAppEvents'
import { useInstances, useSettings } from './hooks/queries'
import { useUi } from './store/ui'
import { LogoMark } from './components/Sidebar'
import { HomePage } from './pages/HomePage'
import { InstancesPage } from './pages/InstancesPage'
import { InstancePage } from './pages/InstancePage'
import { BrowsePage } from './pages/BrowsePage'
import { LibraryPage } from './pages/LibraryPage'
import { DownloadsPage } from './pages/DownloadsPage'
import { AccountsPage } from './pages/AccountsPage'
import { SettingsPage } from './pages/SettingsPage'
import { CreateInstanceModal } from './components/modals/CreateInstanceModal'
import { AddAccountModal } from './components/modals/AddAccountModal'
import { ModDetailModal } from './components/modals/ModDetailModal'
import { LoadoutModal } from './components/modals/LoadoutModal'
import { RepairModal } from './components/modals/RepairModal'
import { Onboarding } from './components/Onboarding'

export default function App() {
  useAppEvents()
  const settings = useSettings()
  const instances = useInstances()
  const location = useLocation()
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const activeInstanceId = useUi((state) => state.activeInstanceId)
  const setActiveInstance = useUi((state) => state.setActiveInstance)
  const [booted, setBooted] = useState(false)
  const [onboardingDone, setOnboardingDone] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setBooted(true), 260)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (activeInstanceId || !instances.data?.length) return
    setActiveInstance(instances.data[0]!.id)
  }, [activeInstanceId, instances.data, setActiveInstance])

  useEffect(() => {
    Promise.all([window.newbie.instances.running(), window.newbie.tasks.list(), window.newbie.updater.state()])
      .then(([running, tasks, update]) => {
        const ui = useUi.getState()
        running.forEach((entry) => ui.setRunning(entry))
        tasks.forEach((task) => ui.setTask(task))
        ui.setUpdate(update)
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    const unsubscribe = window.newbie.app.onEvent((event) => {
      if (event.type === 'navigate') {
        navigate(event.payload.page)
      }
    })
    return unsubscribe
  }, [navigate])

  if (!booted || settings.isLoading) {
    return (
      <div className="app-bg flex h-full flex-col items-center justify-center gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1.02 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <LogoMark size={56} />
        </motion.div>
        <div className="font-display text-[12px] font-medium tracking-[0.18em] text-muted/70">NEWBIE LAUNCHER</div>
        <div className="h-0.5 w-24 overflow-hidden rounded-full bg-line/60">
          <div className="h-full w-1/2 animate-[shimmer_1.6s_ease_infinite] rounded-full bg-grass" />
        </div>
      </div>
    )
  }

  const showOnboarding = settings.data && !settings.data.onboardingComplete && !onboardingDone

  return (
    <>
      <AppShell>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={reduced ? { opacity: 1 } : { opacity: 0, y: 9 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 1 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <Routes location={location}>
              <Route path="/" element={<HomePage />} />
              <Route path="/instances" element={<InstancesPage />} />
              <Route path="/instances/:id" element={<InstancePage />} />
              <Route path="/browse" element={<BrowsePage />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/downloads" element={<DownloadsPage />} />
              <Route path="/accounts" element={<AccountsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </AppShell>
      <CreateInstanceModal />
      <AddAccountModal />
      <ModDetailModal />
      <LoadoutModal />
      <RepairModal />
      <Onboarding open={Boolean(showOnboarding)} onDone={() => setOnboardingDone(true)} />
    </>
  )
}
