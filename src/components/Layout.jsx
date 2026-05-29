import { NavLink, Outlet } from 'react-router-dom'
import { Home, Dumbbell, Calendar, TrendingUp, Settings } from 'lucide-react'

const NAV = [
  { to: '/',         icon: Home,       label: 'Home',     end: true },
  { to: '/log',      icon: Dumbbell,   label: 'Log' },
  { to: '/plan',     icon: Calendar,   label: 'Plan' },
  { to: '/progress', icon: TrendingUp, label: 'Stats' },
  { to: '/settings', icon: Settings,   label: 'Settings' },
]

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0a12' }}>
      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-lg mx-auto px-4 py-6">
          <Outlet />
        </div>
      </main>

      <nav
        className="fixed bottom-0 inset-x-0 border-t"
        style={{ background: '#111118', borderColor: '#1e1e2a' }}
      >
        <div className="max-w-lg mx-auto flex">
          {NAV.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium tracking-wide transition-all duration-150 ${
                  isActive
                    ? 'text-[#22d3a0]'
                    : 'text-[#6b6b80] hover:text-[#a0a0b8]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`p-1.5 rounded-lg transition-all ${isActive ? 'bg-[#22d3a0]/10' : ''}`}>
                    <Icon size={19} />
                  </div>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
