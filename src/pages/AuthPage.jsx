import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Recycle, UserRound } from 'lucide-react'
import landingBackdrop from '../../figmaUI/banner.png'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function AuthPage({ register = false, landing = false }) {
  const { signIn, signUp, configured } = useAuth()
  const navigate = useNavigate()
  const isRegister = register
  const [role, setRole] = useState('collector')
  const [loginPortal, setLoginPortal] = useState('collector')
  const [form, setForm] = useState({ name: '', identifier: '', password: '', phone: '', serviceLocation: '', businessName: '', location: '', serviceArea: '' })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    try {
      if (isRegister) {
        const data = await signUp({ ...form, role })
        if (data.session) navigate(`/${role}`, { replace: true })
        else setNotice('Check your phone or email to confirm your account, then sign in.')
      } else {
        const userId = await signIn(form.identifier, form.password)
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
        navigate(`/${profile.role}`, { replace: true })
      }
    } catch (submitError) {
      setError(submitError.message || 'We could not complete that request. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (landing && !isRegister) return <main className="landing-page">
    <header className="landing-header">
      <Link to="/" className="landing-brand" aria-label="ScrapSetu home">
        <span className="landing-brand-mark"><Recycle size={25} strokeWidth={2.4} /></span>
        <span className="landing-brand-copy"><strong>SCRAP<br />SETU</strong><small>E-WASTE NETWORK</small></span>
      </Link>
      <nav className="landing-nav" aria-label="Main navigation">
        <a href="#home">Home</a><a href="#how-it-works">How it works</a><a href="#network">The network</a><a href="#impact">Impact</a>
      </nav>
      <div className="landing-header-actions">
        <span className="landing-network-status"><i />Collector + recycler network</span>
        <Link className="landing-signin" to="/login">Sign in <ArrowUpRight size={15} /></Link>
      </div>
    </header>
    <section className="landing-hero" id="home">
      <img className="landing-backdrop" src={landingBackdrop} alt="" />
      <div className="landing-hero-copy">
        <span className="landing-kicker"><i /> SMART E-WASTE CONNECTOR</span>
        <h1><span>SCRAP</span><span>SETU</span></h1>
        <p>Connecting collectors with responsible recyclers.</p>
        <div className="landing-actions">
          <Link className="landing-primary" to="/register">Enter ScrapSetu <ArrowRight size={17} /></Link>
          <Link className="landing-secondary" to="/login">Recycler login <ArrowUpRight size={15} /></Link>
        </div>
        <div className="landing-flow" id="how-it-works"><span>Collect</span><i /><span>Value</span><i /><span>Match</span><i /><span>Sell</span><i /><span>Trace</span><i /><span>Recycle</span></div>
      </div>
      <div className="landing-role-picker" id="network">
        <span className="landing-choose">CHOOSE YOUR SIDE</span>
        <Link to="/register" className="landing-role-card landing-role-collector">
          <span className="landing-role-icon"><UserRound size={20} /></span>
          <span className="landing-role-copy"><small>FOR COLLECTORS</small><strong>Collector</strong><span>Collect and connect e-waste.</span></span>
          <span className="landing-role-arrow"><ArrowUpRight size={17} /></span>
        </Link>
        <Link to="/login" className="landing-role-card landing-role-recycler">
          <span className="landing-role-icon"><Recycle size={20} /></span>
          <span className="landing-role-copy"><small>FOR RECYCLERS</small><strong>Recycler</strong><span>Receive and recycle responsibly.</span></span>
          <span className="landing-role-arrow"><ArrowUpRight size={17} /></span>
        </Link>
      </div>
    </section>
    <section className="landing-note" id="impact"><div className="landing-note-inner"><div><span className="eyebrow">A FORMAL RECYCLING PATHWAY</span><h2>From local collection to authorized recycling.</h2></div><p>ScrapSetu gives collectors indicative price visibility, connects each lot to compatible verified recyclers, and records offers, handover, payment, and traceability in one place.</p></div></section>
  </main>

  return (
    <div className="auth-page">
      <section className="auth-story">
        <Link to="/" className="auth-brand"><strong>SCRAPSETU</strong><span>KABADIWALA CONNECT</span></Link>
        <div className="auth-copy">
          <span className="portal-label">{isRegister ? 'JOIN THE RECYCLING CHAIN' : 'KABADIWALA CONNECT'}</span>
          <h1>{isRegister ? 'Turn scrap into value.' : 'Turn scrap into value.'}</h1>
          <p>Sell recyclable e-waste to verified recyclers, find a fair benchmark, and keep every handover traceable.</p>
          <div className="journey-line"><span>Collect</span><i /><span>Value</span><i /><span>Match</span><i /><span>Recycle</span></div>
        </div>
        <span className="story-foot">Collector portal · Recycler portal · Traceable transactions</span>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <header className="auth-card-header">
            <h2>{isRegister ? 'Create your account' : `${loginPortal[0].toUpperCase()}${loginPortal.slice(1)} sign in`}</h2>
            <p>{isRegister ? 'Join ScrapSetu to connect with authorized recycling.' : `Secure access to your ${loginPortal} portal`}</p>
          </header>
          {!configured && <div className="alert alert-error">Supabase is not configured. Set the VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY values in `.env.local`.</div>}
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          {notice && <div className="alert alert-success" role="status">{notice}</div>}
          <form className="auth-form" onSubmit={submit}>
            {isRegister && <label className="field"><span>Your name</span><input name="name" value={form.name} onChange={update} required autoComplete="name" /></label>}
            <label className="field"><span>{isRegister ? 'Email address or mobile number' : 'Email address or mobile number'}</span><input name="identifier" value={form.identifier} onChange={update} required autoComplete="username" placeholder={isRegister ? 'you@example.com' : '+91 98765 43210'} /></label>
            {isRegister && <label className="field"><span>Mobile number <small>Optional</small></span><input name="phone" value={form.phone} onChange={update} autoComplete="tel" placeholder="+91 98765 43210" /></label>}
            <label className="field"><span>Password</span><input name="password" value={form.password} onChange={update} required type="password" minLength={6} autoComplete={isRegister ? 'new-password' : 'current-password'} placeholder="••••••••" /></label>
            {isRegister && <>
              <fieldset className="role-select"><legend>Choose your portal</legend>
                {['collector', 'recycler'].map((item) => <button type="button" key={item} className={role === item ? 'selected' : ''} onClick={() => setRole(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}
              </fieldset>
              {role === 'recycler' && <div className="field-grid">
                <label className="field"><span>Business name</span><input name="businessName" value={form.businessName} onChange={update} required /></label>
                <label className="field"><span>Location</span><input name="location" value={form.location} onChange={update} required /></label>
                <label className="field field-wide"><span>Service area</span><input name="serviceArea" value={form.serviceArea} onChange={update} required /></label>
              </div>}
              {role === 'collector' && <label className="field"><span>City or area <small>Optional, helps find suitable recyclers</small></span><input name="serviceLocation" value={form.serviceLocation} onChange={update} autoComplete="address-level2" placeholder="For example, Delhi NCR" /></label>}
            </>}
            <button className="button button-primary auth-submit" type="submit" disabled={!configured || busy}>
              {busy ? 'Please wait…' : isRegister ? 'Create account' : 'Continue'}
            </button>
          </form>
          <div className="auth-switch">
            {isRegister ? <><span>Already registered?</span><Link to="/login">Sign in <ArrowRight size={15} /></Link></> : <><span>Use another portal?</span><button type="button" onClick={() => setLoginPortal((current) => current === 'collector' ? 'recycler' : 'collector')}>Switch portal <ArrowRight size={15} /></button></>}
          </div>
          {!isRegister && <div className="auth-signup-cta"><span>New to ScrapSetu?</span><Link className="button button-soft" to="/register">Create an account <ArrowRight size={15} /></Link></div>}
        </div>
      </section>
    </div>
  )
}