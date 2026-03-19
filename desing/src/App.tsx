import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { hasRole } from '@/lib/auth'
import { Toaster } from '@/components/ui/sonner'

// Pages
import { LoginPage } from '@/pages/LoginPage'
import { HomePage } from '@/pages/HomePage'
import { DiscountsPage } from '@/pages/DiscountsPage'
import { TokenPage } from '@/pages/TokenPage'
import { ManagePage } from '@/pages/ManagePage'
import { StatsPage } from '@/pages/StatsPage'
import { ValidatePage } from '@/pages/ValidatePage'
import { SavingsPassportPage } from '@/pages/SavingsPassportPage'

// -----------------------------------------------------------------------------
// HOW ROUTING WORKS
//
// React Router matches the current browser URL to a <Route path="..."> and
// renders the matching component. Think of it like a switch/case for URLs.
//
// Route structure:
//   /login          → Login page (public)
//   /               → Home (private — redirects to /login if not authed)
//   /discounts      → Browse discounts (private — member+)
//   /token/:id      → Show QR code for a generated token (private — member+)
//   /manage         → Add/edit discounts (private — manager+ only)
//   /stats          → Usage statistics (private — manager+ only)
//   /v/:tokenHash   → PUBLIC validation page — no login needed
// -----------------------------------------------------------------------------

// ProtectedRoute: shows the page only if logged in, otherwise redirects to /login
// Uses hasRole() for clean hierarchy checks: member < manager < board < technician
function ProtectedRoute({ children, requiredRole }: {
  children: React.ReactNode
  requiredRole?: 'manager' | 'board' | 'technician'
}) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f5f5f5' }}>
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: '#1d4f7d' }} />
          <p style={{ color: '#666666' }}>Načítání...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  // Role hierarchy: member(1) < manager(2) < board(3) < technician(4)
  // hasRole checks if user's level >= required level
  if (requiredRole && !hasRole(user.role, requiredRole)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

export default function App() {
  const { user } = useAuth()

  return (
    <>
      <Routes>
        {/* Public routes — accessible without login */}
        <Route
          path="/login"
          // If already logged in, redirect away from login
          element={user ? <Navigate to="/" replace /> : <LoginPage />}
        />
        <Route path="/v/:tokenHash" element={<ValidatePage />} />

        {/* Private routes — require login */}
        <Route path="/" element={
          <ProtectedRoute><HomePage /></ProtectedRoute>
        } />
        <Route path="/discounts" element={
          <ProtectedRoute><DiscountsPage /></ProtectedRoute>
        } />
        <Route path="/token/:id" element={
          <ProtectedRoute><TokenPage /></ProtectedRoute>
        } />
        <Route path="/passport" element={
          <ProtectedRoute><SavingsPassportPage /></ProtectedRoute>
        } />

        {/* Manager+ routes */}
        <Route path="/manage" element={
          <ProtectedRoute requiredRole="manager"><ManagePage /></ProtectedRoute>
        } />
        <Route path="/stats" element={
          <ProtectedRoute requiredRole="manager"><StatsPage /></ProtectedRoute>
        } />

        {/* Catch-all: unknown URLs go to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Toaster renders toast notifications (success/error popups) globally */}
      <Toaster position="top-center" />
    </>
  )
}
