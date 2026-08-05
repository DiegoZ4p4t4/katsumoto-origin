import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/lib/theme-context";
import { AuthProvider } from "@/lib/auth-context";
import { queryClient } from "@/lib/query-client";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "@/globals.css";

const StoreLayout = React.lazy(() => import("./pages/tienda/StoreLayout"));
const StoreIndex = React.lazy(() => import("./pages/tienda/StoreIndex"));
const StoreCartPage = React.lazy(() => import("./pages/tienda/StoreCartPage"));
const StoreCheckout = React.lazy(() => import("./pages/tienda/StoreCheckout"));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <BrowserRouter>
              <React.Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<StoreLayout />}>
                    <Route index element={<StoreIndex />} />
                    <Route path="carrito" element={<StoreCartPage />} />
                    <Route path="checkout" element={<StoreCheckout />} />
                  </Route>
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </React.Suspense>
              <Toaster />
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
