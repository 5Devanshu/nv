import Connector from '../Connector';
import APIS      from '../Apis';

export const recordPaymentApi      = (data)        => Connector.post(APIS.PAYMENTS, data);
export const getPaymentsApi        = (params)      => Connector.get(APIS.PAYMENTS, { params });
export const getPaymentByIdApi     = (id)          => Connector.get(APIS.PAYMENT_BY_ID(id));
export const getPaymentsByBookingApi = (bookingId) => Connector.get(APIS.PAYMENTS_BY_BOOKING(bookingId));
export const getBookingLedgerApi   = (bookingId)   => Connector.get(APIS.BOOKING_LEDGER(bookingId));
export const getOverdueApi         = (params)      => Connector.get(APIS.PAYMENTS_OVERDUE, { params });
export const getOutstandingApi     = (params)      => Connector.get(APIS.PAYMENTS_OUTSTANDING, { params });
export const getMonthlySummaryApi  = (params)      => Connector.get(APIS.PAYMENTS_MONTHLY_SUMMARY, { params });
export const updatePaymentApi      = (id, data)    => Connector.put(APIS.PAYMENT_BY_ID(id), data);
export const deletePaymentApi      = (id)          => Connector.delete(APIS.PAYMENT_BY_ID(id));