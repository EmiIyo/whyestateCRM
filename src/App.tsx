import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { ROUTE_PATHS } from "@/lib/index";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import ProspectHub from "@/pages/ProspectHub";
import Listings from "@/pages/Listings";
import Contacts from "@/pages/Contacts";
import Tenancy from "@/pages/Tenancy";
import CalendarPage from "@/pages/Calendar";
import Reports from "@/pages/Reports";
import SettingsPage from "@/pages/SettingsPage";
import NotFound from "./pages/not-found/Index";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <HashRouter>
        <Routes>
          {/* Redirect root to dashboard */}
          <Route path={ROUTE_PATHS.HOME} element={<Navigate to={ROUTE_PATHS.DASHBOARD} replace />} />

          {/* CRM Routes — all wrapped in Layout */}
          <Route path={ROUTE_PATHS.DASHBOARD} element={<Layout><Dashboard /></Layout>} />
          <Route path={ROUTE_PATHS.LEADS} element={<Layout><ProspectHub /></Layout>} />
          <Route path={ROUTE_PATHS.LISTINGS} element={<Layout><Listings /></Layout>} />
          <Route path={ROUTE_PATHS.CONTACTS} element={<Layout><Contacts /></Layout>} />
          <Route path={ROUTE_PATHS.TENANCY} element={<Layout><Tenancy /></Layout>} />
          <Route path={ROUTE_PATHS.CALENDAR} element={<Layout><CalendarPage /></Layout>} />
          <Route path={ROUTE_PATHS.REPORTS} element={<Layout><Reports /></Layout>} />
          <Route path={ROUTE_PATHS.SETTINGS} element={<Layout><SettingsPage /></Layout>} />

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
