import { useQuery } from "@tanstack/react-query";
import { storePublicService } from "@/services/store-public.service";

export const storePublicKeys = {
  branches: ["store-public", "branches"] as const,
  products: ["store-public", "products"] as const,
  stock: ["store-public", "stock"] as const,
};

export function useStorePublicBranches() {
  return useQuery({
    queryKey: storePublicKeys.branches,
    queryFn: () => storePublicService.getBranches(),
    staleTime: 30 * 60 * 1000,
  });
}

export function useStorePublicProducts() {
  return useQuery({
    queryKey: storePublicKeys.products,
    queryFn: () => storePublicService.getProducts(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useStorePublicStock() {
  return useQuery({
    queryKey: storePublicKeys.stock,
    queryFn: () => storePublicService.getBranchStock(),
    staleTime: 2 * 60 * 1000,
  });
}
