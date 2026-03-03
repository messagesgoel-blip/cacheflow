import type { Metadata } from 'next'
import { Suspense } from 'react'
import './globals.css'
import SessionHandler from '@/components/SessionHandler'
import ActionCenterProvider from '@/components/ActionCenterProvider'
import { TransferQueueProvider } from '@/components/TransferQueueProvider'

export const metadata: Metadata = {
  title: 'CacheFlow',
  description: 'All your cloud storage in one place',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'CacheFlow',
  },
  icons: {
    icon: [{ url: '/icons/icon.svg', type: 'image/svg+xml' }],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#3b82f6" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('cf_theme');
                  if (!theme) {
                    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  }
                  document.documentElement.classList.add(theme);
                } catch (e) {}
              })();

              // Register service worker
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(registration) {
                      console.log('SW registered:', registration.scope);
                    })
                    .catch(function(error) {
                      console.log('SW registration failed:', error);
                    });
                });
              }
            `,
          }}
        />
      </head>
      <body className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <Suspense fallback={null}>
          <SessionHandler />
        </Suspense>
        <ActionCenterProvider>
          <TransferQueueProvider>
            {children}
          </TransferQueueProvider>
        </ActionCenterProvider>
      </body>
    </html>
  )
}
