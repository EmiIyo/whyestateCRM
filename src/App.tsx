import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { ROUTE_PATHS } from "@/lib/index";
import Layout from "@/components/Layout";
import RequireAuth from "@/components/RequireAuth";
import Landing from "@/pages/Landing";
import ProspectHub from "@/pages/ProspectHub";
import AdminControl from "@/pages/AdminControl";
import MyProfile from "@/pages/MyProfile";
import CalendarPage from "@/pages/Calendar";
import DocumentsPage from "@/pages/Documents";
import ClientsPage from "@/pages/Clients";
import UnderDevelopment from "@/pages/UnderDevelopment";
import NotFound from "./pages/not-found/Index";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <HashRouter>
        <Routes>
          {/* Public landing page — auth modal lives inside */}
          <Route path={ROUTE_PATHS.HOME} element={<Landing />} />

          {/* Prospect Hub — the only fully-functional module (gated) */}
          <Route path={ROUTE_PATHS.LEADS} element={<RequireAuth><Layout><ProspectHub /></Layout></RequireAuth>} />

          {/* All other modules — under development (gated) */}
          <Route path={ROUTE_PATHS.DASHBOARD}  element={<RequireAuth><Layout><UnderDevelopment name="Dashboard" /></Layout></RequireAuth>} />
          <Route path={ROUTE_PATHS.LISTINGS}   element={<RequireAuth><Layout><UnderDevelopment name="Properties" /></Layout></RequireAuth>} />
          <Route path={ROUTE_PATHS.CONTACTS}   element={<RequireAuth><Layout><ClientsPage /></Layout></RequireAuth>} />
          <Route path={ROUTE_PATHS.CLIENTS}    element={<RequireAuth><Layout><ClientsPage /></Layout></RequireAuth>} />
          <Route path={ROUTE_PATHS.TENANCY}    element={<RequireAuth><Layout><UnderDevelopment name="Tenancy" /></Layout></RequireAuth>} />
          <Route path={ROUTE_PATHS.CALENDAR}   element={<RequireAuth><Layout><CalendarPage /></Layout></RequireAuth>} />
          <Route path={ROUTE_PATHS.REPORTS}    element={<RequireAuth><Layout><UnderDevelopment name="Reports" /></Layout></RequireAuth>} />
          <Route path={ROUTE_PATHS.DEALS}      element={<RequireAuth><Layout><UnderDevelopment name="Deals" /></Layout></RequireAuth>} />
          <Route path={ROUTE_PATHS.COMMISSION} element={<RequireAuth><Layout><UnderDevelopment name="Commission" /></Layout></RequireAuth>} />
          <Route path={ROUTE_PATHS.DOCUMENTS}  element={<RequireAuth><Layout><DocumentsPage /></Layout></RequireAuth>} />
          <Route path={ROUTE_PATHS.ADMIN}      element={<RequireAuth masterOnly><Layout><AdminControl /></Layout></RequireAuth>} />
          <Route path={ROUTE_PATHS.SETTINGS}   element={<RequireAuth><Layout><MyProfile /></Layout></RequireAuth>} />

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
