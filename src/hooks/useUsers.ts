import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userService } from "@/services/user.service";
import { showError } from "@/utils/toast";
import type { UserRole } from "@/lib/types";

export function useUsers() {
  const {
    data: users = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["users"],
    queryFn: () => userService.getByOrg(),
    staleTime: 60 * 1000,
  });

  return { users, isLoading, error };
}

export function useUserMutations() {
  const queryClient = useQueryClient();

  const inviteMutation = useMutation({
    mutationFn: ({ email, fullName, role }: { email: string; fullName: string; role: UserRole }) =>
      userService.inviteUser(email, fullName, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
    onError: (err: Error) => showError("Error al invitar usuario: " + err.message),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      userService.updateRole(userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
    onError: (err: Error) => showError("Error al cambiar rol: " + err.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      userService.toggleActive(userId, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
    onError: (err: Error) => showError("Error al cambiar estado: " + err.message),
  });

  const updateProfileMutation = useMutation({
    mutationFn: ({ userId, fullName }: { userId: string; fullName: string }) =>
      userService.updateProfile(userId, fullName),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
    onError: (err: Error) => showError("Error al actualizar perfil: " + err.message),
  });

  return { inviteMutation, updateRoleMutation, toggleActiveMutation, updateProfileMutation };
}
