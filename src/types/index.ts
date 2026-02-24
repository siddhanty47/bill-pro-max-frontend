/**
 * Domain types for BillProMax frontend
 */

// ============ User & Auth ============

export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  roles: string[];
  businessIds: string[];
}

export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  currentBusinessId: string | null;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

// ============ Business ============

export interface BusinessSettings {
  billingCycle: 'monthly' | 'weekly' | 'yearly';
  currency: string;
  defaultTaxRate: number;
  defaultPaymentDueDays: number;
}

export interface Business {
  _id: string;
  name: string;
  ownerUserId: string;
  domain?: string;
  address?: string;
  phone?: string;
  email?: string;
  gst?: string;
  settings: BusinessSettings;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBusinessInput {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  gst?: string;
  settings?: Partial<BusinessSettings>;
}

// ============ Party ============

export interface PartyContact {
  person: string;
  phone: string;
  email?: string;
  address?: string;
  gst?: string;
}

/**
 * Site represents a physical location for a party
 */
export interface Site {
  code: string;
  address: string;
}

export interface AgreementRate {
  itemId: string;
  ratePerDay: number;
}

export interface Agreement {
  agreementId: string;
  /** Site code - references a site in party.sites */
  siteCode: string;
  startDate: string;
  endDate?: string;
  status: 'active' | 'expired' | 'terminated';
  terms: {
    billingCycle: 'monthly' | 'weekly' | 'yearly';
    paymentDueDays: number;
    securityDeposit?: number;
  };
  rates: AgreementRate[];
  createdAt: string;
}

export interface Party {
  _id: string;
  businessId: string;
  code: string;
  name: string;
  roles: ('client' | 'supplier')[];
  contact: PartyContact;
  /** Site addresses for the party */
  sites: Site[];
  agreements: Agreement[];
  keycloakUserId?: string;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePartyInput {
  code?: string;
  name: string;
  roles: ('client' | 'supplier')[];
  contact: PartyContact;
  notes?: string;
  /** Initial site for the party (required) */
  initialSite: {
    code?: string;
    address: string;
  };
}

export interface CreateAgreementInput {
  /** Site code - must reference an existing site in the party */
  siteCode: string;
  startDate: string;
  endDate?: string;
  terms: {
    billingCycle: 'monthly' | 'weekly' | 'yearly';
    paymentDueDays: number;
    securityDeposit?: number;
  };
  rates: AgreementRate[];
}

export interface UpdateAgreementInput {
  startDate?: string;
  endDate?: string | null;
  status?: 'active' | 'expired' | 'terminated';
  terms?: {
    billingCycle?: 'monthly' | 'weekly' | 'yearly';
    paymentDueDays?: number;
    securityDeposit?: number;
  };
}

export interface AgreementWithParty {
  agreementId: string;
  /** Site code - references a site in party.sites */
  siteCode: string;
  partyId: string;
  partyName: string;
  startDate: string;
  endDate?: string;
  status: 'active' | 'expired' | 'terminated';
  terms: {
    billingCycle: 'monthly' | 'weekly' | 'yearly';
    paymentDueDays: number;
    securityDeposit?: number;
  };
  rates: AgreementRate[];
  createdAt: string;
}

export interface AgreementRateWithItem {
  itemId: string;
  itemCode: string;
  itemName: string;
  itemCategory: string;
  ratePerDay: number;
}

export interface AddAgreementRateInput {
  itemId: string;
  ratePerDay: number;
}

export interface UpdateAgreementRateInput {
  ratePerDay: number;
}

/**
 * Input for adding a site to an existing party
 */
export interface AddSiteInput {
  code?: string;
  address: string;
}

// ============ Inventory ============

export interface PurchaseInfo {
  purchaseId?: string;
  supplierPartyId?: string;
  supplierName?: string;
  costPerUnit: number;
  date: string;
  paymentStatus: 'pending' | 'partial' | 'paid';
}

/**
 * A single quantity adjustment record (purchase, scraped, or sold)
 */
export interface QuantityTransaction {
  _id: string;
  type: 'purchase' | 'scraped' | 'sold';
  quantity: number;
  note?: string;
  date: string;
}

/**
 * Input for adjusting inventory quantity
 */
export interface AdjustQuantityInput {
  type: 'purchase' | 'scraped' | 'sold';
  quantity: number;
  /** ISO date string — must not be in the future */
  date: string;
  note?: string;
}

export interface Inventory {
  _id: string;
  businessId: string;
  code: string;
  name: string;
  category: string;
  totalQuantity: number;
  availableQuantity: number;
  rentedQuantity: number;
  unit: string;
  description?: string;
  defaultRatePerDay?: number;
  purchaseInfo?: PurchaseInfo;
  quantityHistory?: QuantityTransaction[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInventoryInput {
  code: string;
  name: string;
  category: string;
  totalQuantity: number;
  unit: string;
  description?: string;
  defaultRatePerDay?: number;
  purchaseInfo?: {
    supplierPartyId?: string;
    supplierName?: string;
    costPerUnit: number;
    date: string;
    paymentStatus: 'pending' | 'partial' | 'paid';
  };
}

export interface InventoryStats {
  totalItems: number;
  totalQuantity: number;
  availableQuantity: number;
  rentedQuantity: number;
  categories: string[];
}

// ============ Challan ============

export interface ChallanItem {
  itemId: string;
  itemName: string;
  quantity: number;
  condition: 'good' | 'damaged' | 'missing';
}

export interface Challan {
  _id: string;
  businessId: string;
  challanNumber: string;
  type: 'delivery' | 'return';
  partyId: string;
  agreementId: string;
  date: string;
  items: ChallanItem[];
  status: 'draft' | 'confirmed' | 'cancelled';
  confirmedBy?: string;
  confirmedAt?: string;
  signature?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChallanInput {
  type: 'delivery' | 'return';
  partyId: string;
  agreementId: string;
  date: string;
  items: {
    itemId: string;
    itemName: string;
    quantity: number;
    condition?: 'good' | 'damaged' | 'missing';
  }[];
  notes?: string;
}

/** Net quantity of an item currently held by a party (delivery minus returns). */
export interface ItemWithParty {
  itemId: string;
  itemName: string;
  quantity: number;
}

// ============ Bill ============

export interface BillItem {
  itemId: string;
  itemName: string;
  quantity: number;
  ratePerDay: number;
  totalDays: number;
  amount: number;
}

export interface Bill {
  _id: string;
  businessId: string;
  billNumber: string;
  partyId: string;
  agreementId: string;
  billingPeriod: {
    start: string;
    end: string;
  };
  items: BillItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountRate: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;
  status: 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled';
  dueDate: string;
  pdfUrl?: string;
  sentAt?: string;
  paidAt?: string;
  amountPaid: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateBillInput {
  partyId: string;
  agreementId: string;
  billingPeriod: {
    start: string;
    end: string;
  };
  taxRate?: number;
  discountRate?: number;
  notes?: string;
}

// ============ Payment ============

export interface Payment {
  _id: string;
  businessId: string;
  type: 'receivable' | 'payable';
  partyId: string;
  billId?: string;
  purchaseId?: string;
  amount: number;
  currency: string;
  method: 'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'other';
  reference?: string;
  date: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentInput {
  type: 'receivable' | 'payable';
  partyId: string;
  billId?: string;
  purchaseId?: string;
  amount: number;
  method: 'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'other';
  reference?: string;
  date: string;
  notes?: string;
}

export interface PaymentStats {
  totalReceivable: number;
  totalPayable: number;
  pendingReceivable: number;
  pendingPayable: number;
}

// ============ GSTIN Lookup ============

/**
 * GSTIN details returned from the lookup API.
 * Used to auto-fill party and business forms.
 */
export interface GstinDetails {
  /** The GSTIN number */
  gstin: string;
  /** Legal name of the business */
  legalName: string;
  /** Trade name of the business */
  tradeName: string;
  /** Formatted principal address */
  address: string;
  /** Registration status (Active, Cancelled, Suspended, etc.) */
  status: string;
  /** Constitution of business (Proprietorship, Partnership, Pvt Ltd, etc.) */
  businessType: string;
  /** Type of GST registration (Regular, Composition, etc.) */
  registrationType: string;
  /** Date of GST registration */
  registrationDate: string;
  /** State jurisdiction */
  stateJurisdiction: string;
  /** Central jurisdiction */
  centralJurisdiction: string;
  /** Nature of business activities */
  businessActivities: string[];
  /** Whether the GSTIN is valid and active */
  isActive: boolean;
}

// ============ API Response ============

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  timestamp: string;
  requestId?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  message: string;
  timestamp: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
  requestId?: string;
}
