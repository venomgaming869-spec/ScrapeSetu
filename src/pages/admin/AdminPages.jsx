import { useState } from 'react'
import { Check, ChevronRight, CircleAlert, ShieldCheck, Tags, Wallet, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getClient, getTransactionRows } from '../../services/scrapsetu'
import { EmptyState, ErrorState, LoadingState, PageHeading, Panel, StatusBadge, TraceTimeline, formatCurrency, useLoad } from '../../components/WorkflowUI'

function Metric({ label, value, note }) {
  return <Panel className="metric-panel"><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong><span className="metric-note">{note}</span></Panel>
}

async function countRows(table, filters = []) {
  let query = getClient().from(table).select('*', { count: 'exact', head: true })
  for (const [column, operator, value] of filters) query = query[operator](column, value)
  const { count, error } = await query
  if (error) throw error
  return count || 0
}

export function AdminDashboard() {
  const { data, loading, error } = useLoad(async () => Promise.all([
    countRows('profiles', [['role', 'eq', 'collector']]),
    countRows('recyclers', [['authorization_status', 'eq', 'verified'], ['active', 'eq', true]]),
    countRows('lots', [['status', 'neq', 'completed']]),
    countRows('offers', [['status', 'eq', 'pending']]),
    countRows('handovers', [['status', 'eq', 'confirmed']]),
  ]))
  if (loading) return <LoadingState />
  if (error) return <ErrorState message="Platform totals couldn't be loaded." />
  const [collectors, recyclers, activeLots, pendingOffers, transactions] = data
  return <div className="page-stack">
    <div className="metric-grid metric-grid-five"><Metric label="Collectors" value={collectors} note="Registered" /><Metric label="Verified recyclers" value={recyclers} note="Active authorization" /><Metric label="Active lots" value={activeLots} note="In progress" /><Metric label="Pending offers" value={pendingOffers} note="Awaiting collector" /><Metric label="Transactions" value={transactions} note="Confirmed handovers" /></div>
    <div className="dashboard-grid">
      <Panel><PageHeading title="Platform operations" description="Live records from ScrapSetu." /><div className="admin-shortcuts">
        <Link className="admin-shortcut" to="/admin/recyclers"><span className="admin-shortcut-icon"><ShieldCheck size={18} /></span><span><strong>Recycler verification</strong><small>Review authorization and service area</small></span><ChevronRight size={16} /></Link>
        <Link className="admin-shortcut" to="/admin/materials"><span className="admin-shortcut-icon"><Tags size={18} /></span><span><strong>Material data</strong><small>Maintain active material categories</small></span><ChevronRight size={16} /></Link>
        <Link className="admin-shortcut" to="/admin/prices"><span className="admin-shortcut-icon"><Wallet size={18} /></span><span><strong>Price benchmarks</strong><small>Edit indicative benchmark records</small></span><ChevronRight size={16} /></Link>
      </div></Panel>
      <Panel><PageHeading title="System status" /><div className="health-list"><span className="badge badge-green">Supabase connected</span><span className="badge badge-green">RLS enabled</span><span className="badge badge-green">Private image bucket</span></div></Panel>
    </div>
    <AdminTransactionsTable compact />
  </div>
}

export function AdminRecyclersPage() {
  const { data: recyclers, loading, error, setData } = useLoad(async () => {
    const { data, error: queryError } = await getClient().from('recyclers')
      .select('*,profiles(name,phone),recycler_materials(material_id,materials(name))').order('created_at', { ascending: false })
    if (queryError) throw queryError
    return data || []
  })
  const { data: materials } = useLoad(async () => {
    const { data, error: queryError } = await getClient().from('materials').select('id,name').eq('active', true).order('name')
    if (queryError) throw queryError
    return data || []
  })
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [selectedRecyclerId, setSelectedRecyclerId] = useState('')
  const [selectedMaterialIds, setSelectedMaterialIds] = useState([])
  const [savingMaterials, setSavingMaterials] = useState(false)
  async function setRecyclerStatus(id, authorizationStatus, active) {
    setBusy(id)
    setMessage('')
    const { error: updateError } = await getClient().from('recyclers').update({ authorization_status: authorizationStatus, active }).eq('id', id)
    if (updateError) setMessage('Recycler status could not be updated.')
    else setData(recyclers.map((item) => item.id === id ? { ...item, authorization_status: authorizationStatus, active } : item))
    setBusy('')
  }
  function selectRecycler(id) {
    setSelectedRecyclerId(id)
    const recycler = recyclers?.find((item) => item.id === id)
    setSelectedMaterialIds((recycler?.recycler_materials || []).map((item) => item.material_id))
  }
  async function saveRecyclerMaterials() {
    setSavingMaterials(true)
    const { error: saveError } = await getClient().rpc('admin_set_recycler_materials', { p_recycler_id: selectedRecyclerId, p_material_ids: selectedMaterialIds })
    if (saveError) setMessage('Supported materials could not be saved.')
    else {
      setData(recyclers.map((item) => item.id === selectedRecyclerId ? {
        ...item, recycler_materials: selectedMaterialIds.map((materialId) => ({ material_id: materialId, materials: materials.find((material) => material.id === materialId) })),
      } : item))
      setMessage('Supported materials saved.')
    }
    setSavingMaterials(false)
  }
  if (loading) return <LoadingState />
  if (error) return <ErrorState message="Recycler records couldn't be loaded." />
  return <div className="page-stack"><Panel className="table-panel"><PageHeading title="Recycler verification" description="Only verified, active recyclers can receive matching lots." />{message && <div className="alert alert-success">{message}</div>}
    {recyclers?.length ? <div className="data-table-wrap"><table><thead><tr><th>Recycler</th><th>Area</th><th>Materials</th><th>Verification</th><th>Status</th><th>Review</th></tr></thead><tbody>{recyclers.map((recycler) => <tr key={recycler.id}><td><strong>{recycler.business_name}</strong><small className="table-subline">{recycler.profiles?.name}</small></td><td>{recycler.location || recycler.service_area || 'Not provided'}</td><td>{(recycler.recycler_materials || []).map((item) => item.materials?.name).filter(Boolean).join(', ') || 'None selected'}</td><td><StatusBadge status={recycler.authorization_status} /></td><td><StatusBadge status={recycler.active ? 'active' : 'inactive'} /></td><td><div className="table-actions">{recycler.authorization_status !== 'verified' && <button type="button" className="icon-action approve" title="Verify recycler" aria-label={`Verify ${recycler.business_name}`} disabled={Boolean(busy)} onClick={() => setRecyclerStatus(recycler.id, 'verified', true)}><Check size={15} /></button>}{recycler.authorization_status !== 'rejected' && <button type="button" className="icon-action reject" title="Reject recycler" aria-label={`Reject ${recycler.business_name}`} disabled={Boolean(busy)} onClick={() => setRecyclerStatus(recycler.id, 'rejected', false)}><X size={15} /></button>}{recycler.authorization_status === 'verified' && <button type="button" className="icon-action" title={recycler.active ? 'Deactivate recycler' : 'Activate recycler'} aria-label={recycler.active ? 'Deactivate recycler' : 'Activate recycler'} disabled={Boolean(busy)} onClick={() => setRecyclerStatus(recycler.id, 'verified', !recycler.active)}>{recycler.active ? <CircleAlert size={15} /> : <Check size={15} />}</button>}</div></td></tr>)}</tbody></table></div> : <EmptyState title="No recycler applications">Recycler applications will appear here for verification.</EmptyState>}
  </Panel><Panel><PageHeading title="Supported materials" description="Assign the materials this recycler can accept for matching." />
    <label className="field admin-select"><span>Recycler</span><select value={selectedRecyclerId} onChange={(event) => selectRecycler(event.target.value)}><option value="">Select a recycler</option>{recyclers?.map((item) => <option key={item.id} value={item.id}>{item.business_name}</option>)}</select></label>
    {selectedRecyclerId && <><div className="checkbox-grid">{materials?.map((material) => <label className="check-option" key={material.id}><input type="checkbox" checked={selectedMaterialIds.includes(material.id)} onChange={(event) => setSelectedMaterialIds((ids) => event.target.checked ? [...ids, material.id] : ids.filter((id) => id !== material.id))} /><span>{material.name}</span></label>)}</div><button className="button button-primary" type="button" onClick={saveRecyclerMaterials} disabled={savingMaterials}>{savingMaterials ? 'Saving…' : 'Save supported materials'}</button></>}
  </Panel></div>
}

export function AdminMaterialsPage() {
  const { data: materials, loading, error, setData } = useLoad(async () => {
    const { data, error: queryError } = await getClient().from('materials').select('*').order('name')
    if (queryError) throw queryError
    return data || []
  })
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function addMaterial(event) {
    event.preventDefault()
    setBusy(true)
    const { data, error: insertError } = await getClient().from('materials').insert({ name: name.trim(), description: description.trim() }).select('*').single()
    if (insertError) setMessage(insertError.code === '23505' ? 'A material with this name already exists.' : 'Material could not be added.')
    else { setData([...materials, data].sort((a, b) => a.name.localeCompare(b.name))); setName(''); setDescription(''); setMessage('Material added.') }
    setBusy(false)
  }
  async function toggleMaterial(material) {
    const { error: updateError } = await getClient().from('materials').update({ active: !material.active }).eq('id', material.id)
    setMessage(updateError ? 'Material status could not be changed.' : 'Material status updated.')
    if (!updateError) setData(materials.map((item) => item.id === material.id ? { ...item, active: !item.active } : item))
  }
  if (loading) return <LoadingState />
  if (error) return <ErrorState message="Materials couldn't be loaded." />
  return <div className="page-stack"><Panel className="table-panel"><PageHeading title="Material data" description="Active materials can be selected when a collector creates a lot." />
    <div className="data-table-wrap"><table><thead><tr><th>Material</th><th>Description</th><th>Created</th><th>Status</th><th /></tr></thead><tbody>{materials?.map((material) => <tr key={material.id}><td><strong>{material.name}</strong></td><td>{material.description || '—'}</td><td>{new Date(material.created_at).toLocaleDateString('en-IN')}</td><td><StatusBadge status={material.active ? 'active' : 'inactive'} /></td><td><button className="text-link table-button" type="button" onClick={() => toggleMaterial(material)}>{material.active ? 'Deactivate' : 'Activate'}</button></td></tr>)}</tbody></table></div>
  </Panel><Panel><PageHeading title="Add material" description="Keep categories simple and recognizable." />{message && <div className="alert alert-success">{message}</div>}<form className="admin-form" onSubmit={addMaterial}><label className="field"><span>Material name</span><input value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} /></label><label className="field"><span>Description</span><input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={160} /></label><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Add material'}</button></form></Panel></div>
}

export function AdminPricesPage() {
  const { data: rows, loading, error, setData } = useLoad(async () => {
    const { data, error: queryError } = await getClient().from('price_benchmarks').select('*,materials(name)').order('effective_date', { ascending: false })
    if (queryError) throw queryError
    return data || []
  })
  const { data: materials } = useLoad(async () => {
    const { data, error: queryError } = await getClient().from('materials').select('id,name').order('name')
    if (queryError) throw queryError
    return data || []
  })
  const [form, setForm] = useState({ materialId: '', minimum: '', maximum: '', unit: 'kg', location: 'Delhi NCR', effectiveDate: new Date().toISOString().slice(0, 10), source: '' })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  function update(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value })) }
  async function addBenchmark(event) {
    event.preventDefault()
    setBusy(true)
    const { data, error: insertError } = await getClient().from('price_benchmarks').insert({
      material_id: form.materialId, minimum_price: Number(form.minimum), maximum_price: Number(form.maximum),
      unit: form.unit, location: form.location, effective_date: form.effectiveDate, source: form.source.trim(), active: true,
    }).select('*,materials(name)').single()
    if (insertError) setMessage('Benchmark could not be saved. Check the price range and try again.')
    else { setData([data, ...(rows || [])]); setMessage('Indicative benchmark saved.'); setForm((current) => ({ ...current, minimum: '', maximum: '', source: '' })) }
    setBusy(false)
  }
  async function toggle(row) {
    const { error: updateError } = await getClient().from('price_benchmarks').update({ active: !row.active }).eq('id', row.id)
    setMessage(updateError ? 'Benchmark status could not be changed.' : 'Benchmark status updated.')
    if (!updateError) setData(rows.map((item) => item.id === row.id ? { ...item, active: !row.active } : item))
  }
  if (loading) return <LoadingState />
  if (error) return <ErrorState message="Benchmark data couldn't be loaded." />
  return <div className="page-stack"><Panel className="table-panel"><PageHeading title="Indicative price benchmarks" description="Rates inform estimates only. They are never guaranteed sale prices." />
    {rows?.length ? <div className="data-table-wrap"><table><thead><tr><th>Material</th><th>Indicative range</th><th>Area</th><th>Effective</th><th>Source</th><th>Status</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.materials?.name}</strong></td><td>{formatCurrency(row.minimum_price)} – {formatCurrency(row.maximum_price)} / {row.unit}</td><td>{row.location}</td><td>{new Date(row.effective_date).toLocaleDateString('en-IN')}</td><td>{row.source}</td><td><StatusBadge status={row.active ? 'active' : 'inactive'} /></td><td><button className="text-link table-button" type="button" onClick={() => toggle(row)}>{row.active ? 'Deactivate' : 'Activate'}</button></td></tr>)}</tbody></table></div> : <EmptyState title="No benchmark records">Add indicative benchmark data to enable lot estimates.</EmptyState>}
  </Panel><Panel><PageHeading title="Add indicative benchmark" /><form className="admin-form admin-form-benchmark" onSubmit={addBenchmark}>
    <label className="field"><span>Material</span><select name="materialId" value={form.materialId || materials?.[0]?.id || ''} onChange={update} required><option value="" disabled>Select material</option>{materials?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className="field"><span>Minimum price / kg</span><input name="minimum" type="number" min="0" step="0.01" value={form.minimum} onChange={update} required /></label>
    <label className="field"><span>Maximum price / kg</span><input name="maximum" type="number" min="0" step="0.01" value={form.maximum} onChange={update} required /></label>
    <label className="field"><span>Unit</span><select name="unit" value={form.unit} onChange={update}><option value="kg">kg</option></select></label>
    <label className="field"><span>Location</span><input name="location" value={form.location} onChange={update} required /></label>
    <label className="field"><span>Effective date</span><input name="effectiveDate" type="date" value={form.effectiveDate} onChange={update} required /></label>
    <label className="field field-wide"><span>Source</span><input name="source" value={form.source} onChange={update} placeholder="Identify the benchmark source" required /></label>
    <button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save benchmark'}</button>
  </form>{message && <div className="alert alert-success">{message}</div>}</Panel></div>
}

export function AdminLotsPage() {
  const { data: lots, loading, error } = useLoad(async () => {
    const { data, error: queryError } = await getClient().from('lots').select('*,materials(name),profiles!lots_collector_id_fkey(name)').order('created_at', { ascending: false })
    if (queryError) throw queryError
    return data || []
  })
  if (loading) return <LoadingState />
  if (error) return <ErrorState message="Lot records couldn't be loaded." />
  return <div className="page-stack"><Panel className="table-panel"><PageHeading title="Lots" description="Platform lot records and current status." />{lots?.length ? <div className="data-table-wrap"><table><thead><tr><th>Lot</th><th>Collector</th><th>Material</th><th>Weight</th><th>Status</th><th>Created</th></tr></thead><tbody>{lots.map((lot) => <tr key={lot.id}><td>{lot.reference_id}</td><td>{lot.profiles?.name || 'Collector'}</td><td>{lot.materials?.name}</td><td>{lot.approximate_weight} kg</td><td><StatusBadge status={lot.status} /></td><td>{new Date(lot.created_at).toLocaleDateString('en-IN')}</td></tr>)}</tbody></table></div> : <EmptyState title="No lots recorded" />}</Panel></div>
}

export function AdminOffersPage() {
  const { data: offers, loading, error } = useLoad(async () => {
    const { data, error: queryError } = await getClient().from('offers').select('*,lots(reference_id,materials(name)),recyclers(business_name)').order('created_at', { ascending: false })
    if (queryError) throw queryError
    return data || []
  })
  if (loading) return <LoadingState />
  if (error) return <ErrorState message="Offer records couldn't be loaded." />
  return <div className="page-stack"><Panel className="table-panel"><PageHeading title="Offers" description="Offers submitted by eligible recycler accounts." />{offers?.length ? <div className="data-table-wrap"><table><thead><tr><th>Lot</th><th>Material</th><th>Recycler</th><th>Offer</th><th>Status</th><th>Submitted</th></tr></thead><tbody>{offers.map((offer) => <tr key={offer.id}><td>{offer.lots?.reference_id}</td><td>{offer.lots?.materials?.name}</td><td>{offer.recyclers?.business_name}</td><td>{formatCurrency(offer.offer_value)}</td><td><StatusBadge status={offer.status} /></td><td>{new Date(offer.created_at).toLocaleDateString('en-IN')}</td></tr>)}</tbody></table></div> : <EmptyState title="No offers recorded" />}</Panel></div>
}

export function AdminTransactionsTable({ compact = false }) {
  const { data: rows, loading, error } = useLoad(getTransactionRows)
  if (loading) return <Panel><LoadingState /></Panel>
  if (error) return <Panel><ErrorState message="Transactions couldn't be loaded." /></Panel>
  const transactions = compact ? (rows || []).slice(0, 5) : rows || []
  return <Panel className="table-panel"><PageHeading title={compact ? 'Recent transactions' : 'Transactions'} description={!compact && 'Handover value and payment status recorded in ScrapSetu.'} />{transactions.length ? <div className="data-table-wrap"><table><thead><tr><th>Lot</th><th>Material</th><th>Recycler</th><th>Confirmed weight</th><th>Final value</th><th>Payment</th><th /></tr></thead><tbody>{transactions.map((row) => <tr key={row.id}><td>{row.lots?.reference_id}</td><td>{row.lots?.materials?.name}</td><td>{row.handovers?.offers?.recyclers?.business_name}</td><td>{row.handovers?.confirmed_weight} kg</td><td>{formatCurrency(row.amount)}</td><td><StatusBadge status={row.status} /></td><td><Link className="text-link" to={`/admin/traceability?lot=${row.lot_id}`}>Trace</Link></td></tr>)}</tbody></table></div> : <EmptyState title="No transactions recorded">Confirmed handovers will appear here.</EmptyState>}</Panel>
}

export function AdminTransactionsPage() { return <div className="page-stack"><AdminTransactionsTable /></div> }

export function AdminTraceabilityPage() {
  const { data: events, loading, error } = useLoad(async () => {
    const { data, error: queryError } = await getClient().from('traceability_events').select('*,lots(reference_id,materials(name))').order('timestamp', { ascending: false }).limit(100)
    if (queryError) throw queryError
    return data || []
  })
  if (loading) return <LoadingState />
  if (error) return <ErrorState message="Traceability records couldn't be loaded." />
  const grouped = new Map()
  for (const event of events || []) grouped.set(event.lot_id, [...(grouped.get(event.lot_id) || []), event])
  return <div className="page-stack"><PageHeading title="Lot traceability" description="Database-recorded lifecycle events. No blockchain is used." />{grouped.size ? [...grouped.entries()].map(([lotId, lotEvents]) => <Panel key={lotId}><div className="lot-title-row"><div><span className="eyebrow">{lotEvents[0].lots?.reference_id}</span><h2>{lotEvents[0].lots?.materials?.name}</h2></div><span className="badge badge-neutral">{lotEvents.length} events</span></div><TraceTimeline events={lotEvents.slice().reverse()} /></Panel>) : <Panel><EmptyState title="No events recorded" /></Panel>}</div>
}