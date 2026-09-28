const databaseName = 'scrapsetu-offline'
const storeName = 'lots'

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(storeName)) {
        const store = database.createObjectStore(storeName, { keyPath: 'localId' })
        store.createIndex('userId', 'userId')
        store.createIndex('status', 'status')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function runStore(mode, operation) {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode)
    const request = operation(transaction.objectStore(storeName))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => database.close()
    transaction.onerror = () => reject(transaction.error)
  })
}

export const makeLocalId = () => crypto.randomUUID()
export const saveQueuedLot = (lot) => runStore('readwrite', (store) => store.put(lot))
export const updateQueuedLot = (lot) => runStore('readwrite', (store) => store.put(lot))
export const removeQueuedLot = (localId) => runStore('readwrite', (store) => store.delete(localId))
export const getQueuedLot = (localId) => runStore('readonly', (store) => store.get(localId))

export async function listQueuedLots(userId) {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly')
    const request = transaction.objectStore(storeName).index('userId').getAll(userId)
    request.onsuccess = () => resolve(request.result.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => database.close()
  })
}