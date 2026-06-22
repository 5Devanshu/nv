const BASE = import.meta.env.VITE_API_BASE_URL;

// Debug: Log the base URL
if (!BASE) {
  console.error('❌ VITE_API_BASE_URL is not set!');
} else {
  console.log('✅ API Base URL:', BASE);
}

const APIS = {
  // ─── Auth ──────────────────────────────────────────────────
  LOGIN:   `${BASE}/api/auth/login`,
  LOGOUT:  `${BASE}/api/auth/logout`,
  PROFILE: `${BASE}/api/auth/profile`,

  // ─── Projects ──────────────────────────────────────────────
  PROJECTS:             `${BASE}/api/projects`,
  PROJECT_BY_ID:        (id)      => `${BASE}/api/projects/${id}`,
  PROJECT_SUMMARY:      `${BASE}/api/projects/summary`,
  PROJECT_CONFIGS:      (id)      => `${BASE}/api/projects/${id}/configurations`,
  PROJECT_CONFIG_BY_ID: (id, cid) => `${BASE}/api/projects/${id}/configurations/${cid}`,

    // ─── Flats ─────────────────────────────────────────────────
  FLATS:            `${BASE}/api/flats`,
  FLATS_BULK:       `${BASE}/api/flats/bulk`,
  FLAT_STATS:       `${BASE}/api/flats/stats`,
  FLAT_BY_ID:       (id) => `${BASE}/api/flats/${id}`,
  FLAT_STATUS:      (id) => `${BASE}/api/flats/${id}/status`,
  
    // Customers
  CUSTOMERS:       `${BASE}/api/bookings/customers`,
  CUSTOMER_BY_ID:  (id) => `${BASE}/api/bookings/customers/${id}`,

  // Bookings
  BOOKINGS:             `${BASE}/api/bookings`,
  BOOKING_BY_ID:        (id)       => `${BASE}/api/bookings/${id}`,
  BOOKING_CANCEL:       (id)       => `${BASE}/api/bookings/${id}/cancel`,
  BOOKING_STATUS:       (id)       => `${BASE}/api/bookings/${id}/status`,
  BOOKING_SCHEDULE:     (id)       => `${BASE}/api/bookings/${id}/schedule`,
  BOOKING_SCHEDULE_DEL: (id, sid)  => `${BASE}/api/bookings/${id}/schedule/${sid}`,

    // Payments
  PAYMENTS:                `${BASE}/api/payments`,
  PAYMENT_BY_ID:           (id)        => `${BASE}/api/payments/${id}`,
  PAYMENTS_BY_BOOKING:     (bookingId) => `${BASE}/api/payments/booking/${bookingId}`,
  BOOKING_LEDGER:          (bookingId) => `${BASE}/api/payments/booking/${bookingId}/ledger`,
  PAYMENTS_OVERDUE:        `${BASE}/api/payments/overdue`,
  PAYMENTS_OUTSTANDING:    `${BASE}/api/payments/outstanding`,
  PAYMENTS_MONTHLY_SUMMARY:`${BASE}/api/payments/monthly-summary`,

    // Ledger
  LEDGER_ALL:           `${BASE}/api/ledger`,
  LEDGER_CUSTOMER:      (id) => `${BASE}/api/ledger/customer/${id}`,
  LEDGER_STATEMENT:     (id) => `${BASE}/api/ledger/customer/${id}/statement`,
  LEDGER_BOOKING:       (id) => `${BASE}/api/ledger/booking/${id}`,
  LEDGER_OVERDUE:       `${BASE}/api/ledger/overdue`,
  LEDGER_FULLY_PAID:    `${BASE}/api/ledger/fully-paid`,

    // Brokers
  BROKERS:                    `${BASE}/api/brokers`,
  BROKER_SUMMARY:             `${BASE}/api/brokers/summary`,
  BROKER_BY_ID:               (id)       => `${BASE}/api/brokers/${id}`,
  BROKER_ACTIVATE:            (id)       => `${BASE}/api/brokers/${id}/activate`,
  BROKER_DEACTIVATE:          (id)       => `${BASE}/api/brokers/${id}/deactivate`,
  BROKER_COMMISSIONS:         (id)       => `${BASE}/api/brokers/${id}/commissions`,
  BROKER_COMMISSION_SUMMARY:  (id)       => `${BASE}/api/brokers/${id}/commissions/summary`,
  BROKER_COMMISSION_PAY:      (id, cid)  => `${BASE}/api/brokers/${id}/commissions/${cid}/pay`,
  BROKER_COMMISSION_PAYMENTS: (id, cid)  => `${BASE}/api/brokers/${id}/commissions/${cid}/payments`,
  COMMISSIONS_PENDING:        `${BASE}/api/brokers/commissions/pending`,
  COMMISSIONS_ALL:            `${BASE}/api/brokers/commissions/all`,

    // Expenses
  EXPENSE_CATEGORIES:          `${BASE}/api/expenses/categories`,
  EXPENSE_CATEGORY_DEACTIVATE: (cid) => `${BASE}/api/expenses/categories/${cid}/deactivate`,
  EXPENSES:                    `${BASE}/api/expenses`,
  EXPENSE_BY_ID:               (id)        => `${BASE}/api/expenses/${id}`,
  EXPENSES_SUMMARY:            `${BASE}/api/expenses/summary`,
  EXPENSES_UNPAID:             `${BASE}/api/expenses/unpaid`,
  EXPENSES_BY_PROJECT:         (projectId) => `${BASE}/api/expenses/by-project/${projectId}`,
  EXPENSE_PAY:                 (id)        => `${BASE}/api/expenses/${id}/pay`,
  EXPENSE_PAYMENTS:            (id)        => `${BASE}/api/expenses/${id}/payments`,

    // Reports
  REPORT_DASHBOARD:        `${BASE}/api/reports/dashboard`,
  REPORT_PROJECT:          (id) => `${BASE}/api/reports/project/${id}`,
  REPORT_SALES:            `${BASE}/api/reports/sales`,
  REPORT_MONTHLY_SALES:    `${BASE}/api/reports/sales/monthly`,
  REPORT_COLLECTIONS:      `${BASE}/api/reports/collections`,
  REPORT_MONTHLY_COLL:     `${BASE}/api/reports/collections/monthly`,
  REPORT_EXPENSES:         `${BASE}/api/reports/expenses`,
  REPORT_BROKER_PERF:      `${BASE}/api/reports/broker-performance`,
  REPORT_INVENTORY:        `${BASE}/api/reports/inventory`,

    // Documents
  DOCUMENT_UPLOAD:        `${BASE}/api/documents/upload`,
  DOCUMENTS:              `${BASE}/api/documents`,
  DOCUMENT_BY_ID:         (id) => `${BASE}/api/documents/${id}`,
  DOCUMENT_DOWNLOAD:      (id) => `${BASE}/api/documents/${id}/download`,
  DOCUMENT_LABEL:         (id) => `${BASE}/api/documents/${id}/label`,
  DOCS_BY_BOOKING:        (bookingId)   => `${BASE}/api/documents/booking/${bookingId}`,
  DOCS_BY_CUSTOMER:       (customerId)  => `${BASE}/api/documents/customer/${customerId}`,
  DOCS_BY_PROJECT:        (projectId)   => `${BASE}/api/documents/project/${projectId}`,
  DOCS_BY_FLAT:           (flatId)      => `${BASE}/api/documents/flat/${flatId}`,
  DOCS_BY_EXPENSE:        (expenseId)   => `${BASE}/api/documents/expense/${expenseId}`,

  // Notifications
  NOTIF_PAYMENT_RECEIPT:   `${BASE}/api/notifications/payment-receipt`,
  NOTIF_PAYMENT_REMINDER:  `${BASE}/api/notifications/payment-reminder`,
  NOTIF_BOOKING_CONFIRMED: `${BASE}/api/notifications/booking-confirmed`,
  NOTIF_OVERDUE_ALERTS:    `${BASE}/api/notifications/overdue-alerts`,
  NOTIF_CUSTOM:            `${BASE}/api/notifications/custom`,
  NOTIF_LOG:               `${BASE}/api/notifications/log`,
  NOTIF_LOG_BOOKING:       (bookingId)  => `${BASE}/api/notifications/log/booking/${bookingId}`,
  NOTIF_LOG_CUSTOMER:      (customerId) => `${BASE}/api/notifications/log/customer/${customerId}`,
};

export default APIS;