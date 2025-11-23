import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useWebSocket } from "@/hooks/use-websocket";

import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import BillingPage from "@/pages/billing";
import TablesPage from "@/pages/tables";
import KitchenPage from "@/pages/kitchen";
import MenuPage from "@/pages/menu";
import ReportsPage from "@/pages/reports";
import SettingsPage from "@/pages/settings";
import DeliveryPage from "@/pages/delivery";
import OnlineOrdersPage from "@/pages/online-orders";
import CustomersPage from "@/pages/customers";
import LoyaltyPage from "@/pages/loyalty";
import InventoryPage from "@/pages/inventory";
import InventoryHistoryPage from "@/pages/inventory-history";
import PurchaseOrdersPage from "@/pages/purchase-orders";
import SuppliersPage from "@/pages/suppliers";
import StaffPage from "@/pages/staff";
import AttendancePage from "@/pages/attendance";
import ReservationsPage from "@/pages/reservations";
import ExpensesPage from "@/pages/expenses";
import PaymentSettlementPage from "@/pages/payment-settlement";
import AccountingPage from "@/pages/accounting";
import TaxReportsPage from "@/pages/tax-reports";
import InvoicesPage from "@/pages/invoices";
import DayEndSettlementPage from "@/pages/day-end-settlement";
import OffersPage from "@/pages/offers";
import CouponsPage from "@/pages/coupons";
import FeedbackPage from "@/pages/feedback";
import AnalyticsPage from "@/pages/analytics";
import SalesDetailedPage from "@/pages/sales-detailed";
import ItemPerformancePage from "@/pages/item-performance";
import KitchenPerformancePage from "@/pages/kitchen-performance";
import WastagePage from "@/pages/wastage";
import MultiLocationPage from "@/pages/multi-location";
import UserRolesPage from "@/pages/user-roles";
import AuditLogsPage from "@/pages/audit-logs";
import NotificationsPage from "@/pages/notifications";
import HelpPage from "@/pages/help";
import ProfilePage from "@/pages/profile";
import BackupPage from "@/pages/backup";
import QRCodesPage from "@/pages/qr-codes";
import WaitingListPage from "@/pages/waiting-list";
import EventsPage from "@/pages/events";
import GiftCardsPage from "@/pages/gift-cards";
import CommissionPage from "@/pages/commission";
import PrinterConfigPage from "@/pages/printer-config";
import EmailTemplatesPage from "@/pages/email-templates";
import MarketingPage from "@/pages/marketing";
import IntegrationsPage from "@/pages/integrations";
import DatabasePage from "@/pages/database";
import DigitalMenuOrdersPage from "@/pages/digital-menu-orders";

function Router() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/billing" component={BillingPage} />
      <Route path="/tables" component={TablesPage} />
      <Route path="/kitchen" component={KitchenPage} />
      <Route path="/menu" component={MenuPage} />
      <Route path="/reports" component={ReportsPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/delivery" component={DeliveryPage} />
      <Route path="/online-orders" component={OnlineOrdersPage} />
      <Route path="/customers" component={CustomersPage} />
      <Route path="/loyalty" component={LoyaltyPage} />
      <Route path="/inventory" component={InventoryPage} />
      <Route path="/inventory-history" component={InventoryHistoryPage} />
      <Route path="/purchase-orders" component={PurchaseOrdersPage} />
      <Route path="/suppliers" component={SuppliersPage} />
      <Route path="/staff" component={StaffPage} />
      <Route path="/attendance" component={AttendancePage} />
      <Route path="/reservations" component={ReservationsPage} />
      <Route path="/expenses" component={ExpensesPage} />
      <Route path="/payment-settlement" component={PaymentSettlementPage} />
      <Route path="/accounting" component={AccountingPage} />
      <Route path="/tax-reports" component={TaxReportsPage} />
      <Route path="/invoices" component={InvoicesPage} />
      <Route path="/day-end-settlement" component={DayEndSettlementPage} />
      <Route path="/offers" component={OffersPage} />
      <Route path="/coupons" component={CouponsPage} />
      <Route path="/feedback" component={FeedbackPage} />
      <Route path="/analytics" component={AnalyticsPage} />
      <Route path="/sales-detailed" component={SalesDetailedPage} />
      <Route path="/item-performance" component={ItemPerformancePage} />
      <Route path="/kitchen-performance" component={KitchenPerformancePage} />
      <Route path="/wastage" component={WastagePage} />
      <Route path="/multi-location" component={MultiLocationPage} />
      <Route path="/user-roles" component={UserRolesPage} />
      <Route path="/audit-logs" component={AuditLogsPage} />
      <Route path="/notifications" component={NotificationsPage} />
      <Route path="/help" component={HelpPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/backup" component={BackupPage} />
      <Route path="/qr-codes" component={QRCodesPage} />
      <Route path="/waiting-list" component={WaitingListPage} />
      <Route path="/events" component={EventsPage} />
      <Route path="/gift-cards" component={GiftCardsPage} />
      <Route path="/commission" component={CommissionPage} />
      <Route path="/printer-config" component={PrinterConfigPage} />
      <Route path="/email-templates" component={EmailTemplatesPage} />
      <Route path="/marketing" component={MarketingPage} />
      <Route path="/integrations" component={IntegrationsPage} />
      <Route path="/database" component={DatabasePage} />
      <Route path="/digital-menu-orders" component={DigitalMenuOrdersPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useWebSocket();
  
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={style as React.CSSProperties} defaultOpen={false}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <main className="flex-1 overflow-hidden flex flex-col w-full">
              <Router />
            </main>
          </div>
          <Toaster />
        </SidebarProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
