import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Plus, Edit, Trash2, Search } from 'lucide-react';

interface Member {
  id: string;
  email: string;
  role: 'member' | 'manager' | 'admin';
  membershipActive: boolean;
  joinDate: string;
  expiryDate: string;
}

interface TechnicianProps {
  onBack: () => void;
}

const mockMembers: Member[] = [
  {
    id: '1',
    email: 'jan.novak@student.cuni.cz',
    role: 'member',
    membershipActive: true,
    joinDate: '2024-01-15',
    expiryDate: '2025-01-15'
  },
  {
    id: '2',
    email: 'marie.svoboda@student.cuni.cz',
    role: 'member',
    membershipActive: true,
    joinDate: '2024-02-01',
    expiryDate: '2025-02-01'
  },
  {
    id: '3',
    email: 'petr.dvorak@student.cuni.cz',
    role: 'manager',
    membershipActive: true,
    joinDate: '2023-09-01',
    expiryDate: '2024-09-01'
  },
  {
    id: '4',
    email: 'anna.krejci@student.cuni.cz',
    role: 'member',
    membershipActive: false,
    joinDate: '2023-10-15',
    expiryDate: '2024-10-15'
  }
];

export function Technician({ onBack }: TechnicianProps) {
  const [members, setMembers] = useState<Member[]>(mockMembers);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newMember, setNewMember] = useState({
    email: '',
    role: 'member' as const,
    membershipActive: true,
    expiryDate: ''
  });

  const filteredMembers = members.filter(member =>
    member.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddMember = () => {
    const member: Member = {
      id: Date.now().toString(),
      email: newMember.email,
      role: newMember.role,
      membershipActive: newMember.membershipActive,
      joinDate: new Date().toISOString().split('T')[0],
      expiryDate: newMember.expiryDate
    };
    
    setMembers([...members, member]);
    setNewMember({ email: '', role: 'member', membershipActive: true, expiryDate: '' });
    setIsAddDialogOpen(false);
  };

  const handleEditMember = (member: Member) => {
    if (editingMember && editingMember.id === member.id) {
      // Save changes
      setMembers(members.map(m => m.id === member.id ? editingMember : m));
      setEditingMember(null);
    } else {
      // Start editing
      setEditingMember({ ...member });
    }
  };

  const handleDeleteMember = (id: string) => {
    setMembers(members.filter(m => m.id !== id));
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return { bg: '#ffebee', color: '#c62828' };
      case 'manager': return { bg: '#e1f5fe', color: '#049edb' };
      default: return { bg: '#e8f5e8', color: '#2e7d32' };
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'manager': return 'Manažer';
      default: return 'Člen';
    }
  };

  return (
    <div className="min-h-screen p-4" style={{ backgroundColor: '#f5f5f5' }}>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pt-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={onBack}
              variant="ghost"
              className="p-2"
              style={{ color: '#1d4f7d' }}
            >
              ←
            </Button>
            <h1 className="text-xl" style={{ color: '#1d4f7d' }}>
              Správa členů
            </h1>
          </div>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="flex items-center gap-2 psychocas-button-primary"
                style={{ 
                  backgroundColor: '#1d4f7d',
                  color: '#ffffff',
                  borderRadius: '1.5rem'
                }}
              >
                <Plus className="w-4 h-4" />
                Přidat člena
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Přidat nového člena</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="new-email">Email</Label>
                  <Input
                    id="new-email"
                    value={newMember.email}
                    onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                    placeholder="email@student.cuni.cz"
                    className="psychocas-input"
                  />
                </div>
                <div>
                  <Label htmlFor="new-role">Role</Label>
                  <Select value={newMember.role} onValueChange={(value: 'member' | 'manager' | 'admin') => setNewMember({ ...newMember, role: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Člen</SelectItem>
                      <SelectItem value="manager">Manažer</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="new-expiry">Platnost do</Label>
                  <Input
                    id="new-expiry"
                    type="date"
                    value={newMember.expiryDate}
                    onChange={(e) => setNewMember({ ...newMember, expiryDate: e.target.value })}
                    className="psychocas-input"
                  />
                </div>
                <Button
                  onClick={handleAddMember}
                  disabled={!newMember.email || !newMember.expiryDate}
                  className="w-full psychocas-button-primary"
                  style={{ 
                    backgroundColor: '#1d4f7d',
                    color: '#ffffff',
                    borderRadius: '1.5rem'
                  }}
                >
                  Přidat člena
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <Card className="psychocas-card">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: '#666666' }} />
              <Input
                placeholder="Hledat podle emailu..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 psychocas-input"
              />
            </div>
          </CardContent>
        </Card>

        {/* Members Table */}
        <Card className="psychocas-card">
          <CardHeader style={{ backgroundColor: '#1d4f7d', color: '#ffffff' }}>
            <CardTitle>Seznam členů ({filteredMembers.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: '#f5f5f5' }}>
                  <TableHead style={{ color: '#333333' }}>Email</TableHead>
                  <TableHead style={{ color: '#333333' }}>Role</TableHead>
                  <TableHead style={{ color: '#333333' }}>Členství</TableHead>
                  <TableHead style={{ color: '#333333' }}>Platnost do</TableHead>
                  <TableHead style={{ color: '#333333' }}>Akce</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((member, index) => (
                  <TableRow 
                    key={member.id}
                    style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#fafafa' }}
                  >
                    <TableCell style={{ color: '#333333' }}>
                      {editingMember?.id === member.id ? (
                        <Input
                          value={editingMember.email}
                          onChange={(e) => setEditingMember({ ...editingMember, email: e.target.value })}
                          className="psychocas-input"
                        />
                      ) : (
                        member.email
                      )}
                    </TableCell>
                    <TableCell>
                      {editingMember?.id === member.id ? (
                        <Select 
                          value={editingMember.role} 
                          onValueChange={(value: 'member' | 'manager' | 'admin') => setEditingMember({ ...editingMember, role: value })}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Člen</SelectItem>
                            <SelectItem value="manager">Manažer</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge
                          style={getRoleColor(member.role)}
                        >
                          {getRoleLabel(member.role)}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        style={{
                          backgroundColor: member.membershipActive ? '#e8f5e8' : '#ffebee',
                          color: member.membershipActive ? '#2e7d32' : '#c62828'
                        }}
                      >
                        {member.membershipActive ? 'Aktivní' : 'Neaktivní'}
                      </Badge>
                    </TableCell>
                    <TableCell style={{ color: '#333333' }}>
                      {editingMember?.id === member.id ? (
                        <Input
                          type="date"
                          value={editingMember.expiryDate}
                          onChange={(e) => setEditingMember({ ...editingMember, expiryDate: e.target.value })}
                          className="psychocas-input"
                        />
                      ) : (
                        new Date(member.expiryDate).toLocaleDateString('cs-CZ')
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => handleEditMember(member)}
                          variant="ghost"
                          size="sm"
                          className="p-2"
                          style={{ color: '#049edb' }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() => handleDeleteMember(member.id)}
                          variant="ghost"
                          size="sm"
                          className="p-2"
                          style={{ color: '#c62828' }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="psychocas-card">
            <CardContent className="p-4 text-center">
              <div className="text-2xl" style={{ color: '#1d4f7d' }}>
                {members.length}
              </div>
              <p className="text-sm" style={{ color: '#666666' }}>
                Celkem členů
              </p>
            </CardContent>
          </Card>
          
          <Card className="psychocas-card">
            <CardContent className="p-4 text-center">
              <div className="text-2xl" style={{ color: '#2e7d32' }}>
                {members.filter(m => m.membershipActive).length}
              </div>
              <p className="text-sm" style={{ color: '#666666' }}>
                Aktivních
              </p>
            </CardContent>
          </Card>
          
          <Card className="psychocas-card">
            <CardContent className="p-4 text-center">
              <div className="text-2xl" style={{ color: '#c62828' }}>
                {members.filter(m => !m.membershipActive).length}
              </div>
              <p className="text-sm" style={{ color: '#666666' }}>
                Neaktivních
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}