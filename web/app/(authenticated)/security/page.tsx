'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function Security() {
  return (
    <div>
      <div className="max-w-4xl mx-auto py-12 px-4">
        <Link href="/" className="text-blue-600 hover:underline mb-8 block">
          ← Back to Files
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-8">Security & Privacy</h1>

        <div className="space-y-8">
          {/* How your files are protected */}
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              How Your Files Are Protected
            </h2>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-start">
                <span className="text-green-600 mr-2">✓</span>
                Files are encrypted at rest using AES-256
              </li>
              <li className="flex items-start">
                <span className="text-green-600 mr-2">✓</span>
                All connections use TLS 1.3
              </li>
              <li className="flex items-start">
                <span className="text-green-600 mr-2">✓</span>
                Server-Side Encryption + Zero-Retention Processing for AI features
              </li>
            </ul>
          </section>

          {/* AI Conflict Merge */}
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              AI Conflict Merge
            </h2>
            <div className="text-gray-700 space-y-3">
              <p>
                Our AI-powered conflict resolution helps you merge conflicting file versions
                intelligently. Here's how we protect your data:
              </p>
              <ul className="space-y-2">
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  File content is processed in memory only
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  Plaintext is never stored in our database, logs, or cache
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  Only file metadata (ID, timestamp, merge type) is retained
                </li>
              </ul>
              <p className="text-sm text-gray-500 mt-4">
                This is called <strong>Zero-Retention Processing</strong> — your file content
                passes through our systems solely for processing and is never persisted.
              </p>
            </div>
          </section>

          {/* What we retain */}
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              What We Retain
            </h2>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">•</span>
                <span>
                  <strong>File metadata:</strong> name, size, hash, timestamps
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">•</span>
                <span>
                  <strong>Audit logs:</strong> who accessed what, when — no file content
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">•</span>
                <span>
                  <strong>Billing and account information</strong>
                </span>
              </li>
            </ul>
          </section>

          {/* Audit Logging */}
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Audit Logging
            </h2>
            <p className="text-gray-700 mb-4">
              Every file operation is logged for security and compliance:
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              {['Upload', 'Download', 'Delete', 'Share', 'Login', 'Lock', 'Unlock', 'Rename'].map(action => (
                <div key={action} className="bg-gray-100 rounded py-2 px-3 text-sm font-medium text-gray-700">
                  {action}
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-4">
              Logs include user ID, action, IP address, timestamp, and metadata — but never file content.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
