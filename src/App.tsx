import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/query-client";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth-context";
import { ThemeProvider } from "./lib/theme-context";
import { PlatformProvider } from "./lib/platform";
import { BranchSelectionProvider } from "./lib/branch-selection-context";
import { CategoryImagesProvider } from "./lib/category-images-context";
import { TaxConfigProvider } from "./lib/tax-config-context";
import { RealtimeProvider } from "./lib/realtime-context";
import { useRealtime } from "./hooks/useRealtime";
import { Layout } from "./components/Layout";
import { ScrollToTop } from "./components/ScrollToTop";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { RoleGuard } from "./components/RoleGuard";
import { Loader2 } from "lucide-react";

const Index = lazy(() => import("./pages/Index"));
const POS = lazy(() => import("./pages/POS"));
const CashRegisters = lazy(() => import("./pages/CashRegisters"));
const Inventory = lazy(() => import("./pages/Inventory"));
const MachineModels = lazy(() => import("./pages/MachineModels"));
const StockMovements = lazy(() => import("./pages/StockMovements"));
const Transfers = lazy(() => import("./pages/Transfers"));
const Invoices = lazy(() => import("./pages/Invoices"));
const CreateInvoice = lazy(() => import("./pages/CreateInvoice"));
const Clients = lazy(() => import("./pages/Clients"));
const Branches = lazy(() => import("./pages/Branches"));
const Orders = lazy(() => import("./pages/Orders"));
const TaxConfiguration = lazy(() => import("./pages/TaxConfiguration"));
const SunatConfigPage = lazy(() => import("./pages/SunatConfig"));
const SunatDocumentsPage = lazy(() => import("./pages/SunatDocuments"));
const Despatches = lazy(() => import("./pages/Despatches"));
const CreateDespatch = lazy(() => import("./pages/CreateDespatch"));
const PrinterSettingsPage = lazy(() => import("./pages/PrinterSettings"));
const SystemPage = lazy(() => import("./pages/System"));
const UsersPage = lazy(() => import("./pages/Users"));
const Login = lazy(() => import("./pages/auth/Login"));
const Reports = lazy(() => import("./pages/Reports"));
const StoreLayout = lazy(() => import("./pages/tienda/StoreLayout"));
const StoreIndex = lazy(() => import("./pages/tienda/StoreIndex"));
const StoreCartPage = lazy(() => import("./pages/tienda/StoreCartPage"));
const StoreCheckout = lazy(() => import("./pages/tienda/StoreCheckout"));
const PrivacyPolicy = lazy(() => import("./pages/tienda/PrivacyPolicy"));
const TermsOfUse = lazy(() => import("./pages/tienda/TermsOfUse"));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
    </div>
  );
}

function ProtectedLayout() {
  const { user, loading } = useAuth();
  useRealtime(user?.organization_id);

  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <ThemeProvider storageKey="katsumoto_admin_theme">
    <PlatformProvider>
      <BranchSelectionProvider>
        <CategoryImagesProvider>
          <TaxConfigProvider>
            <Layout>
              <Suspense fallback={<PageLoader />}>
                <Outlet />
              </Suspense>
            </Layout>
          </TaxConfigProvider>
        </CategoryImagesProvider>
      </BranchSelectionProvider>
    </PlatformProvider>
    </ThemeProvider>
  );
}

function AdminRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  return user ? <Navigate to="/admin" replace /> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Tienda pública — landing en raíz */}
        <Route path="/" element={<StoreLayout />}>
          <Route index element={<StoreIndex />} />
          <Route path="carrito" element={<StoreCartPage />} />
          <Route path="checkout" element={<StoreCheckout />} />
          <Route path="privacidad" element={<PrivacyPolicy />} />
          <Route path="terminos" element={<TermsOfUse />} />
        </Route>

        {/* Auth */}
        <Route path="/login" element={<Login />} />

        {/* Admin protegido */}
        <Route element={<ProtectedLayout />}>
          <Route path="/admin" element={<Index />} />
          <Route path="/admin/pos" element={<POS />} />
          <Route path="/admin/cash-registers" element={<CashRegisters />} />
          <Route path="/admin/inventory" element={<RoleGuard allowedRoles={["owner", "admin", "inventory"]}><Inventory /></RoleGuard>} />
          <Route path="/admin/machines" element={<RoleGuard allowedRoles={["owner", "admin", "inventory"]}><MachineModels /></RoleGuard>} />
          <Route path="/admin/transfers" element={<RoleGuard allowedRoles={["owner", "admin", "inventory"]}><Transfers /></RoleGuard>} />
          <Route path="/admin/stock" element={<RoleGuard allowedRoles={["owner", "admin", "inventory"]}><StockMovements /></RoleGuard>} />
          <Route path="/admin/invoices" element={<Invoices />} />
          <Route path="/admin/invoices/new" element={<CreateInvoice />} />
          <Route path="/admin/clients" element={<Clients />} />
          <Route path="/admin/branches" element={<RoleGuard allowedRoles={["owner", "admin"]}><Branches /></RoleGuard>} />
          <Route path="/admin/orders" element={<Orders />} />
          <Route path="/admin/tax-configuration" element={<RoleGuard allowedRoles={["owner", "admin"]}><TaxConfiguration /></RoleGuard>} />
          <Route path="/admin/sunat-config" element={<RoleGuard allowedRoles={["owner", "admin"]}><SunatConfigPage /></RoleGuard>} />
          <Route path="/admin/sunat-documents" element={<SunatDocumentsPage />} />
          <Route path="/admin/despatches" element={<Despatches />} />
          <Route path="/admin/despatches/new" element={<CreateDespatch />} />
          <Route path="/admin/printer-settings" element={<PrinterSettingsPage />} />
          <Route path="/admin/reports" element={<Reports />} />
          <Route path="/admin/system" element={<RoleGuard allowedRoles={["owner", "admin"]}><SystemPage /></RoleGuard>} />
          <Route path="/admin/users" element={<RoleGuard allowedRoles={["owner", "admin"]}><UsersPage /></RoleGuard>} />
        </Route>

        <Route path="*" element={<AdminRedirect />} />
      </Routes>
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <RealtimeProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <ScrollToTop />
              <ErrorBoundary>
                <AppRoutes />
              </ErrorBoundary>
            </BrowserRouter>
          </TooltipProvider>
        </RealtimeProvider>
      </AuthProvider>
  </QueryClientProvider>
);

export default App;
