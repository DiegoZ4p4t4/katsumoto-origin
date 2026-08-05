import { useState } from "react";
import { useUsers, useUserMutations } from "@/hooks/useUsers";
import { useAuth } from "@/lib/auth-context";
import { RoleGuard } from "@/components/RoleGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus, Shield, Mail } from "lucide-react";
import type { UserRole } from "@/lib/types";

const ROLE_LABELS: Record<UserRole, { label: string; color: string }> = {
  owner: { label: "Dueño", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400" },
  admin: { label: "Admin", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-400" },
  cashier: { label: "Cajero", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400" },
  inventory: { label: "Almacén", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400" },
  vendedor: { label: "Vendedor", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-400" },
  reader: { label: "Lector", color: "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-400" },
};

const ROLES: UserRole[] = ["owner", "admin", "cashier", "vendedor", "inventory", "reader"];

export default function Users() {
  const { user: currentUser } = useAuth();
  const { users, isLoading } = useUsers();
  const { inviteMutation, updateRoleMutation, toggleActiveMutation } = useUserMutations();
  const { toast } = useToast();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", fullName: "", role: "cashier" as UserRole });
  const [inviteResult, setInviteResult] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<string | null>(null);

  const handleInvite = async () => {
    try {
      const result = await inviteMutation.mutateAsync({
        email: inviteForm.email,
        fullName: inviteForm.fullName,
        role: inviteForm.role,
      });
      setInviteResult(result.password);
      toast({ title: "Usuario invitado", description: "Comparte la contraseña temporal con el usuario." });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleRoleChange = async (userId: string, role: UserRole) => {
    try {
      await updateRoleMutation.mutateAsync({ userId, role });
      setEditingRole(null);
      toast({ title: "Rol actualizado" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    try {
      await toggleActiveMutation.mutateAsync({ userId, isActive });
      toast({ title: isActive ? "Usuario activado" : "Usuario desactivado" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <RoleGuard allowedRoles={["owner", "admin"]}>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Usuarios</h2>
            <p className="text-muted-foreground">Gestiona los accesos al sistema</p>
          </div>
          <Button onClick={() => { setInviteOpen(true); setInviteResult(null); setInviteForm({ email: "", fullName: "", role: "cashier" }); }}>
            <UserPlus className="w-4 h-4 mr-2" />
            Invitar usuario
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-24">Activo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => {
                    const isSelf = u.id === currentUser?.id;
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">
                          {u.full_name}
                          {isSelf && <span className="text-xs text-muted-foreground ml-2">(tú)</span>}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          {editingRole === u.id ? (
                            <Select
                              defaultValue={u.role}
                              onValueChange={(v) => handleRoleChange(u.id, v as UserRole)}
                            >
                              <SelectTrigger className="w-28 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ROLES.map((r) => (
                                  <SelectItem key={r} value={r}>{ROLE_LABELS[r].label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <button
                              onClick={() => !isSelf && setEditingRole(u.id)}
                              disabled={isSelf}
                              className="cursor-pointer disabled:cursor-default"
                            >
                              <Badge className={ROLE_LABELS[u.role]?.color || ""}>
                                <Shield className="w-3 h-3 mr-1" />
                                {ROLE_LABELS[u.role]?.label || u.role}
                              </Badge>
                            </button>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.is_active ? "default" : "secondary"}>
                            {u.is_active ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={u.is_active}
                            onCheckedChange={(v) => handleToggleActive(u.id, v)}
                            disabled={isSelf}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No hay usuarios registrados
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invitar usuario</DialogTitle>
              <DialogDescription>
                Crea una cuenta para un nuevo usuario. Recibirá una contraseña temporal.
              </DialogDescription>
            </DialogHeader>
            {inviteResult ? (
              <div className="space-y-4">
                <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30">
                  <CardContent className="pt-6 space-y-2">
                    <p className="text-sm font-medium">Usuario creado exitosamente</p>
                    <div className="flex items-center gap-2 bg-background rounded-lg p-3 border">
                      <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-mono select-all">{inviteForm.email}</span>
                    </div>
                    <div className="bg-background rounded-lg p-3 border">
                      <p className="text-xs text-muted-foreground mb-1">Contraseña temporal</p>
                      <p className="text-sm font-mono font-bold select-all">{inviteResult}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Copia esta contraseña y compártela de forma segura. El usuario deberá cambiarla al iniciar sesión.
                    </p>
                  </CardContent>
                </Card>
                <Button className="w-full" onClick={() => setInviteOpen(false)}>Cerrar</Button>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nombre completo</Label>
                    <Input
                      placeholder="Juan Pérez"
                      value={inviteForm.fullName}
                      onChange={(e) => setInviteForm({ ...inviteForm, fullName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Correo electrónico</Label>
                    <Input
                      type="email"
                      placeholder="juan@empresa.com"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Rol</Label>
                    <Select
                      value={inviteForm.role}
                      onValueChange={(v) => setInviteForm({ ...inviteForm, role: v as UserRole })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.filter((r) => r !== "owner").map((r) => (
                          <SelectItem key={r} value={r}>{ROLE_LABELS[r].label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
                  <Button
                    onClick={handleInvite}
                    disabled={inviteMutation.isPending || !inviteForm.email || !inviteForm.fullName}
                  >
                    {inviteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Crear usuario
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  );
}
