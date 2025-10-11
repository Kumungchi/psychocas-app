'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Navigation from '@/components/Navigation';
import { Users, Shield, Store, UserCheck, UserX, Mail, Phone, MapPin, Tag, Trash2, ToggleRight } from 'lucide-react';
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
  branch_id: string | null;
  branch?: { id: string; name: string; city?: string | null } | null;
  notes: string | null;
  added_at: string;
}

interface Branch {
  id: string;
  name: string;
  location: string | null;
  city?: string | null;
  discount_percentage: number;
  active: boolean;
  created_at: string;
}

type PartnerScope = 'national' | 'local';

interface PartnerOffer {
  id: string;
  title: string;
  description: string | null;
  discount_code: string | null;
  discount_percentage: number | null;
  scope: PartnerScope;
  branch_id: string | null;
  city: string | null;
  active: boolean;
  created_at: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [memberProfile, setMemberProfile] = useState<{ role: string; email: string; branch_id: string | null } | null>(null);
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
    branch_id: '',
    notes: ''
  });

  // Branches state
  const [branches, setBranches] = useState<Branch[]>([]);
  const [newBranch, setNewBranch] = useState({
    name: '',
    location: '',
    discount_percentage: 10
  });

  // Partner offers state
  const [partnerOffers, setPartnerOffers] = useState<PartnerOffer[]>([]);
  const [newOffer, setNewOffer] = useState({
    title: '',
    description: '',
    discountCode: '',
    discountPercentage: 10,
    scope: 'national' as PartnerScope,
    branchId: '',
    city: '',
  });
  const [isSavingOffer, setIsSavingOffer] = useState(false);
  
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
      .select('id, email, first_name, last_name, phone, role, branch_id, notes, added_at, branch:branch_id (id, name, city)')
      .order('added_at', { ascending: false });

    if (data) setTrustedUsers(data as TrustedUser[]);
  }, []);

  const loadBranches = useCallback(async () => {
    const { data } = await supabase
      .from('branches')
      .select('*')
      .order('name');

    if (data) setBranches(data);
  }, []);

  const loadPartnerOffers = useCallback(async () => {
    const { data } = await supabase
      .from('partner_offers')
      .select('id, title, description, discount_code, discount_percentage, scope, branch_id, city, active, created_at')
      .order('title');

    if (data) setPartnerOffers(data as PartnerOffer[]);
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
      .select('role, email, branch_id')
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
    setMemberProfile({ role: memberData.role, email: memberData.email, branch_id: memberData.branch_id ?? null });
    setIsLoading(false);

    // Load data
    loadMembers();
    loadTrustedUsers();
    loadBranches();
    loadPartnerOffers();
  }, [loadBranches, loadMembers, loadPartnerOffers, loadTrustedUsers, router]);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!memberProfile) return;
    const isCouncil = ['council', 'technician'].includes(memberProfile.role);
    if (!isCouncil) {
      setNewOffer((prev) => ({
        ...prev,
        scope: 'local',
        branchId: memberProfile.branch_id ?? prev.branchId,
      }));
    }
  }, [memberProfile]);

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
        branch_id: newTrusted.branch_id || null,
        added_by: currentUser.id
      }]);

    if (error) {
      setMessage({ type: 'error', text: `Chyba: ${error.message}` });
    } else {
      setMessage({ type: 'success', text: 'Trusted user přidán!' });
      setNewTrusted({ email: '', first_name: '', last_name: '', phone: '', role: 'member', branch_id: '', notes: '' });
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

  const addPartnerOffer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser || !memberProfile) {
      setMessage({ type: 'error', text: 'Uživatel není přihlášen.' });
      return;
    }

    const isCouncil = ['council', 'technician'].includes(memberProfile.role);
    const isPsychocasManager =
      memberProfile.role === 'manager' && memberProfile.email.toLowerCase().endsWith('@psychocas.cz');

    if (!isCouncil && !isPsychocasManager) {
      setMessage({ type: 'error', text: 'Nemáte oprávnění přidávat partnery.' });
      return;
    }

    const effectiveScope: PartnerScope = isCouncil ? newOffer.scope : 'local';
    const branchForLocal = effectiveScope === 'local'
      ? (isCouncil ? newOffer.branchId : memberProfile.branch_id)
      : null;

    if (effectiveScope === 'local' && !branchForLocal) {
      setMessage({ type: 'error', text: 'Lokální nabídka musí mít přiřazenou pobočku.' });
      return;
    }

    setIsSavingOffer(true);

    const payload = {
      title: newOffer.title.trim(),
      description: newOffer.description?.trim() || null,
      discount_code: newOffer.discountCode?.trim() || null,
      discount_percentage: Number.isFinite(newOffer.discountPercentage)
        ? Number(newOffer.discountPercentage)
        : null,
      scope: effectiveScope,
      branch_id: branchForLocal || null,
      city: newOffer.city?.trim() || null,
      active: true,
      created_by: currentUser.id,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('partner_offers').insert([payload]);

    if (error) {
      setMessage({ type: 'error', text: `Chyba: ${error.message}` });
    } else {
      setMessage({ type: 'success', text: 'Partnerská nabídka přidána!' });
      setNewOffer({
        title: '',
        description: '',
        discountCode: '',
        discountPercentage: 10,
        scope: effectiveScope,
        branchId: branchForLocal ?? '',
        city: '',
      });
      loadPartnerOffers();
    }

    setIsSavingOffer(false);
  };

  const toggleOfferActive = async (offer: PartnerOffer) => {
    const { error } = await supabase
      .from('partner_offers')
      .update({ active: !offer.active, updated_at: new Date().toISOString() })
      .eq('id', offer.id);

    if (error) {
      setMessage({ type: 'error', text: `Chyba: ${error.message}` });
    } else {
      setMessage({ type: 'success', text: `Partner byl ${offer.active ? 'deaktivován' : 'aktivován'}.` });
      loadPartnerOffers();
    }
  };

  const deletePartnerOffer = async (offerId: string) => {
    if (!confirm('Opravdu smazat partnera?')) return;

    const { error } = await supabase
      .from('partner_offers')
      .delete()
      .eq('id', offerId);

    if (error) {
      setMessage({ type: 'error', text: `Chyba: ${error.message}` });
    } else {
      setMessage({ type: 'success', text: 'Partnerská sleva byla odstraněna.' });
      loadPartnerOffers();
    }
  };

  const isCouncilUser = memberProfile ? ['council', 'technician'].includes(memberProfile.role) : false;

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
              Partnerské slevy
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
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                    <select
                      value={newTrusted.branch_id}
                      onChange={(e) => setNewTrusted({ ...newTrusted, branch_id: e.target.value })}
                      className="psychocas-input"
                    >
                      <option value="">Bez pobočky / celostátní</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
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
                    <div
                      key={user.id}
                      className="flex flex-col gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="font-medium">{user.first_name} {user.last_name}</p>
                        <p className="text-sm text-gray-600">{user.email}</p>
                        {user.phone && <p className="text-sm text-gray-600">{user.phone}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-full bg-blue-100 px-2 py-1 font-medium uppercase tracking-wide text-blue-800">
                            {user.role}
                          </span>
                          {user.branch && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-blue-700">
                              <MapPin className="h-3 w-3" />
                              {user.branch.name}
                            </span>
                          )}
                          {user.notes && (
                            <span className="text-gray-500">{user.notes}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteTrustedUser(user.id)}
                        className="self-start rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600 md:self-auto"
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
              <div className="psychocas-card">
                <h2 className="mb-4 flex items-center">
                  <Store className="mr-2 h-5 w-5" />
                  Přidat partnerskou nabídku
                </h2>
                <form onSubmit={addPartnerOffer} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <input
                      type="text"
                      placeholder="Název partnera"
                      value={newOffer.title}
                      onChange={(e) => setNewOffer({ ...newOffer, title: e.target.value })}
                      className="psychocas-input"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Slevový kód (volitelné)"
                      value={newOffer.discountCode}
                      onChange={(e) => setNewOffer({ ...newOffer, discountCode: e.target.value })}
                      className="psychocas-input"
                    />
                    <textarea
                      placeholder="Popis slevy (volitelné)"
                      value={newOffer.description}
                      onChange={(e) => setNewOffer({ ...newOffer, description: e.target.value })}
                      className="psychocas-input md:col-span-2"
                      rows={3}
                    />
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-medium text-gray-600" htmlFor="offer-discount">
                        Sleva %
                      </label>
                      <input
                        id="offer-discount"
                        type="number"
                        min={0}
                        max={100}
                        value={newOffer.discountPercentage}
                        onChange={(e) => setNewOffer({ ...newOffer, discountPercentage: parseInt(e.target.value, 10) || 0 })}
                        className="psychocas-input"
                        style={{ maxWidth: '120px' }}
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-600">Typ nabídky</p>
                      <div className="flex flex-wrap gap-3">
                        <label className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm ${newOffer.scope === 'national' ? 'border-[#1d4f7d] text-[#1d4f7d]' : 'border-gray-200 text-gray-600'}`}>
                          <input
                            type="radio"
                            name="offerScope"
                            value="national"
                            checked={newOffer.scope === 'national'}
                            onChange={(e) => setNewOffer({ ...newOffer, scope: e.target.value as PartnerScope })}
                            disabled={!isCouncilUser}
                          />
                          Celostátní
                        </label>
                        <label className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm ${newOffer.scope === 'local' ? 'border-[#1d4f7d] text-[#1d4f7d]' : 'border-gray-200 text-gray-600'}`}>
                          <input
                            type="radio"
                            name="offerScope"
                            value="local"
                            checked={newOffer.scope === 'local'}
                            onChange={(e) => setNewOffer({ ...newOffer, scope: e.target.value as PartnerScope })}
                          />
                          Lokální
                        </label>
                      </div>
                      {!isCouncilUser && (
                        <p className="text-xs text-gray-500">
                          Manažeři s @psychocas.cz mohou přidávat pouze lokální nabídky.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-600" htmlFor="offer-city">
                        Město / lokalita (volitelné)
                      </label>
                      <input
                        id="offer-city"
                        type="text"
                        placeholder="Praha, Brno, Online..."
                        value={newOffer.city}
                        onChange={(e) => setNewOffer({ ...newOffer, city: e.target.value })}
                        className="psychocas-input"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-600" htmlFor="offer-branch">
                        Pobočka (pro lokální nabídky)
                      </label>
                      <select
                        id="offer-branch"
                        value={newOffer.branchId}
                        onChange={(e) => setNewOffer({ ...newOffer, branchId: e.target.value })}
                        className="psychocas-input"
                        disabled={newOffer.scope === 'national' && isCouncilUser}
                      >
                        <option value="">Vyberte pobočku</option>
                        {branches.map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button type="submit" className="psychocas-button" disabled={isSavingOffer}>
                    {isSavingOffer ? 'Ukládám…' : 'Přidat nabídku'}
                  </button>
                </form>
              </div>

              <div className="psychocas-card">
                <h2 className="mb-4">Aktivní partnerské nabídky ({partnerOffers.length})</h2>
                <div className="space-y-4">
                  {partnerOffers.length === 0 && (
                    <p className="text-sm text-gray-600">Zatím nejsou nastaveny žádné partnerské nabídky.</p>
                  )}
                  {partnerOffers.map((offer) => (
                    <div key={offer.id} className="rounded-xl border border-gray-200 p-4">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-lg font-semibold text-gray-800">{offer.title}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-wide">
                            <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${offer.scope === 'national' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              <Tag className="h-3 w-3" />
                              {offer.scope === 'national' ? 'Celostátní' : 'Lokální'}
                            </span>
                            {offer.city && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-blue-700">
                                <MapPin className="h-3 w-3" />
                                {offer.city}
                              </span>
                            )}
                            {offer.discount_code && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-purple-700">
                                Kód: {offer.discount_code}
                              </span>
                            )}
                            {typeof offer.discount_percentage === 'number' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-3 py-1 text-sky-700">
                                Sleva {offer.discount_percentage}%
                              </span>
                            )}
                          </div>
                          {offer.description && (
                            <p className="mt-3 text-sm text-gray-600">{offer.description}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-start gap-2 md:items-end">
                          <button
                            onClick={() => toggleOfferActive(offer)}
                            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${offer.active ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                          >
                            <ToggleRight className="h-4 w-4" />
                            {offer.active ? 'Aktivní' : 'Neaktivní'}
                          </button>
                          <button
                            onClick={() => deletePartnerOffer(offer.id)}
                            className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
                          >
                            <Trash2 className="h-4 w-4" />
                            Odebrat
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="psychocas-card">
                <h2 className="mb-4">Správa poboček ({branches.length})</h2>
                <form onSubmit={addBranch} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <input
                      type="text"
                      placeholder="Název pobočky"
                      value={newBranch.name}
                      onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })}
                      className="psychocas-input"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Město"
                      value={newBranch.location}
                      onChange={(e) => setNewBranch({ ...newBranch, location: e.target.value })}
                      className="psychocas-input"
                    />
                    <input
                      type="number"
                      placeholder="Výchozí sleva %"
                      value={newBranch.discount_percentage}
                      onChange={(e) => setNewBranch({ ...newBranch, discount_percentage: parseInt(e.target.value, 10) || 0 })}
                      className="psychocas-input"
                      min="0"
                      max="100"
                    />
                  </div>
                  <button type="submit" className="psychocas-button">
                    Přidat pobočku
                  </button>
                </form>
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Název</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Město</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Výchozí sleva</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Akce</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {branches.map((branch) => (
                        <tr key={branch.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium">{branch.name}</td>
                          <td className="px-4 py-3 text-sm">{branch.location || branch.city || 'N/A'}</td>
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
