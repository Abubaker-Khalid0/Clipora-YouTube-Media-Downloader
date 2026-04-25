'use client'

import React from 'react'

interface Props {
  children: React.ReactNode
  /** Optional custom fallback rendered instead of the default one */
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  componentStack: string | null
  /** Name of the component that actually crashed (parsed from componentStack). */
  crashedComponent: string | null
}

/**
 * Global React Error Boundary.
 * Catches all unhandled rendering errors beneath it in the tree.
 * - Development: renders full error details on screen for fast debugging.
 * - Production:  renders a generic "Something went wrong" card.
 *
 * Console output format:
 *   [ErrorBoundary] Component: <name>
 *   [ErrorBoundary] Error:     <message>
 *   [ErrorBoundary] Stack:     <stack>
 *   [ErrorBoundary] Component Stack: <componentStack>
 *   [ErrorBoundary] Time:      <ISO>
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, componentStack: null, crashedComponent: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    const componentStack = info.componentStack ?? ''

    // Extract the first component name from the stack.
    // componentStack format: "\n    at DashboardClient (DashboardClient.tsx:45)\n    at Suspense\n..."
    // We want the FIRST "at <Name>" entry — that is the component that threw.
    const firstLine = componentStack.trim().split('\n')[0] ?? ''
    const componentMatch = firstLine.match(/at (\w+)/)
    const crashedComponent = componentMatch?.[1] ?? 'Unknown'

    this.setState({ componentStack, crashedComponent })

    // Single structured log — all fields in one object for easy filtering/grep.
    console.error('[ErrorBoundary]', {
      component:      crashedComponent,       // the ACTUAL crashed component, not "ErrorBoundary"
      errorMessage:   error.message,
      errorStack:     error.stack ?? '(no stack)',
      componentStack,
      time:           new Date().toISOString(),
    })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, componentStack: null, crashedComponent: null })
    window.location.reload()
  }

  override render() {
    if (!this.state.hasError) return this.props.children
    if (this.props.fallback) return this.props.fallback

    const isDev = process.env.NODE_ENV === 'development'

    if (isDev) {
      return (
        <div className="min-h-screen bg-red-50 p-8 font-mono text-sm">
          <div className="mx-auto max-w-3xl rounded-2xl bg-white shadow-lg border border-red-200 overflow-hidden">
            <div className="bg-red-600 px-6 py-4 text-white">
              <h1 className="text-lg font-bold">⚠ React Error Boundary — Development Mode</h1>
              <p className="text-red-200 text-xs mt-1">This panel is hidden in production</p>
            </div>
            <div className="p-6 space-y-4">
              {/* Crashed component — shown first so it's the first thing you see */}
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-1">Crashed Component</p>
                <p className="text-slate-900 font-bold text-base">
                  {this.state.crashedComponent ?? 'Unknown'}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-1">Error</p>
                <p className="text-slate-800 font-semibold">{this.state.error?.message}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-1">Stack Trace</p>
                <pre className="text-xs text-slate-600 bg-slate-50 rounded-lg p-4 overflow-auto max-h-64 whitespace-pre-wrap">
                  {this.state.error?.stack}
                </pre>
              </div>
              <div>
                <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-1">Component Stack</p>
                <pre className="text-xs text-slate-600 bg-slate-50 rounded-lg p-4 overflow-auto max-h-48 whitespace-pre-wrap">
                  {this.state.componentStack}
                </pre>
              </div>
              <button
                onClick={this.handleReset}
                className="mt-4 rounded-full bg-red-600 px-6 py-2 text-sm font-bold text-white hover:bg-red-700 transition-colors"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      )
    }

    // Production: generic safe fallback
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          <span className="text-3xl">⚠</span>
        </div>
        <h1 className="text-xl font-bold text-slate-900">Something went wrong</h1>
        <p className="text-sm text-slate-500 max-w-sm">
          An unexpected error occurred. Please reload the page and try again.
        </p>
        <button
          onClick={this.handleReset}
          className="rounded-full bg-primary px-6 py-2 text-sm font-bold text-white hover:bg-red-600 transition-colors"
        >
          Reload Page
        </button>
      </div>
    )
  }
}
