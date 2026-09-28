import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { syncPendingLots } from '../services/scrapsetu'
import {
  CircleHelp, ClipboardList, Coins, FileClock, LayoutDashboard, LogOut, PackagePlus,
  Recycle, ShieldCheck, Tags, Truck, Wallet, BadgeDollarSign, CircleCheck,
} from 'lucide-react'

const navigation = {
  collector: [
    { label: 'Dashboard', to: '/collector', icon: LayoutDashboard, end: true },
    { label: 'Sell Scrap', to: '/collector/create-lot', icon: PackagePlus },
    { label: 'My Lots', to: '/collector/lots', icon: ClipboardList },
    { label: 'Find Recycler', to: '/collector/recyclers', icon: Recycle },
    { label: 'Offers', to: '/collector/offers', icon: Coins },
    { label: 'Earnings', to: '/collector/transactions', icon: Wallet },
  ],
  recycler: [
    { label: 'Dashboard', to: '/recycler', icon: LayoutDashboard, end: true },
    { label: 'New Lots', to: '/recycler/lots', icon: ClipboardList },
    { label: 'My Pickups', to: '/recycler/accepted', icon: Truck },
    { label: 'Payments', to: '/recycler/offers', icon: Wallet },
    { label: 'History', to: '/recycler/history', icon: FileClock },
  ],
  admin: [
    { label: 'Overview', to: '/admin', icon: LayoutDashboard, end: true },
    { label: 'Recycler Verification', to: '/admin/recyclers', icon: ShieldCheck },
    { label: 'Price Management', to: '/admin/prices', icon: Coins },
    { label: 'Material Data', to: '/admin/materials', icon: Tags },
    { label: 'Lots', to: '/admin/lots', icon: ClipboardList },
    { label: 'Offers', to: '/admin/offers', icon: BadgeDollarSign },
    { label: 'Transactions', to: '/admin/transactions', icon: Wallet },
    { label: 'Traceability', to: '/admin/traceability', icon: FileClock },
  ],
}

const titles = {
  '/collector': ['Collector Dashboard', 'Good afternoon. Here is your recycling activity.'],
  '/collector/create-lot': ['Sell scrap', 'Select or correct the material category.'],
  '/collector/lots': ['My lots', 'Track the progress of your e-waste.'],
  '/collector/recyclers': ['Find a recycler', 'Verified recyclers that accept your material.'],
  '/collector/offers': ['Offers', 'Compare offers from verified recyclers.'],
  '/collector/transactions': ['Earnings', 'Track completed sales and payments.'],
  '/recycler': ['Recycler Dashboard', 'Pickup queue, accepted lots and payment status.'],
  '/recycler/lots': ['New lots', 'Material requests matched to your accepted categories.'],
  '/recycler/offers': ['Offers and payments', 'Your submitted offers and payment records.'],
  '/recycler/accepted': ['My pickups', 'Lots assigned to your recycler account.'],
  '/recycler/history': ['History', 'Your recorded offers and transactions.'],
  '/admin': ['Admin overview', 'Verification, pricing and traceability controls.'],
  '/admin/recyclers': ['Recycler verification', 'Review authorization, service area and documents.'],
  '/admin/prices': ['Price management', 'Maintain indicative rates used by the estimate flow.'],
  '/admin/materials': ['Material data', 'Manage the materials available in ScrapSetu.'],
  '/admin/lots': ['Lots', 'Platform lot records and current status.'],
  '/admin/offers': ['Offers', 'Review submitted recycler offers.'],
  '/admin/transactions': ['Transactions', 'Review completed handovers and payment status.'],
  '/admin/traceability': ['Lot traceability', 'Audit lot events from creation through payment.'],
}

export default function PortalLayout() {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const online = useOnlineStatus()
  const role = profile?.role || location.pathname.split('/')[1] || 'collector'
  const navItems = navigation[role] || navigation.collector
  const mobileItems = role === 'collector'
    ? navItems.filter((item) => ['/collector', '/collector/lots', '/collector/offers', '/collector/transactions'].includes(item.to))
    : navItems.slice(0, 4)
  const [title, subtitle] = titles[location.pathname] || [role === 'admin' ? 'Admin overview' : 'Lot details', 'ScrapSetu transaction workspace.']

  useEffect(() => {
    if (role !== 'collector' || !online || !profile?.id) return undefined
    const sync = () => syncPendingLots(profile.id).then((results) => {
      if (results.some((result) => result.success)) window.dispatchEvent(new Event('scrapsetu:queue-change'))
    }).catch(() => {})
    sync()
    window.addEventListener('online', sync)
    return () => window.removeEventListener('online', sync)
  }, [online, profile?.id, role])

  return (
    <div className="portal">
      <aside className="sidebar">
        <NavLink className="brand-lockup" to={`/${role}`}>
          <strong>SCRAPSETU</strong>
          <span>KABADIWALA CONNECT</span>
        </NavLink>
        <nav className="side-nav" aria-label={`${role} navigation`}>
          {navItems.map(({ label, to, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className={`status-pill ${online ? 'status-online' : 'status-offline'}`}>
            <i />{online ? 'Online' : 'Offline'}
          </span>
          <button className="quiet-link logout" onClick={signOut} type="button" aria-label="Sign out">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>
      <div className="portal-main">
        <header className="portal-header">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <span className="role-chip">{role[0].toUpperCase() + role.slice(1)}</span>
        </header>
        <main className="portal-content"><Outlet /></main>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {mobileItems.map(({ label, to, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `mobile-nav-link${isActive ? ' active' : ''}`}>
            <Icon size={19} /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
      {!online && <div className="offline-banner"><CircleHelp size={16} /> Offline. New lots stay on this device and sync when you reconnect.</div>}
    </div>
  )
}