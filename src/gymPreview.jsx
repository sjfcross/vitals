// DEV-ONLY entry for gym-preview.html: renders the real Layout + Gym tab against the mock
// data layer, without the auth gate. Forces mock mode even if .env.local has credentials.
import './index.css'

window.__VITALS_GYM_MOCK__ = true

// Dynamic imports so the flag above is set before gymApi evaluates GYM_MOCK.
Promise.all([
  import('react'),
  import('react-dom/client'),
  import('dayjs'),
  import('./components/Layout'),
  import('./tabs/Gym'),
  import('./lib/gymMock'),
]).then(([React, { createRoot }, { default: dayjs }, { Layout }, { Gym }, { mockWeightEntries }]) => {
  const { useState, StrictMode, createElement: h } = React
  const today = dayjs().format('YYYY-MM-DD')
  const weights = mockWeightEntries(Date.now())

  function Preview() {
    const [tab, setTab] = useState('gym')
    return h(Layout, { tab, setTab, date: today },
      tab === 'gym'
        ? h(Gym, { today, weightEntries: weights })
        : h('div', { className: 'mono', style: { padding: 40, textAlign: 'center', color: '#6b6f73', fontSize: '0.75rem' } }, 'Preview shows the Gym tab only'))
  }

  createRoot(document.getElementById('root')).render(h(StrictMode, null, h(Preview)))
})
