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
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  currentBusinessId: string | null;
}

// ============ Business Member ============

export interface BusinessMember {
  _id: string;
  businessId: string;
  userId: string;
  email: string;
  name?: string;
  role: string;
  joinedAt: string;
  invitedBy?: string;
}

// ============ Invitation ============

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';

export interface Invitation {
  _id: string;
  businessId: string;
  email: string;
  role: string;
  invitedBy: string;
  inviterName?: string;
  businessName?: string;
  status: InvitationStatus;
  token: string;
  expiresAt: string;
  createdAt: string;
}

export interface CreateInvitationInput {
  email: string;
  role: string;
}

// ============ In-App Notification ============

export type NotificationType = 'invitation' | 'system' | 'info';

export interface AppNotification {
  _id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, string>;
  isRead: boolean;
  createdAt: string;
}

// ============ Business ============

export interface BusinessSettings {
  billingCycle: 'monthly' | 'weekly' | 'yearly';
  currency: string;
  defaultTaxRate: number;
  defaultSgstRate?: number;
  defaultCgstRate?: number;
  defaultIgstRate?: number;
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
  stateCode?: string;
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
  stateCode?: string;
  settings?: Partial<BusinessSettings>;
}

export interface UpdateBusinessInput {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  gst?: string;
  stateCode?: string;
  settings?: Partial<BusinessSettings>;
}

// ============ Party ============

export interface PartyContact {
  person: string;
  phone: string;
  email?: string;
  address?: string;
  gst?: string;
  stateCode?: string;
}

/**
 * Site represents a physical location for a party
 */
export interface Site {
  code: string;
  address: string;
  stateCode?: string;
}

export interface AgreementRate {
  itemId: string;
  ratePerDay: number;
  openingBalance?: number;
}

export interface AgreementTerms {
  billingCycle: 'monthly' | 'weekly' | 'yearly';
  paymentDueDays: number;
  securityDeposit?: number;
  deliveryCartage?: number;
  returnCartage?: number;
  loadingCharge?: number;
  unloadingCharge?: number;
}

export interface Agreement {
  agreementId: string;
  /** Site code - references a site in party.sites */
  siteCode: string;
  startDate: string;
  endDate?: string;
  status: 'active' | 'expired' | 'terminated';
  terms: AgreementTerms;
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
  authProviderId?: string;
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
    stateCode?: string;
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
    deliveryCartage?: number;
    returnCartage?: number;
    loadingCharge?: number;
    unloadingCharge?: number;
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
    deliveryCartage?: number;
    returnCartage?: number;
    loadingCharge?: number;
    unloadingCharge?: number;
  };
}

export interface AgreementWithParty {
  agreementId: string;
  /** Site code - references a site in party.sites */
  siteCode: string;
  siteAddress?: string;
  siteStateCode?: string;
  partyId: string;
  partyName: string;
  startDate: string;
  endDate?: string;
  status: 'active' | 'expired' | 'terminated';
  terms: AgreementTerms;
  rates: AgreementRate[];
  createdAt: string;
}

export interface AgreementRateWithItem {
  itemId: string;
  itemCode: string;
  itemName: string;
  itemCategory: string;
  ratePerDay: number;
  openingBalance: number;
}

export interface AddAgreementRateInput {
  itemId: string;
  ratePerDay: number;
  openingBalance?: number;
}

export interface UpdateAgreementRateInput {
  ratePerDay?: number;
  openingBalance?: number;
}

/**
 * Input for adding a site to an existing party
 */
export interface AddSiteInput {
  code?: string;
  address: string;
  stateCode?: string;
}

/**
 * Input for updating an existing site on a party
 */
export interface UpdateSiteInput {
  code?: string;
  address?: string;
  stateCode?: string;
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
 * A single quantity adjustment record (purchase, scraped, sold, damaged, or short)
 */
export interface QuantityTransaction {
  _id: string;
  type: 'purchase' | 'scraped' | 'sold' | 'damaged' | 'short' | 'challan_loss_edit' | 'challan_item_edit' | 'challan_delivery' | 'challan_return' | 'challan_delivery_reversed' | 'challan_return_reversed';
  quantity: number;
  note?: string;
  date: string;
  rentedDelta?: number;
  challanType?: 'delivery' | 'return';
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
  /** @deprecated Compute from quantityHistory using computeRentedFromHistory */
  availableQuantity?: number;
  /** @deprecated Compute from quantityHistory using computeRentedFromHistory */
  rentedQuantity?: number;
  unit: string;
  description?: string;
  defaultRatePerDay?: number;
  damageRate?: number;
  costPrice?: number;
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
  damageRate?: number;
  costPrice?: number;
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
}

export interface DamagedItem {
  itemId: string;
  itemName: string;
  quantity: number;
  damageRate: number;
  note?: string;
  lossType?: 'damage' | 'short' | 'need_repair';
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
  damagedItems?: DamagedItem[];
  status: 'draft' | 'confirmed' | 'cancelled';
  confirmedBy?: string;
  confirmedAt?: string;
  signature?: string;
  notes?: string;
  transporterName?: string;
  vehicleNumber?: string;
  cartageCharge?: number;
  loadingCharge?: number;
  unloadingCharge?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChallanInput {
  type: 'delivery' | 'return';
  partyId: string;
  agreementId: string;
  date: string;
  challanSequence?: number;
  items: {
    itemId: string;
    itemName: string;
    quantity: number;
  }[];
  damagedItems?: {
    itemId: string;
    itemName: string;
    quantity: number;
    damageRate: number;
    note?: string;
    lossType?: 'damage' | 'short' | 'need_repair';
  }[];
  notes?: string;
  transporterName?: string;
  vehicleNumber?: string;
  cartageCharge?: number;
  loadingCharge?: number;
  unloadingCharge?: number;
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

export interface DamageBillItem {
  itemId: string;
  itemName: string;
  quantity: number;
  damageRate: number;
  amount: number;
  note?: string;
  challanNumber?: string;
}

export interface TransportationBreakupItem {
  challanNumber: string;
  challanType: 'delivery' | 'return';
  cartageCharge: number;
  loadingCharge: number;
  unloadingCharge: number;
  totalCharge: number;
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
  /** Bill date (optional for legacy bills; UI/PDF fallback to period end or createdAt) */
  billDate?: string;
  items: BillItem[];
  subtotal: number;
  taxMode?: 'intra' | 'inter';
  taxRate?: number;
  sgstRate?: number;
  cgstRate?: number;
  igstRate?: number;
  sgstAmount?: number;
  cgstAmount?: number;
  igstAmount?: number;
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
  transportationCharges?: number;
  damageItems?: DamageBillItem[];
  damageCharges?: number;
  transportationBreakup?: TransportationBreakupItem[];
  isStale?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateBillInput {
  billDate: string;
  partyId: string;
  agreementId: string;
  billingPeriod: {
    start: string;
    end: string;
  };
  billSequence?: number;
  taxMode?: 'intra' | 'inter';
  taxRate?: number;
  sgstRate?: number;
  cgstRate?: number;
  igstRate?: number;
  discountRate?: number;
  notes?: string;
}

export interface BulkGenerateBillInput {
  billDate: string;
  billingPeriod: {
    start: string;
    end: string;
  };
  taxMode?: 'intra' | 'inter';
  sgstRate?: number;
  cgstRate?: number;
  igstRate?: number;
  discountRate?: number;
  notes?: string;
  agreements: Array<{
    partyId: string;
    agreementId: string;
  }>;
}

export interface BillGenerationResponse {
  batchId: string;
  jobCount: number;
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

// ============ Employee ============

export type EmployeeType = 'transporter' | 'general' | 'worker' | 'operator' | 'supervisor';

export type SalaryType = 'monthly' | 'daily';

export interface TransporterDetails {
  vehicleNumber: string;
}

export interface EmergencyContact {
  name: string;
  phone: string;
}

export interface Employee {
  _id: string;
  businessId: string;
  name: string;
  phone?: string;
  type: EmployeeType;
  details?: TransporterDetails;
  designation?: string;
  address?: string;
  joiningDate?: string;
  salaryType?: SalaryType;
  monthlySalary?: number;
  dailyRate?: number;
  overtimeRatePerHour?: number;
  emergencyContact?: EmergencyContact;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeeInput {
  name: string;
  phone?: string;
  type: EmployeeType;
  details?: TransporterDetails;
  designation?: string;
  address?: string;
  joiningDate?: string;
  salaryType?: SalaryType;
  monthlySalary?: number;
  dailyRate?: number;
  overtimeRatePerHour?: number;
  emergencyContact?: EmergencyContact;
  notes?: string;
}

export interface UpdateEmployeeInput {
  name?: string;
  phone?: string;
  details?: Partial<TransporterDetails>;
  designation?: string;
  address?: string;
  joiningDate?: string;
  salaryType?: SalaryType;
  monthlySalary?: number;
  dailyRate?: number;
  overtimeRatePerHour?: number;
  emergencyContact?: Partial<EmergencyContact>;
  notes?: string;
}

// ============ Attendance ============

export type AttendanceStatus = 'present' | 'absent' | 'half-day' | 'leave';

export interface Attendance {
  _id: string;
  businessId: string;
  employeeId: string;
  date: string;
  status: AttendanceStatus;
  overtimeHours?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MarkAttendanceInput {
  date: string;
  status: AttendanceStatus;
  overtimeHours?: number;
  notes?: string;
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  halfDay: number;
  leave: number;
  totalDays: number;
  workingDays: number;
  effectiveDays: number;
  overtimeHours: number;
  sundaysWorked: number;
}

export interface SalaryBreakdown {
  month: number;
  year: number;
  workingDays: number;
  effectiveDays: number;
  overtimeHours: number;
  sundaysWorked: number;
  salaryType: 'monthly' | 'daily' | null;
  monthlySalary: number;
  dailyRate: number;
  overtimeRatePerHour: number;
  baseSalary: number;
  overtimePay: number;
  totalPay: number;
}

// ============ ShareLink ============

export type ShareLinkStatus = 'active' | 'revoked';

export interface ShareLink {
  _id: string;
  businessId: string;
  partyId: string;
  token: string;
  siteCode?: string;
  label?: string;
  expiresAt?: string;
  status: ShareLinkStatus;
  createdBy: string;
  lastAccessedAt?: string;
  accessCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateShareLinkInput {
  siteCode?: string;
  expiresAt?: string;
  label?: string;
}

export interface UpdateShareLinkInput {
  expiresAt?: string | null;
  label?: string;
}

export interface PortalInfo {
  partyName: string;
  partyCode: string;
  businessName: string;
  siteCode: string | null;
  siteName: string | null;
}

export interface PortalSummary {
  totalOutstanding: number;
  totalBilled: number;
  totalPaid: number;
  totalItemsInUse: number;
  itemsBreakdown: PortalRunningItem[];
  billCount: number;
  overdueBills: number;
}

export interface PortalChallan {
  _id: string;
  challanNumber: string;
  type: 'delivery' | 'return';
  date: string;
  agreementId: string;
  items: { itemName: string; quantity: number }[];
  status: string;
}

export interface PortalBill {
  _id: string;
  billNumber: string;
  billingPeriod: { start: string; end: string };
  billDate?: string;
  totalAmount: number;
  amountPaid: number;
  status: string;
  dueDate: string;
}

export interface PortalRunningItem {
  itemName: string;
  quantity: number;
}

// ============ Inventory Preset ============

export interface PresetItem {
  code: string;
  name: string;
  category: string;
  unit: string;
  description?: string;
  defaultRatePerDay?: number;
  damageRate?: number;
  costPrice?: number;
}

export interface InventoryPreset {
  _id: string;
  name: string;
  description?: string;
  tags: string[];
  items: PresetItem[];
  isSystem: boolean;
  isPublic: boolean;
  createdBy?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PresetSummary {
  _id: string;
  name: string;
  description?: string;
  tags: string[];
  itemCount: number;
  isSystem: boolean;
  isPublic: boolean;
  createdBy?: string;
}

export interface ImportPresetResult {
  imported: number;
  skipped: number;
  total: number;
  importedItems: Array<{ code: string; name: string }>;
  skippedItems: Array<{ code: string; name: string; reason: string }>;
}

export interface CreatePresetInput {
  name: string;
  description?: string;
  tags?: string[];
  items: Array<{
    code: string;
    name: string;
    category: string;
    unit: string;
    description?: string;
    defaultRatePerDay?: number;
    damageRate?: number;
    costPrice?: number;
  }>;
}

// ============ Statement Preview ============

export interface StatementBusiness {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  gst?: string;
}

export interface StatementParty {
  name: string;
  code: string;
  address?: string;
  phone?: string;
  gst?: string;
}

export interface StatementPeriod {
  from: string;
  to: string;
}

export interface LedgerEntry {
  date: string;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
  billId?: string;
}

export interface LedgerStatementData {
  type: 'ledger';
  business: StatementBusiness;
  party: StatementParty;
  period: StatementPeriod;
  openingBalance: number;
  entries: LedgerEntry[];
  totalDebits: number;
  totalCredits: number;
  closingBalance: number;
  currency: string;
}

export interface BillStatementRow {
  billId: string;
  billNumber: string;
  billDate: string;
  periodStart?: string;
  periodEnd?: string;
  siteCode: string;
  rentCharges: number;
  transportationCharges: number;
  damageCharges: number;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
}

export interface BillStatementTotals {
  rentCharges: number;
  transportationCharges: number;
  damageCharges: number;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  billCount: number;
}

export interface BillStatementData {
  type: 'bills';
  business: StatementBusiness;
  party: StatementParty;
  period: StatementPeriod;
  siteCode?: string;
  bills: BillStatementRow[];
  totals: BillStatementTotals;
  currency: string;
}

export interface ItemEvent {
  date: string;
  challanNumber: string;
  challanId: string;
  type: 'delivery' | 'return';
  quantity: number;
  runningQty: number;
}

export interface ItemDamages {
  damaged: number;
  short: number;
  needRepair: number;
}

export interface ItemStatementItem {
  itemName: string;
  itemId: string;
  openingQty: number;
  events: ItemEvent[];
  totalDelivered: number;
  totalReturned: number;
  closingQty: number;
  damages: ItemDamages;
}

export interface ItemStatementData {
  type: 'items';
  business: StatementBusiness;
  party: StatementParty;
  period: StatementPeriod;
  items: ItemStatementItem[];
  grandTotals: {
    totalDelivered: number;
    totalReturned: number;
    netHeld: number;
    totalDamaged: number;
    totalShort: number;
  };
}

export interface AgingBill {
  billId: string;
  billNumber: string;
  billDate: string;
  dueDate: string;
  daysOverdue: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  bucket: string;
}

export interface AgingBuckets {
  current: number;
  days31_60: number;
  days61_90: number;
  days90Plus: number;
}

export interface AgingStatementData {
  type: 'aging';
  business: StatementBusiness;
  party: StatementParty;
  asOfDate: string;
  bills: AgingBill[];
  buckets: AgingBuckets;
  grandTotal: number;
  currency: string;
}

export type StatementData =
  | LedgerStatementData
  | BillStatementData
  | ItemStatementData
  | AgingStatementData;

// ============ Audit Log ============

export interface AuditFieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface AuditLogEntry {
  _id: string;
  businessId: string;
  documentId: string;
  documentType: string;
  action: 'created' | 'updated' | 'deleted';
  changes: AuditFieldChange[];
  performedBy: {
    userId: string;
    name: string;
  };
  createdAt: string;
}

export interface PortalPayment {
  _id: string;
  amount: number;
  method: 'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'other';
  date: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  reference: string | null;
  notes: string | null;
}
