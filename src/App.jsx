import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import PortalLayout from './components/PortalLayout.jsx'
import AuthPage from './pages/AuthPage.jsx'

const CollectorDashboard = lazy(() => import('./pages/collector/CollectorPages.jsx').then((module) => ({ default: module.CollectorDashboard })))
const CollectorLotDetailsPage = lazy(() => import('./pages/collector/CollectorPages.jsx').then((module) => ({ default: module.CollectorLotDetailsPage })))
const CollectorLotsPage = lazy(() => import('./pages/collector/CollectorPages.jsx').then((module) => ({ default: module.CollectorLotsPage })))
const CollectorOffersPage = lazy(() => import('./pages/collector/CollectorPages.jsx').then((module) => ({ default: module.CollectorOffersPage })))
const CollectorRecyclerListPage = lazy(() => import('./pages/collector/CollectorPages.jsx').then((module) => ({ default: module.CollectorRecyclerListPage })))
const CollectorTransactionDetailPage = lazy(() => import('./pages/collector/CollectorPages.jsx').then((module) => ({ default: module.CollectorTransactionDetailPage })))
const CollectorTransactionsPage = lazy(() => import('./pages/collector/CollectorPages.jsx').then((module) => ({ default: module.CollectorTransactionsPage })))
const CreateLotPage = lazy(() => import('./pages/collector/CollectorPages.jsx').then((module) => ({ default: module.CreateLotPage })))
const RecyclerAcceptedPage = lazy(() => import('./pages/recycler/RecyclerPages.jsx').then((module) => ({ default: module.RecyclerAcceptedPage })))
const RecyclerDashboard = lazy(() => import('./pages/recycler/RecyclerPages.jsx').then((module) => ({ default: module.RecyclerDashboard })))
const RecyclerHandoverPage = lazy(() => import('./pages/recycler/RecyclerPages.jsx').then((module) => ({ default: module.RecyclerHandoverPage })))
const RecyclerLotDetailPage = lazy(() => import('./pages/recycler/RecyclerPages.jsx').then((module) => ({ default: module.RecyclerLotDetailPage })))
const RecyclerLotsPage = lazy(() => import('./pages/recycler/RecyclerPages.jsx').then((module) => ({ default: module.RecyclerLotsPage })))
const RecyclerOffersPage = lazy(() => import('./pages/recycler/RecyclerPages.jsx').then((module) => ({ default: module.RecyclerOffersPage })))
const AdminDashboard = lazy(() => import('./pages/admin/AdminPages.jsx').then((module) => ({ default: module.AdminDashboard })))
const AdminLotsPage = lazy(() => import('./pages/admin/AdminPages.jsx').then((module) => ({ default: module.AdminLotsPage })))
const AdminMaterialsPage = lazy(() => import('./pages/admin/AdminPages.jsx').then((module) => ({ default: module.AdminMaterialsPage })))
const AdminOffersPage = lazy(() => import('./pages/admin/AdminPages.jsx').then((module) => ({ default: module.AdminOffersPage })))
const AdminPricesPage = lazy(() => import('./pages/admin/AdminPages.jsx').then((module) => ({ default: module.AdminPricesPage })))
const AdminRecyclersPage = lazy(() => import('./pages/admin/AdminPages.jsx').then((module) => ({ default: module.AdminRecyclersPage })))
const AdminTraceabilityPage = lazy(() => import('./pages/admin/AdminPages.jsx').then((module) => ({ default: module.AdminTraceabilityPage })))
const AdminTransactionsPage = lazy(() => import('./pages/admin/AdminPages.jsx').then((module) => ({ default: module.AdminTransactionsPage })))

function ProtectedRoute({ role }) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="app-loading" role="status">Loading ScrapSetu…</div>
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!profile) return <div className="app-loading">Your account profile is unavailable. Contact support.</div>
  if (profile.role !== role) return <Navigate to={`/${profile.role}`} replace />
  return <Outlet />
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<AuthPage landing />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/register" element={<AuthPage register />} />
        {['collector', 'recycler', 'admin'].map((role) => (
          <Route key={role} element={<ProtectedRoute role={role} />}>
            <Route path={`/${role}`} element={<PortalLayout />}>
              {role === 'collector' ? <>
                <Route index element={<Suspense fallback={<div className="load-state">Loading…</div>}><CollectorDashboard /></Suspense>} />
                <Route path="create-lot" element={<Suspense fallback={<div className="load-state">Loading…</div>}><CreateLotPage /></Suspense>} />
                <Route path="lots" element={<Suspense fallback={<div className="load-state">Loading…</div>}><CollectorLotsPage /></Suspense>} />
                <Route path="lots/:id" element={<Suspense fallback={<div className="load-state">Loading…</div>}><CollectorLotDetailsPage /></Suspense>} />
                <Route path="offers" element={<Suspense fallback={<div className="load-state">Loading…</div>}><CollectorOffersPage /></Suspense>} />
                <Route path="recyclers" element={<Suspense fallback={<div className="load-state">Loading…</div>}><CollectorRecyclerListPage /></Suspense>} />
                <Route path="transactions" element={<Suspense fallback={<div className="load-state">Loading…</div>}><CollectorTransactionsPage /></Suspense>} />
                <Route path="transactions/:id" element={<Suspense fallback={<div className="load-state">Loading…</div>}><CollectorTransactionDetailPage /></Suspense>} />
              </> : role === 'recycler' ? <>
                <Route index element={<Suspense fallback={<div className="load-state">Loading…</div>}><RecyclerDashboard /></Suspense>} />
                <Route path="lots" element={<Suspense fallback={<div className="load-state">Loading…</div>}><RecyclerLotsPage /></Suspense>} />
                <Route path="lots/:id" element={<Suspense fallback={<div className="load-state">Loading…</div>}><RecyclerLotDetailPage /></Suspense>} />
                <Route path="offers" element={<Suspense fallback={<div className="load-state">Loading…</div>}><RecyclerOffersPage /></Suspense>} />
                <Route path="accepted" element={<Suspense fallback={<div className="load-state">Loading…</div>}><RecyclerAcceptedPage /></Suspense>} />
                <Route path="handover/:id" element={<Suspense fallback={<div className="load-state">Loading…</div>}><RecyclerHandoverPage /></Suspense>} />
                <Route path="history" element={<Suspense fallback={<div className="load-state">Loading…</div>}><RecyclerOffersPage /></Suspense>} />
              </> : <>
                <Route index element={<Suspense fallback={<div className="load-state">Loading…</div>}><AdminDashboard /></Suspense>} />
                <Route path="recyclers" element={<Suspense fallback={<div className="load-state">Loading…</div>}><AdminRecyclersPage /></Suspense>} />
                <Route path="materials" element={<Suspense fallback={<div className="load-state">Loading…</div>}><AdminMaterialsPage /></Suspense>} />
                <Route path="prices" element={<Suspense fallback={<div className="load-state">Loading…</div>}><AdminPricesPage /></Suspense>} />
                <Route path="lots" element={<Suspense fallback={<div className="load-state">Loading…</div>}><AdminLotsPage /></Suspense>} />
                <Route path="offers" element={<Suspense fallback={<div className="load-state">Loading…</div>}><AdminOffersPage /></Suspense>} />
                <Route path="transactions" element={<Suspense fallback={<div className="load-state">Loading…</div>}><AdminTransactionsPage /></Suspense>} />
                <Route path="traceability" element={<Suspense fallback={<div className="load-state">Loading…</div>}><AdminTraceabilityPage /></Suspense>} />
              </>}
              <Route path="*" element={<div className="empty-state"><h2>Getting your workspace ready</h2><p>Connect and manage your lots, offers, and transactions here.</p></div>} />
            </Route>
          </Route>
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}