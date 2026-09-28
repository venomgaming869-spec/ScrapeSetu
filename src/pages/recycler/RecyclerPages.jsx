import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, ChevronRight, MapPin, PackageCheck, RefreshCw, ShieldCheck, Truck, Wallet } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { getClient, getIncomingLots, getRecyclerOffers, getSignedPhoto, getTransactionRows } from '../../services/scrapsetu'
import { EmptyState, ErrorState, LoadingState, PageHeading, Panel, StatusBadge, formatCurrency, useLoad } from '../../components/WorkflowUI'

function Metric({ label, value, note }) {
  return <Panel className="metric-panel"><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong><span className="metric-note">{note}</span></Panel>
}

export function RecyclerDashboard() {
  const { data: lots, loading: loadingLots, error: lotError } = useLoad(getIncomingLots)
  const { data: offers, loading: loadingOffers } = useLoad(getRecyclerOffers)
  const { data: payments } = useLoad(getTransactionRows)
  if (loadingLots || loadingOffers) return <LoadingState />
  if (lotError) return <ErrorState message="Incoming lots couldn't be loaded." />
  const offerRows = offers || []
  const accepted = offerRows.filter((offer) => offer.status === 'accepted')
  const pendingPayments = (payments || []).filter((payment) => payment.status === 'pending')
  const incoming = lots || []
  return <div className="page-stack">
    <div className="metric-grid metric-grid-three">
      <Metric label="Incoming lots" value={incoming.length} note="Matching your materials" />
      <Metric label="My offers" value={offerRows.length} note={`${offerRows.filter((offer) => offer.status === 'pending').length} awaiting a response`} />
      <Metric label="Pending payments" value={formatCurrency(pendingPayments.reduce((sum, item) => sum + Number(item.amount), 0))} note={`${pendingPayments.length} transactions`} />
    </div>
    <div className="dashboard-grid">
      <Panel><PageHeading title="Incoming lots" action={<Link className="text-link" to="/recycler/lots">View all</Link>} />
        {incoming.length ? <div className="compact-list">{incoming.slice(0, 4).map((lot) => <Link className="compact-row" to={`/recycler/lots/${lot.id}`} key={lot.id}><span className="lot-mark">{lot.materials?.name?.slice(0, 2) || 'EW'}</span><span className="compact-main"><strong>{lot.reference_id}</strong><small>{lot.materials?.name} · Approx. {lot.approximate_weight} kg</small></span><ChevronRight size={16} /></Link>)}</div> : <EmptyState title="No incoming lots">New compatible lots appear here after collectors save them.</EmptyState>}
      </Panel>
      <Panel><PageHeading title="Accepted lots" /><div className="compact-list">{accepted.slice(0, 3).map((offer) => <Link className="compact-row" to={`/recycler/handover/${offer.lot_id}`} key={offer.id}><PackageCheck size={17} color="#176d49" /><span className="compact-main"><strong>{offer.lots?.reference_id}</strong><small>{offer.lots?.materials?.name} · Handover pending</small></span><ChevronRight size={16} /></Link>)}</div>{!accepted.length && <EmptyState title="Nothing to hand over yet">Accepted offers will appear here.</EmptyState>}</Panel>
    </div>
    <Panel><PageHeading title="Recent offers" action={<Link className="text-link" to="/recycler/offers">View all</Link>} />{offerRows.length ? <div className="data-table-wrap"><table><thead><tr><th>Lot</th><th>Material</th><th>Offer</th><th>Status</th></tr></thead><tbody>{offerRows.slice(0, 5).map((offer) => <tr key={offer.id}><td>{offer.lots?.reference_id}</td><td>{offer.lots?.materials?.name}</td><td>{formatCurrency(offer.offer_value)}</td><td><StatusBadge status={offer.status} /></td></tr>)}</tbody></table></div> : <EmptyState title="No offers submitted yet">Review an incoming lot to send your first offer.</EmptyState>}</Panel>
  </div>
}

export function RecyclerLotsPage() {
  const { data: lots, loading, error } = useLoad(getIncomingLots)
  const [selected, setSelected] = useState('')
  if (loading) return <LoadingState />
  if (error) return <ErrorState message="Incoming lots couldn't be loaded." />
  const chosen = lots?.find((lot) => lot.id === selected) || lots?.[0]
  return <div className="page-stack">
    {lots?.length ? <>
      <Panel className="table-panel"><div className="data-table-wrap"><table><thead><tr><th>Lot</th><th>Material</th><th>Weight</th><th>Created</th><th>Status</th></tr></thead><tbody>{lots.map((lot) => <tr key={lot.id} className={chosen?.id === lot.id ? 'selected-row' : ''} onClick={() => setSelected(lot.id)}><td><button className="table-link table-button" type="button">{lot.reference_id}</button></td><td>{lot.materials?.name}</td><td>{lot.approximate_weight} kg</td><td>{new Date(lot.created_at).toLocaleDateString('en-IN')}</td><td><StatusBadge status={lot.status} /></td></tr>)}</tbody></table></div></Panel>
      {chosen && <><PageHeading title="Selected lot" /><Panel className="selected-lot-panel"><div><span className="eyebrow">{chosen.reference_id}</span><h2>{chosen.materials?.name} · {chosen.approximate_weight} kg</h2><p>Collector location: {chosen.latitude && chosen.longitude ? 'Location captured' : 'Location not provided'}</p><span className="badge badge-green"><ShieldCheck size={13} /> Verified recycler access</span></div><Link className="button button-primary" to={`/recycler/lots/${chosen.id}`}>View lot <ChevronRight size={16} /></Link></Panel></>}
    </> : <Panel><EmptyState title="No suitable lots found">New lots matching your verified material categories will appear here.</EmptyState></Panel>}
  </div>
}

export function RecyclerLotDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [lot, setLot] = useState(null)
  const [photo, setPhoto] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    let active = true
    getClient().from('lots').select('*,materials(name,description),offers(id,status,offer_value,recycler_id)').eq('id', id).single()
      .then(async ({ data, error: queryError }) => {
        if (queryError) throw queryError
        if (active) { setLot(data); setLoading(false) }
        if (data.photo_url) {
          const url = await getSignedPhoto(data.photo_url)
          if (active) setPhoto(url || '')
        }
      }).catch(() => { if (active) { setError('This lot is unavailable or no longer accepting offers.'); setLoading(false) } })
    return () => { active = false }
  }, [id])

  async function submitOffer(event) {
    event.preventDefault()
    if (!lot || Number(amount) <= 0) return
    setSubmitting(true)
    setNotice('')
    const { data: userData } = await getClient().auth.getUser()
    const { data: recycler, error: recyclerError } = await getClient().from('recyclers').select('id,active,authorization_status').eq('profile_id', userData.user.id).single()
    if (recyclerError || !recycler?.active || recycler.authorization_status !== 'verified') {
      setError('Only active verified recyclers can submit offers.')
      setSubmitting(false)
      return
    }
    const { error: insertError } = await getClient().from('offers').insert({ lot_id: lot.id, recycler_id: recycler.id, offer_value: Number(amount), status: 'pending' })
    if (insertError) setError(insertError.code === '23505' ? 'You have already submitted an offer for this lot.' : 'Your offer could not be submitted. Please try again.')
    else { setNotice('Offer submitted. The collector can now compare it.'); setLot((current) => ({ ...current, offers: [...(current.offers || []), { recycler_id: recycler.id, status: 'pending', offer_value: amount }] })) }
    setSubmitting(false)
  }

  if (loading) return <LoadingState />
  if (error && !lot) return <ErrorState message={error} retry={() => navigate('/recycler/lots')} />
  const existing = lot?.offers?.find((offer) => offer.recycler_id)
  return <div className="page-stack">
    <Link to="/recycler/lots" className="text-link"><ChevronRight className="back-chevron" size={16} /> New lots</Link>
    <div className="detail-grid">
      <Panel><span className="eyebrow">LOT DETAILS</span><h2 className="detail-title">{lot.reference_id}</h2><div className="review-list"><div><span>Material</span><strong>{lot.materials?.name}</strong></div><div><span>Approximate weight</span><strong>{lot.approximate_weight} kg</strong></div><div><span>Service area</span><strong>{lot.service_location || (lot.latitude ? 'GPS coordinates available' : 'Location unavailable')}</strong></div><div><span>Created</span><strong>{new Date(lot.created_at).toLocaleString('en-IN')}</strong></div></div>{lot.description && <p className="lot-description">{lot.description}</p>}</Panel>
      <Panel>{photo ? <img className="detail-photo" src={photo} alt={`Collector lot ${lot.reference_id}`} /> : <div className="photo-placeholder">{lot.photo_url ? 'Photo unavailable' : 'No photo provided'}</div>}</Panel>
    </div>
    <Panel><PageHeading title="Submit offer" description="Enter the price you can offer for this lot." />
      {notice && <div className="alert alert-success">{notice}</div>}{error && <div className="alert alert-error">{error}</div>}
      {existing ? <div className="offer-confirm"><CheckCircle2 size={22} /><div><strong>Offer submitted</strong><span>{formatCurrency(existing.offer_value)} · awaiting collector response</span></div><StatusBadge status={existing.status} /></div> : <form className="offer-form" onSubmit={submitOffer}><label className="field"><span>Your offer (₹)</span><input type="number" min="1" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} required placeholder="Enter amount" /></label><button className="button button-primary" type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit offer'}</button></form>}
    </Panel>
  </div>
}

export function RecyclerAcceptedPage() {
  const { data: offers, loading, error } = useLoad(getRecyclerOffers)
  if (loading) return <LoadingState />
  if (error) return <ErrorState message="Accepted lots couldn't be loaded." />
  const accepted = (offers || []).filter((offer) => offer.status === 'accepted')
  return <div className="page-stack"><PageHeading title="My pickups" description="Lots accepted by your recycling business." />
    {accepted.length ? accepted.map((offer) => <Panel className="accepted-card" key={offer.id}><span className="lot-mark"><PackageCheck size={18} /></span><div className="compact-main"><strong>{offer.lots?.reference_id} · {offer.lots?.materials?.name}</strong><small>Original weight: {offer.lots?.approximate_weight} kg · Offer: {formatCurrency(offer.offer_value)}</small></div><StatusBadge status={offer.lots?.status} /><Link className="button button-primary" to={`/recycler/handover/${offer.lot_id}`}>Confirm handover</Link></Panel>) : <Panel><EmptyState title="No accepted lots yet">Offers selected by collectors will show here.</EmptyState></Panel>}
  </div>
}

export function RecyclerHandoverPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: offers, loading, error } = useLoad(getRecyclerOffers)
  const [weight, setWeight] = useState('')
  const [position, setPosition] = useState({ latitude: null, longitude: null, state: 'not_requested' })
  const [confirming, setConfirming] = useState(false)
  const [actionError, setActionError] = useState('')
  const accepted = offers?.find((offer) => offer.lot_id === id && offer.status === 'accepted')

  function locate() {
    if (!navigator.geolocation) { setPosition({ latitude: null, longitude: null, state: 'unavailable' }); return }
    setPosition((current) => ({ ...current, state: 'requesting' }))
    navigator.geolocation.getCurrentPosition(({ coords }) => setPosition({ latitude: coords.latitude, longitude: coords.longitude, state: 'available' }), () => setPosition({ latitude: null, longitude: null, state: 'unavailable' }), { timeout: 8000, maximumAge: 30000 })
  }

  async function confirm(event) {
    event.preventDefault()
    setConfirming(true)
    setActionError('')
    const { error: rpcError } = await getClient().rpc('confirm_handover', {
      p_lot_id: id, p_confirmed_weight: Number(weight), p_latitude: position.latitude, p_longitude: position.longitude,
    })
    if (rpcError) setActionError('Handover could not be recorded. Check the confirmed weight and try again.')
    else navigate('/recycler/offers', { replace: true, state: { handoverComplete: true } })
    setConfirming(false)
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message="Handover details couldn't be loaded." />
  if (!accepted) return <Panel><EmptyState title="Accepted offer not found">Only the recycler selected by the collector can confirm this handover.</EmptyState></Panel>
  return <div className="handover-wrap"><Panel className="handover-panel"><div className="handover-heading"><span className="badge badge-green">{accepted.lots?.reference_id}</span><strong>{accepted.lots?.materials?.name} · {accepted.lots?.approximate_weight} kg</strong></div>
    <div className="handover-summary"><span>Accepted offer</span><strong>{formatCurrency(accepted.offer_value)}</strong><span>Original approximate weight</span><strong>{accepted.lots?.approximate_weight} kg</strong></div>
    <form onSubmit={confirm} className="handover-form"><label className="field"><span>Confirm actual weight</span><div className="suffix-input"><input type="number" inputMode="decimal" min="0.01" step="0.01" required value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="0.00" /><strong>kg</strong></div></label>
      <button className="location-request" type="button" onClick={locate}><MapPin size={16} />{position.state === 'requesting' ? 'Finding location…' : position.state === 'available' ? 'Handover location captured' : 'Add handover location'}{position.state === 'unavailable' && <span>Location unavailable.</span>}</button>
      <div className="confirmation-note"><CheckCircle2 size={18} /><span>By confirming, you confirm this physical handover with the collector.</span></div>
      {actionError && <div className="alert alert-error">{actionError}</div>}
      <button className="button button-primary" type="submit" disabled={confirming || !Number(weight)}>{confirming ? 'Recording handover…' : 'Confirm handover'} <CheckCircle2 size={16} /></button>
    </form>
  </Panel></div>
}

export function RecyclerOffersPage() {
  const { data: offers, loading, error } = useLoad(getRecyclerOffers)
  const { data: payments } = useLoad(getTransactionRows)
  const [updating, setUpdating] = useState('')
  const [message, setMessage] = useState('')
  if (loading) return <LoadingState />
  if (error) return <ErrorState message="Offer history couldn't be loaded." />

  async function markPaid(paymentId) {
    setUpdating(paymentId)
    const { error: rpcError } = await getClient().rpc('record_payment_status', { p_payment_id: paymentId, p_status: 'paid' })
    setMessage(rpcError ? 'Payment status could not be updated.' : 'Payment marked as paid.')
    setUpdating('')
    if (!rpcError) window.location.reload()
  }

  return <div className="page-stack"><PageHeading title="Offers and payments" description="Your submitted offers and recorded transaction payments." />
    {message && <div className="alert alert-success">{message}</div>}
    <Panel><PageHeading title="Submitted offers" />{offers?.length ? <div className="data-table-wrap"><table><thead><tr><th>Lot</th><th>Material</th><th>Offer</th><th>Status</th></tr></thead><tbody>{offers.map((offer) => <tr key={offer.id}><td>{offer.lots?.reference_id}</td><td>{offer.lots?.materials?.name}</td><td>{formatCurrency(offer.offer_value)}</td><td><StatusBadge status={offer.status} /></td></tr>)}</tbody></table></div> : <EmptyState title="No offers yet">Your submitted offers will be listed here.</EmptyState>}</Panel>
    <Panel><PageHeading title="Transaction payments" />{payments?.length ? <div className="data-table-wrap"><table><thead><tr><th>Lot</th><th>Recycler</th><th>Amount</th><th>Status</th><th /></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td>{payment.lots?.reference_id}</td><td>{payment.handovers?.offers?.recyclers?.business_name}</td><td>{formatCurrency(payment.amount)}</td><td><StatusBadge status={payment.status} /></td><td>{payment.status === 'pending' && <button className="text-link table-button" disabled={Boolean(updating)} onClick={() => markPaid(payment.id)}>{updating === payment.id ? 'Updating…' : 'Mark paid'}</button>}</td></tr>)}</tbody></table></div> : <EmptyState title="No transactions recorded">A payment record is created after a confirmed handover.</EmptyState>}</Panel>
  </div>
}