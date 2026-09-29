import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Boxes, Camera, Check, ChevronLeft, ChevronRight, CircleCheck, ClipboardList, HandCoins, ImagePlus, MapPin, PackagePlus, RefreshCw, Scale, ShieldCheck, Upload, Wallet, Zap } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { listQueuedLots, makeLocalId, removeQueuedLot, saveQueuedLot } from '../../offline/lotQueue'
import { getBenchmark, getClient, getCollectorTransaction, getCollectorTransactions, getLot, getMaterials, getOwnLots, getSignedPhoto, getSuitableRecyclers, getTraceability, syncPendingLots } from '../../services/scrapsetu'
import { EmptyState, ErrorState, LoadingState, PageHeading, Panel, StatusBadge, TraceTimeline, formatCurrency, useLoad } from '../../components/WorkflowUI'

function dailySeries(records, timestampFor, amountFor = () => 1) {
  const today = new Date()
  const keyFor = (date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
  const keys = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + index)
    return keyFor(date)
  })
  const totals = new Map(keys.map((key) => [key, 0]))
  for (const record of records) {
    const date = new Date(timestampFor(record))
    if (Number.isNaN(date.getTime())) continue
    const key = keyFor(date)
    if (!totals.has(key)) continue
    const amount = Number(amountFor(record))
    if (Number.isFinite(amount)) totals.set(key, totals.get(key) + amount)
  }
  return keys.map((key) => totals.get(key))
}

function Sparkline({ values }) {
  const maximum = Math.max(...values)
  const points = values.map((value, index) => `${3 + index * (94 / (values.length - 1))},${29 - (maximum ? value / maximum : 0) * 25}`)
  const line = `M ${points.join(' L ')}`
  const area = `${line} L 97,32 L 3,32 Z`
  return <svg className="metric-sparkline" viewBox="0 0 100 34" preserveAspectRatio="none" aria-hidden="true">
    <path d={area} fill="currentColor" opacity=".13" />
    <path d={line} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
}

function Metric({ label, value, note, icon: Icon, tone, graph }) {
  return <Panel className={`metric-panel dashboard-metric dashboard-metric-${tone}`}>
    <span className="dashboard-metric-icon" aria-hidden="true"><Icon size={19} strokeWidth={1.8} /></span>
    <span className="metric-label">{label}</span>
    <strong className="metric-value">{value}</strong>
    <span className="metric-note">{note}</span>
    <Sparkline values={graph} />
  </Panel>
}

function DashboardSectionHeading({ icon: Icon, title, action, tone }) {
  return <div className="dashboard-section-heading">
    <span className={`dashboard-section-icon dashboard-section-icon-${tone}`} aria-hidden="true"><Icon size={17} strokeWidth={1.9} /></span>
    <h2>{title}</h2>
    {action}
  </div>
}

export function CollectorDashboard() {
  const { session } = useAuth()
  const online = useOnlineStatus()
  const [queue, setQueue] = useState([])
  const [syncing, setSyncing] = useState(false)
  const { data: dashboardData, loading, error } = useLoad(async () => {
    const lots = await getOwnLots()
    const transactions = await getCollectorTransactions(lots)
    return { lots, transactions }
  })
  useEffect(() => {
    if (!session?.user?.id) return undefined
    const refreshQueue = () => listQueuedLots(session.user.id).then(setQueue).catch(() => setQueue([]))
    refreshQueue()
    window.addEventListener('scrapsetu:queue-change', refreshQueue)
    return () => window.removeEventListener('scrapsetu:queue-change', refreshQueue)
  }, [session?.user?.id, syncing])

  async function retrySync() {
    if (!online || !session?.user?.id) return
    setSyncing(true)
    await syncPendingLots(session.user.id)
    setSyncing(false)
    window.location.reload()
  }

  const rows = dashboardData?.lots || []
  const transactions = dashboardData?.transactions || []
  const completed = rows.filter((lot) => lot.status === 'completed')
  const earnings = transactions.filter((transaction) => transaction.status === 'paid')
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0)
  const activeLotsGraph = dailySeries(rows.filter((lot) => lot.status !== 'completed'), (lot) => lot.created_at)
  const offersGraph = dailySeries(rows.flatMap((lot) => (lot.offers || []).filter((offer) => offer.status === 'pending')), (offer) => offer.created_at)
  const completedSalesGraph = dailySeries(completed, (lot) => lot.updated_at)
  const earningsGraph = dailySeries(transactions.filter((transaction) => transaction.status === 'paid'), (transaction) => transaction.paid_at || transaction.created_at, (transaction) => transaction.amount)
  return <div className="page-stack collector-dashboard">
    <div className="welcome-row dashboard-welcome"><div><span className="eyebrow">COLLECTOR PORTAL</span><h2>Turn e-waste into value</h2><p>Capture a lot and connect with verified recyclers.</p></div><Link to="/collector/create-lot" className="button button-primary"><PackagePlus size={17} /> Add E-Waste</Link></div>
    {queue.length > 0 && <div className="sync-strip"><div><span className="sync-dot" />{queue.length} {queue.length === 1 ? 'lot' : 'lots'} waiting to sync</div><button className="button button-soft" type="button" onClick={retrySync} disabled={!online || syncing}><RefreshCw size={15} className={syncing ? 'spin' : ''} /> {syncing ? 'Syncing' : 'Sync now'}</button></div>}
    <div className="metric-grid metric-grid-four">
      <Metric label="Active Lots" value={rows.filter((lot) => lot.status !== 'completed').length + queue.length} note="In progress" icon={Boxes} tone="mint" graph={activeLotsGraph} />
      <Metric label="Offers Received" value={rows.reduce((sum, lot) => sum + (lot.offers?.filter((offer) => offer.status === 'pending').length || 0), 0)} note="From recyclers" icon={HandCoins} tone="lavender" graph={offersGraph} />
      <Metric label="Completed Sales" value={completed.length} note="All time" icon={CircleCheck} tone="blue" graph={completedSalesGraph} />
      <Metric label="Earnings" value={formatCurrency(earnings)} note="Recorded sales" icon={Wallet} tone="amber" graph={earningsGraph} />
    </div>
    <div className="dashboard-grid">
      <Panel className="dashboard-surface recent-lots-panel"><DashboardSectionHeading icon={ClipboardList} title="Recent lots" tone="mint" action={<Link className="text-link" to="/collector/lots">View all</Link>} />
        {loading ? <LoadingState /> : error ? <ErrorState message="Lots couldn't be loaded." /> : rows.length ? <div className="compact-list">{rows.slice(0, 4).map((lot) => <Link className="compact-row recent-lot-row" to={`/collector/lots/${lot.id}`} key={lot.id}><span className="lot-mark recent-lot-mark">{lot.materials?.name?.slice(0, 2) || 'EW'}</span><span className="compact-main recent-lot-copy"><strong>{lot.reference_id}</strong><small>{lot.materials?.name} · {lot.approximate_weight} kg</small></span><span className="recent-lot-status"><StatusBadge status={lot.status} /><ChevronRight size={17} /></span></Link>)}</div> : <EmptyState title="No lots yet">Add your first e-waste lot to get started.</EmptyState>}
      </Panel>
      <Panel className="dashboard-surface"><DashboardSectionHeading icon={Zap} title="Quick actions" tone="amber" /><div className="quick-action-list">
        <Link className="button button-primary" to="/collector/create-lot"><PackagePlus size={16} /> Sell scrap</Link>
        <Link className="button button-cream" to="/collector/recyclers"><ShieldCheck size={16} /> Find a recycler</Link>
        <Link className="button button-quiet" to="/collector/transactions"><Wallet size={16} /> View earnings</Link>
      </div><div className="connect-state"><span className={`connection-dot ${online ? '' : 'off'}`} />{online ? 'Connected and ready to sync' : 'Offline. New lots are saved here.'}</div></Panel>
    </div>
  </div>
}

const flowSteps = ['Photo', 'Material', 'Weight', 'Details']

export function CreateLotPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const online = useOnlineStatus()
  const { data: materials, loading: loadingMaterials, error: materialError } = useLoad(getMaterials)
  const [step, setStep] = useState(0)
  const [materialId, setMaterialId] = useState('')
  const [weight, setWeight] = useState('')
  const [description, setDescription] = useState('')
  const [serviceLocation, setServiceLocation] = useState('')
  const [photo, setPhoto] = useState(null)
  const [preview, setPreview] = useState('')
  const [position, setPosition] = useState({ latitude: null, longitude: null, status: 'not_requested' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const selectedMaterial = materials?.find((item) => item.id === materialId)

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  function choosePhoto(file) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Choose a JPG, PNG, or WebP image.'); return }
    if (file.size > 5 * 1024 * 1024) { setError('This photo is over 5 MB. Choose a smaller image.'); return }
    setError('')
    setPhoto(file)
    setPreview(URL.createObjectURL(file))
  }

  function requestLocation() {
    if (!navigator.geolocation) { setPosition({ latitude: null, longitude: null, status: 'unavailable' }); return }
    setPosition((current) => ({ ...current, status: 'requesting' }))
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setPosition({ latitude: coords.latitude, longitude: coords.longitude, status: 'available' }),
      () => setPosition({ latitude: null, longitude: null, status: 'unavailable' }),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    )
  }

  function canContinue() {
    if (step === 0) return Boolean(photo)
    if (step === 1) return Boolean(materialId)
    if (step === 2) return Number(weight) > 0
    return true
  }

  async function createLot() {
    if (!materialId || Number(weight) <= 0) return
    if (!session?.user?.id) {
      setError('Your sign-in session expired. Sign in again before saving this lot.')
      return
    }
    setSaving(true)
    setError('')
    const localId = makeLocalId()
    let savedLocally = false
    const localRecord = {
      localId, userId: session.user.id, materialId, materialName: selectedMaterial?.name, serviceLocation: serviceLocation.trim(),
      weight: Number(weight), description, photo, latitude: position.latitude, longitude: position.longitude,
      createdAt: new Date().toISOString(), status: 'pending_sync', retryCount: 0,
    }
    try {
      await saveQueuedLot(localRecord)
      savedLocally = true
      if (online) {
        const result = await syncPendingLots(session.user.id)
        if (result.some((item) => item.localId === localId && item.success)) navigate('/collector/lots', { replace: true, state: { created: true } })
        else navigate('/collector/lots', { replace: true, state: { pending: true } })
      } else {
        navigate('/collector/lots', { replace: true, state: { pending: true } })
      }
    } catch (createError) {
      console.error('[ScrapSetu] Create lot flow failed', {
        error: createError,
        message: createError.message,
        details: createError.details || createError.cause?.details,
        hint: createError.hint || createError.cause?.hint,
        code: createError.code || createError.cause?.code,
      })
      if (savedLocally) {
        navigate('/collector/lots', { replace: true, state: { pending: true } })
        return
      }
      setError('Your lot could not be saved on this device. Please try again.')
      setSaving(false)
    }
  }

  return <div className="create-flow">
    <div className="flow-progress" aria-label={`Step ${step + 1} of ${flowSteps.length}`}>
      {flowSteps.map((label, index) => <div key={label} className={`flow-step ${index <= step ? 'current' : ''}`}><span>{index < step ? <Check size={14} /> : index + 1}</span><small>{label}</small></div>)}
    </div>
    <Panel className="flow-panel">
      {step === 0 && <div className="flow-content">
        <span className="eyebrow">STEP 1 OF 4</span><h2>Take a photo</h2><p>Show the e-waste clearly. The image stays on this device until it syncs.</p>
        <label className={`photo-drop ${preview ? 'has-photo' : ''}`}>
          {preview ? <img src={preview} alt="Selected e-waste" /> : <><ImagePlus size={31} /><strong>Add a photo</strong><span>JPG, PNG or WebP, up to 5 MB</span></>}
          <input type="file" accept="image/*" capture="environment" onChange={(event) => choosePhoto(event.target.files?.[0])} />
        </label>
        <div className="button-row photo-buttons"><label className="button button-cream"><Camera size={16} /> Take photo<input hidden type="file" accept="image/*" capture="environment" onChange={(event) => choosePhoto(event.target.files?.[0])} /></label><label className="button button-quiet"><Upload size={16} /> Upload<input hidden type="file" accept="image/*" onChange={(event) => choosePhoto(event.target.files?.[0])} /></label></div>
      </div>}
      {step === 1 && <div className="flow-content">
        <span className="eyebrow">STEP 2 OF 4</span><h2>What are you selling?</h2><p>Choose the closest material category.</p>
        {loadingMaterials ? <LoadingState /> : materialError ? <ErrorState message="Material categories couldn't be loaded." /> : <div className="material-grid">{(materials || []).map((material) => <button key={material.id} type="button" className={`material-choice ${materialId === material.id ? 'selected' : ''}`} onClick={() => setMaterialId(material.id)}><span className="material-icon">{material.name.split(/\s|\//)[0].slice(0, 2).toUpperCase()}</span><strong>{material.name}</strong><small>{material.description}</small>{materialId === material.id && <Check size={17} className="material-check" />}</button>)}</div>}
      </div>}
      {step === 2 && <div className="flow-content weight-content">
        <span className="eyebrow">STEP 3 OF 4</span><span className="material-overline">{selectedMaterial?.name}</span><h2>How much does it weigh?</h2>
        <label className="weight-input"><input inputMode="decimal" type="number" min="0.01" step="0.01" value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="0.00" aria-label="Approximate weight in kilograms" /><strong>kg</strong></label>
        <p className="field-hint">Approximate weight. Final weight will be confirmed during handover.</p>
      </div>}
      {step === 3 && <div className="flow-content">
        <span className="eyebrow">STEP 4 OF 4</span><h2>Lot preview</h2><p>Check the details before saving.</p>
        <div className="review-list"><div><span>Material</span><strong>{selectedMaterial?.name}</strong></div><div><span>Approximate weight</span><strong>{Number(weight).toFixed(2)} kg</strong></div><div><span>GPS</span><strong>{position.status === 'available' ? 'Location captured' : 'Location unavailable'}</strong></div></div>
        <label className="field"><span>Description <small>Optional</small></span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={240} placeholder="Add a short note about these items" /></label>
        <label className="field"><span>City or area for recycler matching <small>Optional</small></span><input value={serviceLocation} onChange={(event) => setServiceLocation(event.target.value)} maxLength={80} placeholder="For example, Delhi NCR" /></label>
        <button className="location-request" type="button" onClick={requestLocation} disabled={position.status === 'requesting'}><MapPin size={16} />{position.status === 'requesting' ? 'Finding location…' : position.status === 'available' ? 'Location captured' : 'Add my location'}{position.status === 'unavailable' && <span>Location unavailable.</span>}</button>
      </div>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <div className="flow-actions">
        {step > 0 ? <button className="button button-quiet" type="button" onClick={() => setStep((value) => value - 1)}><ChevronLeft size={16} /> Back</button> : <Link className="button button-quiet" to="/collector">Cancel</Link>}
        {step < 3 ? <button className="button button-primary" type="button" disabled={!canContinue()} onClick={() => setStep((value) => value + 1)}>Continue <ChevronRight size={16} /></button> : <button className="button button-primary" type="button" disabled={saving} onClick={createLot}>{saving ? 'Saving lot…' : online ? 'Create lot' : 'Save lot offline'} <PackagePlus size={16} /></button>}
      </div>
    </Panel>
  </div>
}

export function CollectorLotsPage() {
  const { session } = useAuth()
  const location = useLocation()
  const online = useOnlineStatus()
  const [queued, setQueued] = useState([])
  const [retrying, setRetrying] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const { data: lots, loading, error } = useLoad(getOwnLots)
  useEffect(() => {
    if (!session?.user?.id) return undefined
    const refreshQueue = () => listQueuedLots(session.user.id).then(setQueued).catch(() => {})
    refreshQueue()
    window.addEventListener('scrapsetu:queue-change', refreshQueue)
    return () => window.removeEventListener('scrapsetu:queue-change', refreshQueue)
  }, [session?.user?.id, attempted])
  async function retry() {
    setRetrying(true)
    await syncPendingLots(session.user.id)
    setAttempted(true)
    setRetrying(false)
    window.location.reload()
  }
  return <div className="page-stack">
    <PageHeading title="My lots" description="Track the progress of your e-waste." action={<Link className="button button-primary" to="/collector/create-lot"><PackagePlus size={16} /> Add E-Waste</Link>} />
    {location.state?.created && <div className="alert alert-success" role="status">Lot saved to your account.</div>}
    {location.state?.pending && <div className="alert alert-warning" role="status">Your lot is saved on this device and is waiting to sync to your account.</div>}
    {queued.length > 0 && <Panel className="sync-strip"><div><span className="sync-dot" /><strong>{queued.length} {queued.length === 1 ? 'lot' : 'lots'} waiting to sync</strong><small>{queued.some((lot) => lot.status === 'sync_failed') ? "Sync failed. We'll retry when you're connected." : 'Saved on this device.'}</small></div><button className="button button-soft" disabled={!online || retrying} onClick={retry} type="button"><RefreshCw size={15} className={retrying ? 'spin' : ''} /> Retry sync</button></Panel>}
    {loading ? <LoadingState /> : error ? <ErrorState message="Your lots couldn't be loaded." /> : <Panel className="table-panel"><div className="data-table-wrap"><table><thead><tr><th>Lot</th><th>Material</th><th>Weight</th><th>Created</th><th>Status</th><th /></tr></thead><tbody>
      {(lots || []).map((lot) => <tr key={lot.id}><td><Link className="table-link" to={`/collector/lots/${lot.id}`}>{lot.reference_id}</Link></td><td>{lot.materials?.name}</td><td>{Number(lot.approximate_weight).toFixed(2)} kg</td><td>{new Date(lot.created_at).toLocaleDateString('en-IN')}</td><td><StatusBadge status={lot.status} /></td><td><Link className="text-link" to={`/collector/lots/${lot.id}`}>View</Link></td></tr>)}
      </tbody></table></div>{!lots?.length && <EmptyState title="No lots yet">Your saved lots will appear here.</EmptyState>}</Panel>}
    {queued.map((lot) => <Panel className="local-lot-row" key={lot.localId}><span className="lot-mark">{lot.materialName?.slice(0, 2) || 'EW'}</span><div className="compact-main"><strong>Waiting to Sync</strong><small>{lot.materialName} · {lot.weight} kg · saved on this device</small></div><StatusBadge status={lot.status} /></Panel>)}
  </div>
}

export function CollectorLotDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: lot, loading, error } = useLoad(() => getLot(id), [id])
  const { data: events } = useLoad(() => getTraceability(id), [id])
  const [benchmark, setBenchmark] = useState(null)
  const [recyclers, setRecyclers] = useState([])
  const [photoUrl, setPhotoUrl] = useState('')
  const [accepting, setAccepting] = useState('')
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    if (!lot) return
    let active = true
    Promise.all([getBenchmark(lot.material_id, lot.service_location), getSuitableRecyclers(lot.material_id, lot.service_location)])
      .then(([rate, matches]) => { if (active) { setBenchmark(rate); setRecyclers(matches) } })
      .catch(() => {})
    if (lot.photo_url) getSignedPhoto(lot.photo_url).then((url) => { if (active) setPhotoUrl(url || '') })
    return () => { active = false }
  }, [lot])

  async function acceptOffer(offerId) {
    setAccepting(offerId)
    setActionError('')
    const { error: rpcError } = await getClient().rpc('accept_offer', { p_offer_id: offerId })
    if (rpcError) setActionError('That offer could not be accepted. Refresh and try again.')
    else navigate(0)
    setAccepting('')
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message="This lot couldn't be loaded." retry={() => navigate(0)} />
  const range = benchmark ? [Number(benchmark.minimum_price) * Number(lot.approximate_weight), Number(benchmark.maximum_price) * Number(lot.approximate_weight)] : null
  const offers = lot.offers || []
  return <div className="page-stack">
    <div className="back-row"><Link to="/collector/lots" className="text-link"><ChevronLeft size={16} /> My lots</Link><StatusBadge status={lot.status} /></div>
    <div className="detail-grid">
      <Panel><div className="lot-title-row"><div><span className="eyebrow">{lot.reference_id}</span><h2>{lot.materials?.name}</h2><p>Approx. {Number(lot.approximate_weight).toFixed(2)} kg · {new Date(lot.created_at).toLocaleString('en-IN')}</p></div>{lot.photo_url && photoUrl && <img className="lot-photo-thumb" src={photoUrl} alt={`${lot.materials?.name} lot`} />}</div>
        {lot.description && <p className="lot-description">{lot.description}</p>}
        {range && <div className="benchmark-panel"><div><span>Indicative market benchmark</span><strong>{formatCurrency(range[0])} – {formatCurrency(range[1])}</strong><small>{lot.materials?.name} · {lot.approximate_weight} kg · {benchmark.location}</small><em>{benchmark.source?.toLowerCase().includes('demo') ? 'Demo data · not a live market price' : `Source: ${benchmark.source}`}</em></div><span className="badge badge-green">Indicative</span></div>}
        {!benchmark && <div className="benchmark-unavailable">No indicative benchmark is available for this area yet.</div>}
        <p className="disclaimer">This is an indicative market benchmark, not a guaranteed selling price. Final value depends on the recycler's offer and confirmed handover details.</p>
      </Panel>
      <Panel><PageHeading title="Suitable recyclers" description="Verified recyclers that accept this material." />
        {recyclers.length ? <div className="recycler-list">{recyclers.map((recycler) => <div className="recycler-row" key={recycler.id}><span className="recycler-avatar">{recycler.business_name.slice(0, 1)}</span><div className="compact-main"><strong>{recycler.business_name}</strong><small>{recycler.location || recycler.service_area || 'Service details available'}</small></div><span className="badge badge-green"><ShieldCheck size={12} /> Verified</span></div>)}</div> : <EmptyState title="No suitable verified recycler found">We'll show compatible recyclers here when they're available.</EmptyState>}
      </Panel>
    </div>
    <Panel><PageHeading title="Offers" description="Offers come from recyclers. Choose the one that works for you." />
      {actionError && <div className="alert alert-error">{actionError}</div>}
      {offers.length ? <div className="offer-grid">{offers.map((offer) => <div className="offer-panel" key={offer.id}><div className="offer-top"><span className="recycler-avatar">{offer.recyclers?.business_name?.slice(0, 1) || 'R'}</span><StatusBadge status={offer.recyclers?.authorization_status} /></div><strong>{offer.recyclers?.business_name || 'Verified recycler'}</strong><span className="offer-price">{formatCurrency(offer.offer_value)}</span><StatusBadge status={offer.status} />{offer.status === 'pending' && lot.status !== 'offer_accepted' && <button className="button button-primary" disabled={Boolean(accepting)} onClick={() => acceptOffer(offer.id)}>{accepting === offer.id ? 'Accepting…' : 'Accept offer'}</button>}</div>)}</div> : <EmptyState title="No offers yet">We'll show recycler offers here when they respond.</EmptyState>}
    </Panel>
    <Panel><PageHeading title="Lot traceability" description="Recorded events from this lot's journey." /><TraceTimeline events={events} /></Panel>
  </div>
}

export function CollectorTransactionsPage() {
  const { data: transactions, loading, error } = useLoad(getCollectorTransactions)
  if (loading) return <LoadingState />
  if (error) return <ErrorState message="Earnings couldn't be loaded." />
  const rows = transactions || []
  const paid = rows.filter((row) => row.status === 'paid').reduce((sum, row) => sum + Number(row.amount), 0)
  return <div className="page-stack"><div className="metric-grid metric-grid-three"><Metric label="Total earned" value={formatCurrency(paid)} note="Paid transactions" /><Metric label="Completed lots" value={rows.length} note="All time" /><Metric label="Pending payments" value={formatCurrency(rows.filter((row) => row.status === 'pending').reduce((sum, row) => sum + Number(row.amount), 0))} note="Awaiting payment" /></div>
    <Panel><PageHeading title="Earnings history" description="Only recorded transactions are shown." />{rows.length ? <div className="data-table-wrap"><table><thead><tr><th>Lot</th><th>Material</th><th>Weight</th><th>Recycler</th><th>Value</th><th>Status</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><Link className="table-link" to={`/collector/transactions/${row.id}`}>{row.lots?.reference_id}</Link></td><td>{row.lots?.materials?.name}</td><td>{row.handovers?.confirmed_weight} kg</td><td>{row.handovers?.offers?.recyclers?.business_name}</td><td>{formatCurrency(row.amount)}</td><td><StatusBadge status={row.status} /></td></tr>)}</tbody></table></div> : <EmptyState title="No completed sales yet">Your transaction history will appear here after a handover.</EmptyState>}</Panel>
  </div>
}

export function CollectorTransactionDetailPage() {
  const { id } = useParams()
  const { data: transaction, loading, error } = useLoad(() => getCollectorTransaction(id), [id])
  const { data: events } = useLoad(() => transaction?.lot_id ? getTraceability(transaction.lot_id) : Promise.resolve([]), [transaction?.lot_id])
  if (loading) return <LoadingState />
  if (error) return <ErrorState message="This transaction couldn't be loaded." />
  return <div className="page-stack">
    <Link to="/collector/transactions" className="text-link">‹ Earnings</Link>
    <Panel className="payment-receipt"><span className="payment-check"><Check size={18} /></span><h2>{transaction.status === 'paid' ? 'Payment received' : 'Handover complete'}</h2><strong className="receipt-amount">{formatCurrency(transaction.amount)}</strong><span>{transaction.lots?.reference_id} · {transaction.lots?.materials?.name} · {transaction.handovers?.confirmed_weight} kg</span><StatusBadge status={transaction.status} /></Panel>
    <Panel><PageHeading title="Transaction details" /><div className="review-list"><div><span>Authorized recycler</span><strong>{transaction.handovers?.offers?.recyclers?.business_name}</strong></div><div><span>Original approximate weight</span><strong>{transaction.lots?.approximate_weight} kg</strong></div><div><span>Confirmed handover weight</span><strong>{transaction.handovers?.confirmed_weight} kg</strong></div><div><span>Handover date</span><strong>{new Date(transaction.handovers?.handover_timestamp).toLocaleString('en-IN')}</strong></div><div><span>Final transaction value</span><strong>{formatCurrency(transaction.handovers?.final_value)}</strong></div></div><div className="formal-pathway"><span className="badge badge-green"><ShieldCheck size={12} /> Transferred to authorized recycler</span><p>ScrapSetu records this transfer and supports its formal recycling pathway.</p></div></Panel>
    <Panel><PageHeading title="Traceability" description="Events recorded for this lot." /><TraceTimeline events={events} /></Panel>
  </div>
}

export function CollectorRecyclerListPage() {
  const { data: matches, loading, error } = useLoad(async () => {
    const lots = await getOwnLots()
    return Promise.all(lots.map(async (lot) => ({
      lot,
      recyclers: await getSuitableRecyclers(lot.material_id, lot.service_location),
    })))
  })
  if (loading) return <LoadingState />
  if (error) return <ErrorState message="Suitable recyclers couldn't be loaded." />
  const lotsWithMatches = matches || []
  return <div className="page-stack"><PageHeading title="Find a recycler" description="Verified recyclers are matched to your lot material." />
    {lotsWithMatches.length ? lotsWithMatches.map(({ lot, recyclers }) => <Panel key={lot.id}><div className="lot-title-row"><div><span className="eyebrow">{lot.reference_id}</span><h2>{lot.materials?.name} · {lot.approximate_weight} kg</h2><p>{lot.service_location || 'Location unavailable'}</p></div><Link className="text-link" to={`/collector/lots/${lot.id}`}>View lot <ChevronRight size={15} /></Link></div>{recyclers.length ? <div className="recycler-list">{recyclers.map((recycler) => <div className="recycler-row" key={recycler.id}><span className="recycler-avatar">{recycler.business_name[0]}</span><div className="compact-main"><strong>{recycler.business_name}</strong><small>{recycler.location || recycler.service_area || 'Service details available'}</small></div><span className="badge badge-green"><ShieldCheck size={12} /> Verified</span></div>)}</div> : <EmptyState title="No suitable verified recycler found">No active verified recycler currently accepts this material in this area.</EmptyState>}</Panel>) : <Panel><EmptyState title="Create a lot to find a recycler">Suitable recyclers are matched from each lot's material and service area.</EmptyState></Panel>}
  </div>
}