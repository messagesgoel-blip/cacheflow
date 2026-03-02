'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { ProviderId } from '@/lib/providers/types'

export type ModalType = 'connect' | 'disconnect' | 'manage' | null

export interface ModalState {
  isOpen: boolean
  modalType: ModalType
  providerId: ProviderId | null
}

export interface IntegrationContextValue {
  modalState: ModalState
  openConnectModal: (providerId: ProviderId) => void
  openDisconnectModal: (providerId: ProviderId) => void
  openManageModal: (providerId: ProviderId) => void
  closeModal: () => void
}

const initialState: ModalState = {
  isOpen: false,
  modalType: null,
  providerId: null,
}

const IntegrationContext = createContext<IntegrationContextValue | null>(null)

export function IntegrationProvider({ children }: { children: ReactNode }) {
  const [modalState, setModalState] = useState<ModalState>(initialState)

  const openConnectModal = useCallback((providerId: ProviderId) => {
    setModalState({ isOpen: true, modalType: 'connect', providerId })
  }, [])

  const openDisconnectModal = useCallback((providerId: ProviderId) => {
    setModalState({ isOpen: true, modalType: 'disconnect', providerId })
  }, [])

  const openManageModal = useCallback((providerId: ProviderId) => {
    setModalState({ isOpen: true, modalType: 'manage', providerId })
  }, [])

  const closeModal = useCallback(() => {
    setModalState(initialState)
  }, [])

  return (
    <IntegrationContext.Provider value={{ modalState, openConnectModal, openDisconnectModal, openManageModal, closeModal }}>
      {children}
    </IntegrationContext.Provider>
  )
}

export function useIntegration() {
  const context = useContext(IntegrationContext)
  if (!context) {
    throw new Error('useIntegration must be used within IntegrationProvider')
  }
  return context
}
