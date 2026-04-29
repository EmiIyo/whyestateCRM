import type { Lead, Listing, Contact, TenancyAgreement } from '@/lib/index';

// ─── KPI Stats ────────────────────────────────────────────────────────────────
export const kpiStats = [
  {
    label: 'Active Deals',
    value: '5',
    detail: '+3 this month',
    detailColor: '#1EC9C4',
    icon: 'Zap',
    iconColor: '#1EC9C4',
    iconBg: '#B4E6E4',
    cardBg: '#E8F8F7',
  },
  {
    label: 'Pipeline Value',
    value: 'RM 10.53M',
    detail: '5 properties',
    detailColor: '#8D54EA',
    icon: 'Target',
    iconColor: '#8D54EA',
    iconBg: '#E2D3FA',
    cardBg: '#F7F1FF',
  },
  {
    label: 'Est. Commission',
    value: 'RM 211K',
    detail: '↑ 18% vs last month',
    detailColor: '#22C55E',
    icon: 'TrendingUp',
    iconColor: '#22C55E',
    iconBg: '#B9EED8',
    cardBg: '#E7F9F2',
  },
  {
    label: 'Urgent Tasks',
    value: '5',
    detail: 'Due within 7 days',
    detailColor: '#FF4F6C',
    icon: 'AlertCircle',
    iconColor: '#FF4F6C',
    iconBg: '#FFE3E8',
    cardBg: '#FFF2F4',
  },
];

// ─── Commission Trend ─────────────────────────────────────────────────────────
export const commissionData = [
  { month: 'Nov 25', amount: 42000 },
  { month: 'Dec 25', amount: 58000 },
  { month: 'Jan 26', amount: 75000 },
  { month: 'Feb 26', amount: 88000 },
  { month: 'Mar 26', amount: 110000 },
  { month: 'Apr 26', amount: 148000 },
];

// ─── Property Mix ─────────────────────────────────────────────────────────────
export const propertyMix = [
  { name: 'Condo',        value: 2, color: '#3D8FF4' },
  { name: 'Terrace',      value: 1, color: '#FCA600' },
  { name: 'Semi-D',       value: 1, color: '#8D54EA' },
  { name: 'Bungalow',     value: 1, color: '#FF4F6C' },
  { name: 'Serviced Apt', value: 1, color: '#22C55E' },
];

// ─── Pipeline Stages ─────────────────────────────────────────────────────────
export const pipelineStages = [
  { label: 'LOO',  count: 1, color: '#FCA600' },
  { label: 'SPA',  count: 1, color: '#3D8FF4' },
  { label: 'Loan', count: 1, color: '#8D54EA' },
  { label: 'OC',   count: 1, color: '#1EC9C4' },
  { label: 'VP',   count: 1, color: '#FF4F6C' },
];

// ─── Active Deals ─────────────────────────────────────────────────────────────
export const activeDeals = [
  { id: 'D001', address: 'Unit 12-5, Bangsar South, KL 59200',    value: 780000,   stage: 'SPA',  daysInStage: 17 },
  { id: 'D002', address: 'No 8, Jln SS2/24, Petaling Jaya 47500', value: 1350000,  stage: 'Loan', daysInStage: 9 },
  { id: 'D003', address: 'D-15-3, Kiara 163, Mont Kiara KL',       value: 980000,   stage: 'LOO',  daysInStage: 4 },
  { id: 'D004', address: 'Lot 22, Setia Eco Glades, Cyberjaya',    value: 1580000,  stage: 'OC',   daysInStage: 31 },
  { id: 'D005', address: 'Suite 8A, The Sentral Residences, KL',   value: 2100000,  stage: 'VP',   daysInStage: 22 },
];

// ─── Upcoming Tasks ───────────────────────────────────────────────────────────
export const upcomingTasks = [
  { id: 1, text: 'Chase Maybank — D-002 loan approval status',    urgent: true,  due: 'Today' },
  { id: 2, text: 'Send LOO draft to buyer — Unit 12-5 Bangsar',   urgent: true,  due: 'Tomorrow' },
  { id: 3, text: 'Confirm VP date with developer — Sentral',       urgent: true,  due: 'Apr 25' },
  { id: 4, text: 'Follow up Priya Nair — KLCC Studio viewing',     urgent: false, due: 'Apr 26' },
  { id: 5, text: 'Submit commission invoice — TA-2026-002',        urgent: false, due: 'Apr 28' },
];

// ─── Legacy exports (still used by other pages) ───────────────────────────────
export const revenueData = commissionData.map(d => ({ month: d.month, revenue: d.amount, leads: Math.round(d.amount / 1200) }));
export const pipelineData = pipelineStages.map(s => ({ stage: s.label, count: s.count, color: s.color }));
export const listingsByType = propertyMix.map(p => ({ name: p.name, value: p.value, fill: p.color }));

export const recentLeads: Lead[] = [
  { id: 'L001', name: 'Ahmad Farid bin Razali', phone: '+60 12-345 6789', email: 'ahmad.farid@email.com', status: 'viewing', priority: 'hot', propertyInterest: 'Mont Kiara Condo', budget: 550000, assignedTo: 'You', createdAt: '2026-04-18', lastContact: '2026-04-22', notes: '' },
  { id: 'L002', name: 'Priya Nair', phone: '+60 11-987 6543', email: 'priya.nair@email.com', status: 'negotiation', priority: 'hot', propertyInterest: 'KLCC Studio', budget: 380000, assignedTo: 'You', createdAt: '2026-04-15', lastContact: '2026-04-23', notes: '' },
  { id: 'L003', name: 'Tan Wei Liang', phone: '+60 16-222 3344', email: 'twl@business.com', status: 'contacted', priority: 'warm', propertyInterest: 'Damansara Office', budget: 1200000, assignedTo: 'You', createdAt: '2026-04-20', lastContact: '2026-04-21', notes: '' },
  { id: 'L004', name: 'Nurul Ain binti Hassan', phone: '+60 19-555 7788', email: 'nurul.ain@email.com', status: 'new', priority: 'warm', propertyInterest: 'Petaling Jaya Condo', budget: 420000, assignedTo: 'You', createdAt: '2026-04-23', lastContact: '2026-04-23', notes: '' },
  { id: 'L005', name: 'Lee Kok Weng', phone: '+60 17-888 9900', email: 'lkw@gmail.com', status: 'new', priority: 'cold', propertyInterest: 'Cheras Landed', budget: 750000, assignedTo: 'You', createdAt: '2026-04-23', lastContact: '2026-04-23', notes: '' },
];

export const recentTenancies: TenancyAgreement[] = [
  { id: 'TA001', taNumber: 'TA-2026-001', tenantName: 'Rajesh Kumar', landlordName: 'Dato Lim Ah Kow', propertyAddress: 'Unit 8-12, Menara Ampang, KL', monthlyRental: 3500, securityDeposit: 7000, utilityDeposit: 1750, startDate: '2026-02-01', endDate: '2027-01-31', status: 'active', agent: 'You' },
  { id: 'TA002', taNumber: 'TA-2026-002', tenantName: 'Sarah Lim', landlordName: 'Mr. Gopal', propertyAddress: '45, Jalan SS2/24, PJ', monthlyRental: 2800, securityDeposit: 5600, utilityDeposit: 1400, startDate: '2026-03-01', endDate: '2027-02-28', status: 'active', agent: 'You' },
  { id: 'TA003', taNumber: 'TA-2025-044', tenantName: 'Mohd Azlan', landlordName: 'Puan Siti', propertyAddress: 'D-3-8, Tiara Ampang', monthlyRental: 2200, securityDeposit: 4400, utilityDeposit: 1100, startDate: '2025-05-01', endDate: '2026-04-30', status: 'expiring', agent: 'You' },
];

export const sampleListings: Listing[] = [
  { id: 'P001', title: 'Mont Kiara Condo — 3 Bed', address: 'Jalan Kiara, Mont Kiara, KL', area: 'Mont Kiara', type: 'condo', status: 'available', price: 550000, bedrooms: 3, bathrooms: 2, sqft: 1350, listedAt: '2026-04-01', agent: 'You', imageUrl: '' },
  { id: 'P002', title: 'KLCC Studio — High Floor', address: 'Jalan Ampang, KLCC, KL', area: 'KLCC', type: 'condo', status: 'pending', price: 380000, bedrooms: 0, bathrooms: 1, sqft: 560, listedAt: '2026-03-20', agent: 'You', imageUrl: '' },
  { id: 'P003', title: 'Damansara Heights Office', address: 'Jalan Semantan, Damansara, KL', area: 'Damansara', type: 'office', status: 'available', price: 1200000, bedrooms: 0, bathrooms: 2, sqft: 3200, listedAt: '2026-04-10', agent: 'You', imageUrl: '' },
];

export const sampleContacts: Contact[] = [
  { id: 'C001', name: 'Ahmad Farid bin Razali', phone: '+60 12-345 6789', email: 'ahmad.farid@email.com', type: 'buyer', icNumber: '850112-14-5678', address: 'Petaling Jaya, Selangor', notes: '', createdAt: '2026-04-18', relatedListings: ['P001'] },
  { id: 'C002', name: 'Dato Lim Ah Kow', phone: '+60 12-888 9999', email: 'lim.ahkow@property.com', type: 'landlord', company: 'LAK Properties Sdn Bhd', icNumber: '650505-10-1234', address: 'Damansara Heights, KL', notes: '', createdAt: '2025-11-10', relatedListings: ['P001', 'P002'] },
];

export const activityFeed = [
  { id: 1, type: 'lead', text: 'New lead: Lee Kok Weng inquired about Cheras Landed', time: '5 min ago', icon: 'UserPlus' },
  { id: 2, type: 'ta',   text: 'TA-2025-044 expiring in 7 days — Mohd Azlan', time: '1 hour ago', icon: 'AlertTriangle' },
];
