import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { ROUTE_PATHS } from "@/lib/index";
import Layout from "@/components/Layout";
import RequireAuth from "@/components/RequireAuth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ConfirmHost } from "@/components/ConfirmDialog";
import Landing from "@/pages/Landing";
import ProspectHub from "@/pages/ProspectHub";
import AdminControl from "@/pages/AdminControl";
import MyProfile from "@/pages/MyProfile";
import CalendarPage from "@/pages/Calendar";
import DocumentsPage from "@/pages/Documents";
import ClientsPage from "@/pages/Clients";
import Dashboard from "@/pages/Dashboard";
import UnderDevelopment from "@/pages/UnderDevelopment";
import NotFound from "./pages/not-found/Index";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-right" richColors closeButton />
      <ConfirmHost />
      <HashRouter>
        <Routes>
          <Route path={ROUTE_PATHS.HOME} element={<Landing />} />

          <Route path={ROUTE_PATHS.LEADS}      element={<RequireAuth permission="nav.leads"><Layout><ProspectHub /></Layout></RequireAuth>} />
          <Route path={ROUTE_PATHS.DASHBOARD}  element={<RequireAuth permission="nav.dashboard"><Layout><Dashboard /></Layout></RequireAuth>} />
          <Route path={ROUTE_PATHS.LISTINGS}   element={<RequireAuth><Layout><UnderDevelopment name="Properties" /></Layout></RequireAuth>} />
          <Route path={ROUTE_PATHS.CONTACTS}   element={<RequireAuth permission="nav.clients"><Layout><ClientsPage /></Layout></RequireAuth>} />
          <Route path={ROUTE_PATHS.CLIENTS}    element={<RequireAuth permission="nav.clients"><Layout><ClientsPage /></Layout></RequireAuth>} />
          <Route path={ROUTE_PATHS.TENANCY}    element={<RequireAuth><Layout><UnderDevelopment name="Tenancy" /></Layout></RequireAuth>} />
          <Route path={ROUTE_PATHS.CALENDAR}   element={<RequireAuth permission="nav.calendar"><Layout><CalendarPage /></Layout></RequireAuth>} />
          <Route path={ROUTE_PATHS.REPORTS}    element={<RequireAuth><Layout><UnderDevelopment name="Reports" /></Layout></RequireAuth>} />
          {/* Deals + Commission are placeholder modules — no UI shipped yet */}
          <Route path={ROUTE_PATHS.DEALS}      element={<RequireAuth><Layout><UnderDevelopment name="Deals" /></Layout></RequireAuth>} />
          <Route path={ROUTE_PATHS.COMMISSION} element={<RequireAuth><Layout><UnderDevelopment name="Commission" /></Layout></RequireAuth>} />
          <Route path={ROUTE_PATHS.DOCUMENTS}  element={<RequireAuth permission="nav.documents"><Layout><DocumentsPage /></Layout></RequireAuth>} />
          <Route path={ROUTE_PATHS.ADMIN}      element={<RequireAuth adminPanel><Layout><AdminControl /></Layout></RequireAuth>} />
          <Route path={ROUTE_PATHS.SETTINGS}   element={<RequireAuth><Layout><MyProfile /></Layout></RequireAuth>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
