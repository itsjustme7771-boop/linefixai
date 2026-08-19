import React, { useState } from 'react';
import { Wrench, Menu, X, QrCode, User as UserIcon, LogOut, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/contexts/AppContext';
import { toast } from '@/components/ui/sonner';

interface HeaderProps {
  onSignIn: () => void;
  onSignUp: () => void;
  onScan: () => void;
  onNav: (id: string) => void;
}

const Header: React.FC<HeaderProps> = ({ onSignIn, onSignUp, onScan, onNav }) => {
  const [open, setOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const { isAuthenticated, user, signOut, role } = useAppContext();

  const links = [
    { id: 'diagnostic', label: 'Diagnostic' },
    { id: 'equipment', label: 'Equipment' },
    { id: 'crossfix', label: 'Cross-Fix' },
    { id: 'pricing', label: 'Pricing' },
  ];

  const initials = (user?.name || user?.email || '?')
    .split(/[^a-zA-Z0-9]/)
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0]?.toUpperCase())
    .join('') || 'U';

  const handleSignOut = async () => {
    await signOut();
    setUserMenu(false);
    toast.success('Signed out');
  };


  return (
    <header className="sticky top-0 z-40 bg-[#0f1824]/95 backdrop-blur border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-md bg-gradient-to-br from-[#ff6b35] to-[#ff8f5c] flex items-center justify-center">
              <Wrench className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-white font-bold text-lg tracking-tight">MTTR<span className="text-[#00d4ff]">.ai</span></span>
              <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Diagnostic Engine</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            {links.map(l => (
              <button key={l.id} onClick={() => onNav(l.id)} className="text-slate-300 hover:text-white text-sm font-medium transition-colors">
                {l.label}
              </button>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onScan} className="text-slate-200 hover:text-white hover:bg-white/5">
              <QrCode className="w-4 h-4 mr-2" /> Scan
            </Button>

            {!isAuthenticated ? (
              <>
                <Button variant="ghost" size="sm" onClick={onSignIn} className="text-slate-200 hover:text-white hover:bg-white/5">
                  Sign In
                </Button>
                <Button size="sm" onClick={onSignUp} className="bg-[#ff6b35] hover:bg-[#ff8555] text-white font-semibold">
                  Get Started
                </Button>
              </>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setUserMenu(v => !v)}
                  onBlur={() => setTimeout(() => setUserMenu(false), 150)}
                  className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#ff6b35] flex items-center justify-center text-[11px] font-bold text-white">
                    {initials}
                  </div>
                  <div className="text-left leading-tight">
                    <div className="text-xs text-white font-medium max-w-[140px] truncate">{user?.name || user?.email}</div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-[#00d4ff]">{role}</div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>
                {userMenu && (
                  <div className="absolute right-0 mt-2 w-56 rounded-md bg-[#0f1824] border border-white/10 shadow-xl overflow-hidden">
                    <div className="px-3 py-2 border-b border-white/10">
                      <div className="text-xs text-slate-400">Signed in as</div>
                      <div className="text-sm text-white truncate">{user?.email}</div>
                    </div>
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { onNav('pricing'); setUserMenu(false); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-200 hover:bg-white/5"
                    >
                      <UserIcon className="w-4 h-4" /> Manage subscription
                    </button>
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleSignOut}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-white/5"
                    >
                      <LogOut className="w-4 h-4" /> Sign out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <button className="md:hidden text-white" onClick={() => setOpen(!open)}>
            {open ? <X /> : <Menu />}
          </button>
        </div>

        {open && (
          <div className="md:hidden py-4 border-t border-white/10 space-y-2">
            {links.map(l => (
              <button key={l.id} onClick={() => { onNav(l.id); setOpen(false); }} className="block w-full text-left text-slate-300 py-2">
                {l.label}
              </button>
            ))}
            {!isAuthenticated ? (
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={onSignIn} className="flex-1">Sign In</Button>
                <Button size="sm" onClick={onSignUp} className="flex-1 bg-[#ff6b35] hover:bg-[#ff8555]">Get Started</Button>
              </div>
            ) : (
              <div className="pt-2 space-y-2">
                <div className="text-xs text-slate-400">Signed in as <span className="text-white">{user?.email}</span></div>
                <Button size="sm" variant="outline" onClick={handleSignOut} className="w-full">
                  <LogOut className="w-4 h-4 mr-2" /> Sign out
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
