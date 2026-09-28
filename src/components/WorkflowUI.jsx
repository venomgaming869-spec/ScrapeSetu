import { useEffect, useState } from 'react'
import { CircleCheck, CircleDashed, LoaderCircle } from 'lucide-react'

export function useLoad(loader, dependencies = []) {
  const [state, setState] = useState({ data: null, loading: true, error: '' })
  useEffect(() => {
    let active = true
    setState((current) => ({ ...current, loading: true, error: '' }))
    loader().then((data) => {
      if (active) setState({ data, loading: false, error: '' })
    }).catch((error) => {
      console.error('[ScrapSetu] Page data load failed', {
        error,
        message: error.message,
        details: error.details || error.cause?.details,
        hint: error.hint || error.cause?.hint,
        code: error.code || error.cause?.code,
      })
      if (active) setState({ data: null, loading: false, error: error.message || 'Unable to load data.' })
    })
    return () => { active = false }
  // The caller controls when the query should be refreshed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)
  return { ...state, setData: (data) => setState({ data, loading: false, error: '' }) }
}

export function LoadingState() {
  return <div className="load-state"><LoaderCircle className="spin" size={20} /> Loading…</div>
}

export function ErrorState({ message, retry }) {
  return <div className="message-state message-error"><span>{message}</span>{retry && <button className="button button-quiet" type="button" onClick={retry}>Try again</button>}</div>
}

export function EmptyState({ title, children }) {
  return <div className="message-state"><CircleDashed size={25} /><strong>{title}</strong>{children && <span>{children}</span>}</div>
}

export function StatusBadge({ status }) {
  const normalized = String(status || 'pending').toLowerCase().replaceAll('_', ' ')
  const positive = ['paid', 'completed', 'verified', 'accepted', 'confirmed', 'available'].includes(normalized)
  const warning = ['pending', 'pending sync', 'offer accepted', 'handover pending'].includes(normalized)
  return <span className={`badge ${positive ? 'badge-green' : warning ? 'badge-amber' : 'badge-neutral'}`}>{normalized}</span>
}

export function Panel({ children, className = '' }) {
  return <section className={`panel ${className}`}>{children}</section>
}

export function PageHeading({ title, description, action }) {
  return <div className="section-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>
}

export function TraceTimeline({ events }) {
  const labels = {
    LOT_CREATED: 'Lot created',
    BENCHMARK_GENERATED: 'Indicative value generated',
    RECYCLER_MATCHED: 'Verified recyclers matched',
    OFFER_SUBMITTED: 'Offer submitted',
    OFFER_ACCEPTED: 'Offer accepted',
    HANDOVER_CONFIRMED: 'Handover confirmed',
    PAYMENT_RECORDED: 'Payment status recorded',
  }
  if (!events?.length) return <EmptyState title="No traceability events yet" />
  return <ol className="timeline">{events.map((event) => <li key={event.id}>
    <span className="timeline-mark"><CircleCheck size={17} /></span>
    <div className="timeline-copy"><strong>{labels[event.event_type] || event.event_type}</strong>
      {event.event_type === 'PAYMENT_RECORDED' && event.metadata?.status && <span>Payment {event.metadata.status}</span>}
      {event.event_type === 'OFFER_SUBMITTED' && event.metadata?.offer_value && <span>₹{Number(event.metadata.offer_value).toLocaleString('en-IN')}</span>}
      <time>{new Date(event.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</time>
    </div>
  </li>)}</ol>
}

export function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}