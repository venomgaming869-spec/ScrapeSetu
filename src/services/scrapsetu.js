import { supabase } from '../lib/supabase'
import { listQueuedLots, removeQueuedLot, updateQueuedLot } from '../offline/lotQueue'

const activeSyncs = new Map()

export function getClient() {
  if (!supabase) throw new Error('ScrapSetu is not connected to its database yet.')
  return supabase
}

export async function getMaterials() {
  const { data, error } = await getClient().from('materials').select('*').eq('active', true).order('name')
  throwSupabaseError('Load active materials', error)
  return data || []
}

function throwSupabaseError(operation, error) {
  if (!error) return
  console.error(`[ScrapSetu] ${operation} failed`, {
    error,
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code,
  })
  throw new Error(error.message || `${operation} failed`, { cause: error })
}

async function getCollectorIdentity(expectedUserId) {
  const client = getClient()
  const { data: authData, error: authError } = await client.auth.getUser()
  throwSupabaseError('Read authenticated user', authError)
  const user = authData?.user
  if (!user) throw new Error('No authenticated Supabase user is available.')
  if (expectedUserId && expectedUserId !== user.id) {
    throw new Error('The signed-in user changed before the lot could be saved. Refresh and try again.')
  }
  const { data: profile, error: profileError } = await client.from('profiles')
    .select('id,role').eq('id', user.id).single()
  throwSupabaseError('Read Collector profile', profileError)
  if (profile.id !== user.id || profile.role !== 'collector') {
    throw new Error('The signed-in account does not have a Collector profile.')
  }
  return { user, profile }
}

export async function getOwnLots() {
  const { profile } = await getCollectorIdentity()
  const client = getClient()
  const { data: lots, error: lotsError } = await client.from('lots')
    .select('*,materials(name)').eq('collector_id', profile.id)
    .order('created_at', { ascending: false })
  throwSupabaseError('Load Collector lots', lotsError)
  if (!lots?.length) return []

  const lotIds = lots.map((lot) => lot.id)
  const { data: offers, error: offersError } = await client.from('offers')
    .select('id,lot_id,recycler_id,offer_value,status,created_at').in('lot_id', lotIds)
    .order('created_at', { ascending: false })
  throwSupabaseError('Load offers for Collector lots', offersError)
  const recyclerIds = [...new Set((offers || []).map((offer) => offer.recycler_id))]
  let recyclers = []
  if (recyclerIds.length) {
    const { data, error: recyclerError } = await client.from('recyclers')
      .select('id,business_name,authorization_status,location,service_area,active')
      .in('id', recyclerIds)
    throwSupabaseError('Load recyclers for Collector offers', recyclerError)
    recyclers = data || []
  }
  const recyclerById = new Map(recyclers.map((recycler) => [recycler.id, recycler]))
  const offersByLot = new Map()
  for (const offer of offers || []) {
    const list = offersByLot.get(offer.lot_id) || []
    list.push({ ...offer, recyclers: recyclerById.get(offer.recycler_id) || null })
    offersByLot.set(offer.lot_id, list)
  }
  return lots.map((lot) => ({ ...lot, offers: offersByLot.get(lot.id) || [] }))
}

export async function getCollectorTransactions(ownedLots) {
  const lots = ownedLots || await getOwnLots()
  if (!lots.length) return []
  const client = getClient()
  const lotsById = new Map(lots.map((lot) => [lot.id, lot]))
  const { data: payments, error: paymentsError } = await client.from('payments')
    .select('*').in('lot_id', lots.map((lot) => lot.id)).order('created_at', { ascending: false })
  throwSupabaseError('Load Collector payments', paymentsError)
  if (!payments?.length) return []

  const handoverIds = [...new Set(payments.map((payment) => payment.handover_id))]
  const { data: handovers, error: handoversError } = await client.from('handovers')
    .select('*').in('id', handoverIds)
  throwSupabaseError('Load Collector handovers', handoversError)
  const handoverById = new Map((handovers || []).map((handover) => [handover.id, handover]))
  const offerIds = [...new Set((handovers || []).map((handover) => handover.offer_id))]
  let offers = []
  if (offerIds.length) {
    const { data, error: offersError } = await client.from('offers')
      .select('id,recycler_id,offer_value,status').in('id', offerIds)
    throwSupabaseError('Load accepted offers for Collector payments', offersError)
    offers = data || []
  }
  const offerById = new Map(offers.map((offer) => [offer.id, offer]))
  const recyclerIds = [...new Set(offers.map((offer) => offer.recycler_id))]
  let recyclers = []
  if (recyclerIds.length) {
    const { data, error: recyclersError } = await client.from('recyclers')
      .select('id,business_name').in('id', recyclerIds)
    throwSupabaseError('Load recyclers for Collector payments', recyclersError)
    recyclers = data || []
  }
  const recyclerById = new Map(recyclers.map((recycler) => [recycler.id, recycler]))
  return payments.map((payment) => {
    const handover = handoverById.get(payment.handover_id)
    const offer = handover && offerById.get(handover.offer_id)
    return {
      ...payment,
      lots: lotsById.get(payment.lot_id) || null,
      handovers: handover ? {
        ...handover,
        offers: offer ? { ...offer, recyclers: recyclerById.get(offer.recycler_id) || null } : null,
      } : null,
    }
  })
}

export async function getCollectorTransaction(paymentId) {
  const transactions = await getCollectorTransactions()
  return transactions.find((transaction) => transaction.id === paymentId) || null
}

export async function getLot(lotId) {
  const lots = await getOwnLots()
  const lot = lots.find((item) => item.id === lotId)
  if (!lot) throw new Error('This lot was not found in the signed-in Collector account.')
  const { data: material, error } = await getClient().from('materials')
    .select('name,description').eq('id', lot.material_id).maybeSingle()
  throwSupabaseError('Load material for Collector lot', error)
  return { ...lot, materials: material }
}

export async function getBenchmark(materialId, location = '') {
  const { data, error } = await getClient().from('price_benchmarks')
    .select('minimum_price,maximum_price,unit,location,effective_date,source')
    .eq('material_id', materialId).eq('active', true).order('effective_date', { ascending: false }).limit(20)
  throwSupabaseError('Load active price benchmark', error)
  const rows = data || []
  const normalizedLocation = (location || '').trim().toLowerCase()
  return rows.find((row) => row.location.toLowerCase() === normalizedLocation)
    || rows.find((row) => normalizedLocation && row.location.toLowerCase().includes(normalizedLocation))
    || rows.find((row) => row.location.toLowerCase() === 'all locations')
    || (normalizedLocation ? null : rows[0] || null)
}

export async function getSuitableRecyclers(materialId, location = '') {
  const client = getClient()
  const { data: compatible, error: compatibilityError } = await client.from('recycler_materials')
    .select('recycler_id').eq('material_id', materialId)
  throwSupabaseError('Find recyclers compatible with material', compatibilityError)
  const recyclerIds = [...new Set((compatible || []).map((row) => row.recycler_id))]
  if (!recyclerIds.length) return []
  const { data, error } = await client.from('recyclers')
    .select('id,business_name,location,service_area,authorization_status,active')
    .in('id', recyclerIds).eq('active', true).eq('authorization_status', 'verified')
  throwSupabaseError('Load verified compatible recyclers', error)
  const normalizedLocation = (location || '').trim().toLowerCase()
  return (data || [])
    .filter((recycler) => {
      if (!normalizedLocation) return true
      const area = (recycler.service_area || '').toLowerCase()
      return area.includes('all') || area.includes(normalizedLocation)
    })
}

export async function recordLotEvent(lotId, eventType, metadata = {}) {
  const { error } = await getClient().rpc('record_lot_event', { p_lot_id: lotId, p_event_type: eventType, p_metadata: metadata })
  throwSupabaseError(`Record ${eventType} traceability event`, error)
}

async function performSyncPendingLots(userId) {
  const client = getClient()
  const { user, profile } = await getCollectorIdentity(userId)
  const pending = await listQueuedLots(userId)
  const results = []
  for (const item of pending) {
    if (item.status === 'synced') continue
    try {
      await updateQueuedLot({ ...item, status: 'syncing', retryCount: (item.retryCount || 0) + 1 })
      let photoPath = null
      if (item.photo) {
        const extension = item.photo.type?.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'
        photoPath = `${userId}/${item.localId}.${extension}`
        const { data: uploadedPhoto, error: uploadError } = await client.storage.from('e-waste-images').upload(photoPath, item.photo, { upsert: true, contentType: item.photo.type })
        throwSupabaseError('Upload lot photo', uploadError)
        if (!uploadedPhoto?.path) throw new Error('Photo upload returned no storage path.')
      }
      const payload = {
        offline_id: item.localId,
        collector_id: profile.id,
        material_id: item.materialId,
        service_location: item.serviceLocation || null,
        approximate_weight: item.weight,
        description: item.description || '',
        photo_url: photoPath,
        latitude: item.latitude,
        longitude: item.longitude,
        status: 'available',
      }
      const { data: lot, error: lotError } = await client.from('lots')
        .upsert(payload, { onConflict: 'offline_id' })
        .select('id,reference_id,collector_id,material_id,approximate_weight,photo_url,status').single()
      throwSupabaseError('Create or retry Collector lot', lotError)
      if (lot.collector_id !== user.id) throw new Error('The saved lot is not owned by the current Collector.')
      const [benchmark, recyclers] = await Promise.all([
        getBenchmark(lot.material_id, item.serviceLocation),
        getSuitableRecyclers(lot.material_id, item.serviceLocation),
      ])
      if (benchmark) await recordLotEvent(lot.id, 'BENCHMARK_GENERATED', { source: benchmark.source, location: benchmark.location })
      if (recyclers.length) await recordLotEvent(lot.id, 'RECYCLER_MATCHED', { recycler_count: recyclers.length })
      await updateQueuedLot({ ...item, status: 'synced', referenceId: lot.reference_id, photoPath, syncedAt: new Date().toISOString() })
      await removeQueuedLot(item.localId)
      results.push({ localId: item.localId, success: true, lot })
    } catch (error) {
      console.error('[ScrapSetu] Sync Collector lot failed', {
        localId: item.localId,
        error,
        message: error.message,
        details: error.details || error.cause?.details,
        hint: error.hint || error.cause?.hint,
        code: error.code || error.cause?.code,
      })
      await updateQueuedLot({ ...item, status: 'sync_failed', lastError: error.message || 'Sync failed', retryCount: (item.retryCount || 0) + 1 })
      results.push({ localId: item.localId, success: false })
    }
  }
  return results
}

export function syncPendingLots(userId) {
  const active = activeSyncs.get(userId)
  if (active) return active.then(() => syncPendingLots(userId))

  const task = performSyncPendingLots(userId)
  const tracked = task.finally(() => {
    if (activeSyncs.get(userId) === tracked) activeSyncs.delete(userId)
  })
  activeSyncs.set(userId, tracked)
  return tracked
}

export async function getIncomingLots() {
  const { data, error } = await getClient().from('lots')
    .select('*, materials(name), profiles!lots_collector_id_fkey(name)')
    .in('status', ['available', 'matching', 'offers_received']).order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getRecyclerOffers() {
  const { data, error } = await getClient().from('offers')
    .select('*, lots(reference_id,approximate_weight,status,materials(name),profiles!lots_collector_id_fkey(name))')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getTransactionRows() {
  const { data, error } = await getClient().from('payments')
    .select('*, lots(reference_id,approximate_weight,collector_id,materials(name)), handovers(confirmed_weight,final_value,handover_timestamp,latitude,longitude,offers(recyclers(business_name)))')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getTraceability(lotId) {
  const { data, error } = await getClient().from('traceability_events').select('*').eq('lot_id', lotId).order('timestamp')
  throwSupabaseError('Load lot traceability events', error)
  return data || []
}

export async function getSignedPhoto(photoPath) {
  if (!photoPath) return null
  const { data, error } = await getClient().storage.from('e-waste-images').createSignedUrl(photoPath, 900)
  if (error) {
    console.error('[ScrapSetu] Sign lot photo URL failed', {
      error,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    })
    return null
  }
  return data.signedUrl
}