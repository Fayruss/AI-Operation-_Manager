"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";
import type { OrgUserDto } from "@/lib/api/dto";
import type { UserRole } from "@ai-ops/types";

export function useOrgUsers() {
  return useQuery({
    queryKey: queryKeys.users.all,
    queryFn: () => apiClient.get<{ users: OrgUserDto[] }>("/users")
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      apiClient.patch<OrgUserDto>(`/users/${userId}`, { role }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    }
  });
}
