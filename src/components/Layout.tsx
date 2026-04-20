
import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Layout as LayoutIcon, FileText, Settings, Menu, X, Store, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const location = useLocation();

  const navItems = [
    { name: 'ตรวจสอบร้านค้า', path: '/', icon: Store },
    { name: 'เกณฑ์การตรวจสอบ', path: '/guidelines', icon: FileText },
    { name: 'สถิติการใช้งาน AI', path: '/tokens', icon: Zap },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-1.5 rounded-lg">
            <LayoutIcon className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-slate-900">StoreAuditor</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
          {isSidebarOpen ? <X /> : <Menu />}
        </Button>
      </header>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-full flex flex-col">
          <div className="p-6 hidden md:flex items-center gap-3 border-b border-slate-50">
            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-100">
              <LayoutIcon className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl text-slate-900 tracking-tight">StoreAuditor</span>
          </div>

          <nav className="flex-1 p-4 space-y-1 mt-4">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group",
                    isActive 
                      ? "bg-indigo-50 text-indigo-700" 
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <item.icon className={cn(
                    "w-5 h-5 transition-colors",
                    isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
                  )} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}
