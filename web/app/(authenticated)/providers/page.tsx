import ProviderHub from '@/components/ProviderHub'
import MissionControl from '@/components/MissionControl'
import { IntegrationProvider } from '@/context/IntegrationContext'
import ConnectProviderModal from '@/components/modals/ConnectProviderModal'
import WebDAVModal from '@/components/modals/WebDAVModal'
import VPSModal from '@/components/modals/VPSModal'

export default function ProvidersPage() {
  return (
    <IntegrationProvider>
      <div className="relative z-0 overflow-auto">
        <main className="relative z-0 mx-auto max-w-[1600px] overflow-auto px-4 pb-6 pt-4 md:px-6 md:pb-6 md:pt-4">
          <MissionControl />
          <ProviderHub />
        </main>
        <ConnectProviderModal />
        <WebDAVModal />
        <VPSModal />
      </div>
    </IntegrationProvider>
  )
}
