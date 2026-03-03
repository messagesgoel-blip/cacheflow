/**
 * 2FA Challenge Page
 * 
 * Prompts user for TOTP code or backup code during login.
 * 
 * Gate: 2FA-1
 * Task: 2.14@2FA-1
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TOTPInput } from '../../components/auth/TOTPInput';
import { useToast } from '../../lib/hooks/useToast';

export default function TwoFactorChallengePage() {
  const router = useRouter();
  const toast = useToast();
  
  const [mode, setMode] = useState<'totp' | 'backup'>('totp');
  const [code, setCode] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const verifyCode = mode === 'totp' ? code : backupCode;
      
      const response = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: mode === 'totp' ? code : undefined,
          backupCode: mode === 'backup' ? backupCode : undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Authentication successful', '2FA Verified');
        // Store session token and redirect
        if (result.sessionToken) {
          // In production, exchange for full session
          document.cookie = `sessionToken=${result.sessionToken}; path=/; max-age=${7 * 24 * 60 * 60}`;
        }
        router.push('/files');
      } else {
        setError(result.error || 'Verification failed');
        toast.error(result.error || 'Invalid code', '2FA Failed');
        
        if (result.requiresBackup) {
          setError(prev => prev + ' You can also use a backup code.');
        }
      }
    } catch (err) {
      setError('Network error. Please try again.');
      toast.error('Network error. Please try again.', '2FA Failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Two-Factor Authentication
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your authentication code to continue
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {/* Mode Toggle */}
          <div className="flex justify-center gap-4">
            <button
              type="button"
              onClick={() => setMode('totp')}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                mode === 'totp'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Authentication Code
            </button>
            <button
              type="button"
              onClick={() => setMode('backup')}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                mode === 'backup'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Backup Code
            </button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}

          {/* TOTP Input */}
          {mode === 'totp' && (
            <div>
              <label htmlFor="totp-code" className="sr-only">
                Authentication Code
              </label>
              <TOTPInput
                value={code}
                onChange={setCode}
                disabled={isLoading}
                onComplete={(value) => setCode(value)}
              />
              <p className="mt-2 text-xs text-gray-500 text-center">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>
          )}

          {/* Backup Code Input */}
          {mode === 'backup' && (
            <div>
              <label htmlFor="backup-code" className="block text-sm font-medium text-gray-700">
                Backup Code
              </label>
              <input
                id="backup-code"
                type="text"
                required
                value={backupCode}
                onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX"
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-gray-900 focus:border-gray-900 sm:text-sm uppercase"
              />
              <p className="mt-2 text-xs text-gray-500">
                Enter one of your 8-digit backup codes
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || (mode === 'totp' ? code.length !== 6 : backupCode.length === 0)}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Verifying...' : 'Verify'}
          </button>
        </form>

        {/* Help Text */}
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Lost access?{' '}
            <button
              type="button"
              onClick={() => setMode('backup')}
              className="font-medium text-gray-900 hover:text-gray-700"
            >
              Use a backup code
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
