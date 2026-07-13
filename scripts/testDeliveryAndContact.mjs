const API_BASE_URL = process.env.TEST_API_BASE_URL || 'http://localhost:5000/api/v1'
const PROVIDER_EMAIL = process.env.TEST_PROVIDER_EMAIL || 'pradeepawanniarachchi2001@gmail.com'
const PROVIDER_PASSWORD = process.env.TEST_PROVIDER_PASSWORD || 'NewPass123!'
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@local.test'
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'Admin12345!'

const results = []

function addResult(test, ok, details) {
  results.push({ test, ok, details })
}

async function request(path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  return { response, payload }
}

async function runTest(name, fn) {
  try {
    const details = await fn()
    addResult(name, true, details)
    console.log(`PASS ${name} :: ${details}`)
  } catch (error) {
    const message = error?.message || String(error)
    addResult(name, false, message)
    console.log(`FAIL ${name} :: ${message}`)
  }
}

let providerToken = ''
let adminToken = ''
let selectedDeliveryId = ''

await runTest('contact-success', async () => {
  const { response, payload } = await request('/support/contact', {
    method: 'POST',
    body: {
      name: 'QA Bot',
      email: 'qa.delivery@example.com',
      subject: 'general',
      message: 'Automated contact verification',
    },
  })

  if (!response.ok) throw new Error(`Expected 2xx, got ${response.status}`)
  if (!payload?.inquiry?.id) throw new Error('Missing inquiry id in response')
  return `inquiryId=${payload.inquiry.id}`
})

await runTest('contact-invalid-subject', async () => {
  const { response, payload } = await request('/support/contact', {
    method: 'POST',
    body: {
      name: 'QA Bot',
      email: 'qa.delivery@example.com',
      subject: 'not-valid',
      message: 'x',
    },
  })

  if (response.status !== 400) {
    throw new Error(`Expected 400, got ${response.status}`)
  }

  if (!String(payload?.message || '').toLowerCase().includes('valid subject')) {
    throw new Error('Expected valid subject validation message')
  }
  return 'received expected 400 validation'
})

await runTest('login-provider', async () => {
  const { response, payload } = await request('/auth/login', {
    method: 'POST',
    body: { email: PROVIDER_EMAIL, password: PROVIDER_PASSWORD },
  })

  if (!response.ok) throw new Error(`Provider login failed (${response.status})`)
  if (!payload?.token) throw new Error('Provider token missing')
  providerToken = payload.token
  return `role=${payload?.user?.role || 'unknown'}`
})

await runTest('login-admin', async () => {
  const { response, payload } = await request('/auth/login', {
    method: 'POST',
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  })

  if (!response.ok) throw new Error(`Admin login failed (${response.status})`)
  if (!payload?.token) throw new Error('Admin token missing')
  adminToken = payload.token
  return `role=${payload?.user?.role || 'unknown'}`
})

await runTest('delivery-dashboard', async () => {
  const { response, payload } = await request('/delivery/dashboard', { token: providerToken })
  if (!response.ok) throw new Error(`Dashboard failed (${response.status})`)
  if (!payload?.stats) throw new Error('Missing stats payload')
  return `pending=${payload.stats.pending}, active=${payload.stats.active}`
})

await runTest('delivery-assigned', async () => {
  const { response, payload } = await request('/delivery/assigned?page=1&limit=20', { token: providerToken })
  if (!response.ok) throw new Error(`Assigned failed (${response.status})`)
  if (payload?.meta?.total == null) throw new Error('Missing meta.total')
  if (Array.isArray(payload.data) && payload.data.length > 0) selectedDeliveryId = payload.data[0].id
  return `total=${payload.meta.total}`
})

await runTest('delivery-pool', async () => {
  const { response, payload } = await request('/delivery/pool?page=1&limit=20', { token: providerToken })
  if (!response.ok) throw new Error(`Pool failed (${response.status})`)
  if (payload?.meta?.total == null) throw new Error('Missing meta.total')
  if (!selectedDeliveryId && Array.isArray(payload.data) && payload.data.length > 0) {
    selectedDeliveryId = payload.data[0].id
  }
  return `total=${payload.meta.total}`
})

await runTest('delivery-earnings', async () => {
  const { response, payload } = await request('/delivery/earnings?days=30', { token: providerToken })
  if (!response.ok) throw new Error(`Earnings failed (${response.status})`)
  if (payload?.totalEarnings == null) throw new Error('Missing totalEarnings')
  return `earnings=${payload.totalEarnings}`
})

await runTest('delivery-analytics', async () => {
  const { response, payload } = await request('/delivery/analytics?days=30', { token: providerToken })
  if (!response.ok) throw new Error(`Analytics failed (${response.status})`)
  if (payload?.successRate == null) throw new Error('Missing successRate')
  return `successRate=${payload.successRate}`
})

await runTest('delivery-settings-get', async () => {
  const { response, payload } = await request('/delivery/settings', { token: providerToken })
  if (!response.ok) throw new Error(`Settings GET failed (${response.status})`)
  if (!Array.isArray(payload?.coverageAreas)) throw new Error('Missing coverageAreas array')
  return `coverageAreas=${payload.coverageAreas.length}`
})

await runTest('delivery-settings-update', async () => {
  const { response, payload } = await request('/delivery/settings', {
    method: 'PUT',
    token: providerToken,
    body: {
      coverageAreas: ['Colombo', 'Gampaha'],
      pricingModel: 'distance',
      baseFee: 365,
      perKmFee: 56,
      freeThreshold: 11111,
      flatFee: 481,
    },
  })

  if (!response.ok) throw new Error(`Settings PUT failed (${response.status})`)
  if (payload?.baseFee !== 365) throw new Error('Updated baseFee not reflected')
  return `baseFee=${payload.baseFee}`
})

await runTest('delivery-drivers-list', async () => {
  const { response, payload } = await request('/delivery/drivers', { token: providerToken })
  if (!response.ok) throw new Error(`Drivers list failed (${response.status})`)
  if (!Array.isArray(payload)) throw new Error('Drivers response is not an array')
  return `drivers=${payload.length}`
})

await runTest('delivery-notifications-list', async () => {
  const { response, payload } = await request('/delivery/notifications?limit=10', { token: providerToken })
  if (!response.ok) throw new Error(`Notifications list failed (${response.status})`)
  if (payload?.meta?.total == null) throw new Error('Missing notifications meta.total')
  return `total=${payload.meta.total}`
})

await runTest('delivery-notifications-read-all', async () => {
  const { response, payload } = await request('/delivery/notifications/read-all', {
    method: 'PUT',
    token: providerToken,
  })
  if (!response.ok) throw new Error(`Read-all failed (${response.status})`)
  if (!payload?.message) throw new Error('Read-all message missing')
  return payload.message
})

await runTest('delivery-detail-live', async () => {
  if (!selectedDeliveryId) throw new Error('No delivery id available for detail/live checks')

  const detail = await request(`/delivery/deliveries/${selectedDeliveryId}`, { token: providerToken })
  if (!detail.response.ok) throw new Error(`Delivery detail failed (${detail.response.status})`)
  if (!detail.payload?.trackingCode) throw new Error('Detail missing trackingCode')

  const live = await request(`/delivery/deliveries/${selectedDeliveryId}/live`, { token: providerToken })
  if (!live.response.ok) throw new Error(`Delivery live failed (${live.response.status})`)
  if (!Array.isArray(live.payload?.timeline)) throw new Error('Live payload missing timeline')

  return `status=${detail.payload.status}, timeline=${live.payload.timeline.length}`
})

await runTest('admin-delivery-providers-list', async () => {
  const { response, payload } = await request('/admin/delivery-providers?limit=20', { token: adminToken })
  if (!response.ok) throw new Error(`Admin provider list failed (${response.status})`)
  if (payload?.meta?.total == null) throw new Error('Missing admin provider meta.total')
  return `total=${payload.meta.total}`
})

await runTest('provider-forbidden-admin', async () => {
  const { response } = await request('/admin/delivery-providers?limit=1', { token: providerToken })
  if (response.status !== 403) {
    throw new Error(`Expected 403 for provider on admin endpoint, got ${response.status}`)
  }
  return 'received expected 403'
})

const pass = results.filter((r) => r.ok).length
const fail = results.filter((r) => !r.ok).length

console.log(`SUMMARY PASS=${pass} FAIL=${fail}`)
if (fail > 0) {
  console.log(JSON.stringify(results.filter((r) => !r.ok), null, 2))
  process.exit(2)
}
