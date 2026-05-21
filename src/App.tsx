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
import Dashboard from "@/pages/Dashboard";
import Listings from "@/pages/Listings";
import Tenancy from "@/pages/Tenancy";
import Reports from "@/pages/Reports";
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
          <Route path={ROUTE_PATHS.HOME} element={<Landing />} />

          <Route path={ROUTE_PATHS.LEADS}      element={<RequireAuth><Layout><ProspectHub /></Layout></RequireAuth>} />
          <Route path={ROUTE_PATHS.DASHBOARD}  element={<RequireAuth><Layout><Dashboard /></Layout></RequireAuth>} />
          <Route path={ROUTE_PATHS.LISTINGS}   element={<RequireAuth><Layout><Listings /></Layout></RequireAuth>} />
          <Route path={ROUTE_PATHS.CONTACTS}   element={<RequireAuth><Layout><ClientsPage /></Layout></RequireAuth>} />
          <Route path={ROUTE_PATHS.CLIENTS}    element={<RequireAuth><Layout><ClientsPage /></Layout></RequireAuth>} />
          <Route path={ROUTE_PATHS.TENANCY}    element={<RequireAuth><Layout><Tenancy /></Layout></RequireAuth>} />
          <Route path={ROUTE_PATHS.CALENDAR}   element={<RequireAuth><Layout><CalendarPage /></Layout></RequireAuth>} />
          <Route path={ROUTE_PATHS.REPORTS}    element={<RequireAuth><Layout><Reports /></Layout></RequireAuth>} />
          {/* Deals + Commission are placeholder modules — no UI shipped yet */}
          <Route path={ROUTE_PATHS.DEALS}      element={<RequireAuth><Layout><UnderDevelopment name="Deals" /></Layout></RequireAuth>} />
          <Route path={ROUTE_PATHS.COMMISSION} element={<RequireAuth><Layout><UnderDevelopment name="Commission" /></Layout></RequireAuth>} />
          <Route path={ROUTE_PATHS.DOCUMENTS}  element={<RequireAuth><Layout><DocumentsPage /></Layout></RequireAuth>} />
          <Route path={ROUTE_PATHS.ADMIN}      element={<RequireAuth masterOnly><Layout><AdminControl /></Layout></RequireAuth>} />
          <Route path={ROUTE_PATHS.SETTINGS}   element={<RequireAuth><Layout><MyProfile /></Layout></RequireAuth>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
