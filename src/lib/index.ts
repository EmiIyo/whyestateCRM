// ─── Route Constants ───────────────────────────────────────────────────────
export const ROUTE_PATHS = {
  HOME: '/',
  DASHBOARD: '/dashboard',
  LEADS: '/leads',
  LISTINGS: '/listings',
  CONTACTS: '/contacts',
  TENANCY: '/tenancy',
  CALENDAR: '/calendar',
  REPORTS: '/reports',
  DEALS: '/deals',
  COMMISSION: '/commission',
  DOCUMENTS: '/documents',
  ADMIN: '/admin',
  SETTINGS: '/settings',
} as const;

// ─── Types ─────────────────────────────────────────────────────────────────
export type LeadStatus = 'new' | 'contacted' | 'viewing' | 'negotiation' | 'closed' | 'lost';
export type PropertyType = 'condo' | 'landed' | 'commercial' | 'office' | 'shop';
export type PropertyStatus = 'available' | 'rented' | 'sold' | 'pending';
export type ContactType = 'tenant' | 'landlord' | 'buyer' | 'seller';
export type TenancyStatus = 'active' | 'expiring' | 'expired' | 'draft';
export type Priority = 'hot' | 'warm' | 'cold';

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  status: LeadStatus;
  priority: Priority;
  propertyInterest: string;
  budget: number;
  assignedTo: string;
  createdAt: string;
  lastContact: string;
  notes: string;
}

export interface Listing {
  id: string;
  title: string;
  address: string;
  area: string;
  type: PropertyType;
  status: PropertyStatus;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  listedAt: string;
  agent: string;
  imageUrl: string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string;
  type: ContactType;
  company?: string;
  icNumber?: string;
  address: string;
  notes: string;
  createdAt: string;
  relatedListings: string[];
}

export interface TenancyAgreement {
  id: string;
  taNumber: string;
  tenantName: string;
  landlordName: string;
  propertyAddress: string;
  monthlyRental: number;
  securityDeposit: number;
  utilityDeposit: number;
  startDate: string;
  endDate: string;
  status: TenancyStatus;
  agent: string;
}

export interface KpiCard {
  label: string;
  value: string;
  change: string;
  changeType: 'up' | 'down' | 'neutral';
  icon: string;
  color: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────
export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  viewing: 'Viewing',
  negotiation: 'Negotiation',
  closed: 'Closed',
  lost: 'Lost',
};

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-yellow-100 text-yellow-700',
  viewing: 'bg-purple-100 text-purple-700',
  negotiation: 'bg-orange-100 text-orange-700',
  closed: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-700',
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  hot: 'bg-red-100 text-red-700',
  warm: 'bg-orange-100 text-orange-700',
  cold: 'bg-blue-100 text-blue-700',
};

export const PROPERTY_STATUS_COLORS: Record<PropertyStatus, string> = {
  available: 'bg-green-100 text-green-700',
  rented: 'bg-blue-100 text-blue-700',
  sold: 'bg-gray-100 text-gray-700',
  pending: 'bg-yellow-100 text-yellow-700',
};

export const TENANCY_STATUS_COLORS: Record<TenancyStatus, string> = {
  active: 'bg-green-100 text-green-700',
  expiring: 'bg-yellow-100 text-yellow-700',
  expired: 'bg-red-100 text-red-700',
  draft: 'bg-gray-100 text-gray-700',
};

export const formatCurrency = (amount: number): string =>
  `RM ${amount.toLocaleString('en-MY')}`;
