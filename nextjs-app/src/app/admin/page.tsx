'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Navigation from '@/components/Navigation';
import { Users, Shield, Store, UserCheck, UserX, Mail, Phone } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

interface Member {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  phone: string | null;
  role: 'member' | 'manager' | 'council' | 'technician';
  membership_active: boolean;
  membership_expires: string | null;
  approved: boolean;
  approved_at: string | null;
  created_at: string;
}

interface TrustedUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  role: string;
  notes: string | null;
  added_at: string;
}

interface Branch {
  id: string;
  name: string;
  location: string | null;
  discount_percentage: number;
  active: boolean;
  created_at: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'members' | 'trusted' | 'codes' | 'partners'>('members');
  
  // Members state
  const [members, setMembers] = useState<Member[]>([]);
  const [pendingMembers, setPendingMembers] = useState<Member[]>([]);
  
  // Trusted users state
  const [trustedUsers, setTrustedUsers] = useState<TrustedUser[]>([]);
  const [newTrusted, setNewTrusted] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    role: 'member',
    notes: ''
  });
  
  // Branches state
  const [branches, setBranches] = useState<Branch[]>([]);
  const [newBranch, setNewBranch] = useState({
    name: '',
    location: '',
    discount_percentage: 10
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadMembers = useCallback(async () => {
    const { data } = await supabase
      .from('members')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      setMembers(data.filter(m => m.approved));
      setPendingMembers(data.filter(m => !m.approved));
    }
  }, []);

  const loadTrustedUsers = useCallback(async () => {
    const { data } = await supabase
      .from('trusted_users')
      .select('*')
      .order('added_at', { ascending: false });

    if (data) setTrustedUsers(data);
  }, []);

  const loadBranches = useCallback(async () => {
    const { data } = await supabase
      .from('branches')
      .select('*')
      .order('name');

    if (data) setBranches(data);
  }, []);

  const checkAuth = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return;
    }

    setCurrentUser(user);

    // Check if user is admin (council or @psychočas.cz manager)
    const { data: memberData } = await supabase
      .from('members')
      .select('role, email')
      .eq('user_id', user.id)
      .single();

    if (!memberData) {
      router.push('/home');
      return;
    }

    const isAdmin = memberData.role === 'council' || 
                   (memberData.role === 'manager' && memberData.email.endsWith('@psychocas.cz'));

    if (!isAdmin) {
      router.push('/home');
      return;
    }

    setUserRole(memberData.role);
    setIsLoading(false);

    // Load data
    loadMembers();
    loadTrustedUsers();
    loadBranches();
  }, [loadBranches, loadMembers, loadTrustedUsers, router]);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  const approveMember = async (memberId: string) => {
    if (!currentUser) {
      setMessage({ type: 'error', text: 'Uživatel není přihlášen.' });
      return;
    }

    const { error } = await supabase.rpc('approve_member', {
      member_user_id: memberId,
      approver_user_id: currentUser.id
    });

    if (error) {
      setMessage({ type: 'error', text: `Chyba schvalování: ${error.message}` });
    } else {
      setMessage({ type: 'success', text: 'Člen byl schválen!' });
      loadMembers();
    }
  };

  const addTrustedUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser) {
      setMessage({ type: 'error', text: 'Uživatel není přihlášen.' });
      return;
    }

    const { error } = await supabase
      .from('trusted_users')
      .insert([{
        ...newTrusted,
        added_by: currentUser.id
      }]);

    if (error) {
      setMessage({ type: 'error', text: `Chyba: ${error.message}` });
    } else {
      setMessage({ type: 'success', text: 'Trusted user přidán!' });
      setNewTrusted({ email: '', first_name: '', last_name: '', phone: '', role: 'member', notes: '' });
      loadTrustedUsers();
    }
  };

  const deleteTrustedUser = async (id: string) => {
    if (!confirm('Opravdu smazat trusted user?')) return;

    const { error } = await supabase
      .from('trusted_users')
      .delete()
      .eq('id', id);

    if (error) {
      setMessage({ type: 'error', text: `Chyba: ${error.message}` });
    } else {
      setMessage({ type: 'success', text: 'Trusted user smazán!' });
      loadTrustedUsers();
    }
  };

  const addBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { error } = await supabase
      .from('branches')
      .insert([{
        ...newBranch,
        active: true
      }]);

    if (error) {
      setMessage({ type: 'error', text: `Chyba: ${error.message}` });
    } else {
      setMessage({ type: 'success', text: 'Pobočka přidána!' });
      setNewBranch({ name: '', location: '', discount_percentage: 10 });
      loadBranches();
    }
  };

  const toggleBranchActive = async (id: string, currentActive: boolean) => {
    const { error } = await supabase
      .from('branches')
      .update({ active: !currentActive })
      .eq('id', id);

    if (error) {
      setMessage({ type: 'error', text: `Chyba: ${error.message}` });
    } else {
      setMessage({ type: 'success', text: 'Status pobočky změněn!' });
      loadBranches();
    }
  };

  if (isLoading) {
    return (
      <main className="psychocas-section flex items-center justify-center">
        <div className="psychocas-loading">
          <div className="spinner"></div>
          <p>Načítání...</p>
        </div>
      </main>
    );
  }

  return (
    <>
      <Navigation userRole={userRole as 'member' | 'manager' | 'council' | 'technician'} />
      <main className="psychocas-section">
        <div className="psychocas-container fade-in-up">
          <div className="mb-8">
            <h1 className="mb-2">Administrace</h1>
            <p className="text-lg" style={{ color: '#666666' }}>
              Správa členů, trusted users a partnerských podniků
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mb-8 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('members')}
              className={`pb-4 px-2 font-medium transition-colors ${
                activeTab === 'members'
                  ? 'text-[#1d4f7d] border-b-2 border-[#1d4f7d]'
                  : 'text-gray-500 hover:text-[#1d4f7d]'
              }`}
            >
              <Users className="inline-block mr-2 h-5 w-5" />
              Členové ({pendingMembers.length} čeká)
            </button>
            <button
              onClick={() => setActiveTab('trusted')}
              className={`pb-4 px-2 font-medium transition-colors ${
                activeTab === 'trusted'
                  ? 'text-[#1d4f7d] border-b-2 border-[#1d4f7d]'
                  : 'text-gray-500 hover:text-[#1d4f7d]'
              }`}
            >
              <Shield className="inline-block mr-2 h-5 w-5" />
              Trusted Users
            </button>
            <button
              onClick={() => setActiveTab('partners')}
              className={`pb-4 px-2 font-medium transition-colors ${
                activeTab === 'partners'
                  ? 'text-[#1d4f7d] border-b-2 border-[#1d4f7d]'
                  : 'text-gray-500 hover:text-[#1d4f7d]'
              }`}
            >
              <Store className="inline-block mr-2 h-5 w-5" />
              Partnerské podniky
            </button>
          </div>

          {/* Message */}
          {message && (
            <div className={`mb-6 p-4 rounded-lg ${
              message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              {message.text}
            </div>
          )}

          {/* Members Tab */}
          {activeTab === 'members' && (
            <div className="space-y-8">
              {/* Pending Members */}
              {pendingMembers.length > 0 && (
                <div className="psychocas-card">
                  <h2 className="mb-4 flex items-center">
                    <UserX className="mr-2 h-6 w-6" />
                    Čekající na schválení ({pendingMembers.length})
                  </h2>
                  <div className="space-y-3">
                    {pendingMembers.map((member) => (
                      <div key={member.user_id} className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
                        <div>
                          <p className="font-medium">{member.full_name || 'Bez jména'}</p>
                          <p className="text-sm text-gray-600 flex items-center mt-1">
                            <Mail className="h-4 w-4 mr-1" />
                            {member.email}
                          </p>
                          {member.phone && (
                            <p className="text-sm text-gray-600 flex items-center mt-1">
                              <Phone className="h-4 w-4 mr-1" />
                              {member.phone}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            Registrován: {new Date(member.created_at).toLocaleDateString('cs-CZ')}
                          </p>
                        </div>
                        <button
                          onClick={() => approveMember(member.user_id)}
                          className="psychocas-button"
                        >
                          <UserCheck className="h-4 w-4 mr-2" />
                          Schválit
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Approved Members */}
              <div className="psychocas-card">
                <h2 className="mb-4 flex items-center">
                  <Users className="mr-2 h-6 w-6" />
                  Schválení členové ({members.length})
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Jméno</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Email</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Role</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Členství</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Vyprší</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {members.map((member) => (
                        <tr key={member.user_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm">{member.full_name || 'Bez jména'}</td>
                          <td className="px-4 py-3 text-sm">{member.email}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              member.role === 'council' ? 'bg-purple-100 text-purple-800' :
                              member.role === 'manager' ? 'bg-blue-100 text-blue-800' :
                              member.role === 'technician' ? 'bg-green-100 text-green-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {member.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              member.membership_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {member.membership_active ? 'Aktivní' : 'Neaktivní'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {member.membership_expires 
                              ? new Date(member.membership_expires).toLocaleDateString('cs-CZ')
                              : 'N/A'
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Trusted Users Tab */}
          {activeTab === 'trusted' && (
            <div className="space-y-8">
              {/* Add New Trusted User */}
              <div className="psychocas-card">
                <h2 className="mb-4">Přidat Trusted User</h2>
                <form onSubmit={addTrustedUser} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="email"
                      placeholder="Email"
                      value={newTrusted.email}
                      onChange={(e) => setNewTrusted({...newTrusted, email: e.target.value})}
                      className="psychocas-input"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Jméno"
                      value={newTrusted.first_name}
                      onChange={(e) => setNewTrusted({...newTrusted, first_name: e.target.value})}
                      className="psychocas-input"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Příjmení"
                      value={newTrusted.last_name}
                      onChange={(e) => setNewTrusted({...newTrusted, last_name: e.target.value})}
                      className="psychocas-input"
                      required
                    />
                    <input
                      type="tel"
                      placeholder="Telefon (volitelné)"
                      value={newTrusted.phone}
                      onChange={(e) => setNewTrusted({...newTrusted, phone: e.target.value})}
                      className="psychocas-input"
                    />
                    <select
                      value={newTrusted.role}
                      onChange={(e) => setNewTrusted({...newTrusted, role: e.target.value})}
                      className="psychocas-input"
                    >
                      <option value="member">Člen</option>
                      <option value="manager">Manažer</option>
                      <option value="council">Rada</option>
                      <option value="technician">Technik</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Poznámka (volitelné)"
                      value={newTrusted.notes}
                      onChange={(e) => setNewTrusted({...newTrusted, notes: e.target.value})}
                      className="psychocas-input"
                    />
                  </div>
                  <button type="submit" className="psychocas-button">
                    <UserCheck className="h-4 w-4 mr-2" />
                    Přidat Trusted User
                  </button>
                </form>
              </div>

              {/* Trusted Users List */}
              <div className="psychocas-card">
                <h2 className="mb-4">Seznam Trusted Users ({trustedUsers.length})</h2>
                <div className="space-y-3">
                  {trustedUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                      <div>
                        <p className="font-medium">{user.first_name} {user.last_name}</p>
                        <p className="text-sm text-gray-600">{user.email}</p>
                        {user.phone && <p className="text-sm text-gray-600">{user.phone}</p>}
                        <div className="flex gap-2 mt-2">
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {user.role}
                          </span>
                          {user.notes && (
                            <span className="text-xs text-gray-500">{user.notes}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteTrustedUser(user.id)}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                      >
                        Smazat
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Partners Tab */}
          {activeTab === 'partners' && (
            <div className="space-y-8">
              {/* Add New Branch */}
              <div className="psychocas-card">
                <h2 className="mb-4">Přidat Partnerský podnik</h2>
                <form onSubmit={addBranch} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input
                      type="text"
                      placeholder="Název podniku"
                      value={newBranch.name}
                      onChange={(e) => setNewBranch({...newBranch, name: e.target.value})}
                      className="psychocas-input"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Lokalita (volitelné)"
                      value={newBranch.location}
                      onChange={(e) => setNewBranch({...newBranch, location: e.target.value})}
                      className="psychocas-input"
                    />
                    <input
                      type="number"
                      placeholder="Sleva %"
                      value={newBranch.discount_percentage}
                      onChange={(e) => setNewBranch({...newBranch, discount_percentage: parseInt(e.target.value)})}
                      className="psychocas-input"
                      min="0"
                      max="100"
                      required
                    />
                  </div>
                  <button type="submit" className="psychocas-button">
                    <Store className="h-4 w-4 mr-2" />
                    Přidat pobočku
                  </button>
                </form>
              </div>

              {/* Branches List */}
              <div className="psychocas-card">
                <h2 className="mb-4">Partnerské podniky ({branches.length})</h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Název</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Lokalita</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Sleva</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Akce</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {branches.map((branch) => (
                        <tr key={branch.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium">{branch.name}</td>
                          <td className="px-4 py-3 text-sm">{branch.location || 'N/A'}</td>
                          <td className="px-4 py-3 text-sm">{branch.discount_percentage}%</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              branch.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {branch.active ? 'Aktivní' : 'Neaktivní'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <button
                              onClick={() => toggleBranchActive(branch.id, branch.active)}
                              className="text-[#1d4f7d] hover:underline"
                            >
                              {branch.active ? 'Deaktivovat' : 'Aktivovat'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
