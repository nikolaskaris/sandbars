'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  userEmail?: string;
}

export default function Header({ userEmail }: HeaderProps) {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth');
    router.refresh();
  };

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="w-full px-6 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-blue-600">Sandbars</h1>
        <div className="flex items-center space-x-4">
          {userEmail && (
            <span className="text-sm text-gray-600">{userEmail}</span>
          )}
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
