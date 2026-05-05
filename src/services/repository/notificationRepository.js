import Connector from '../Connector';
import APIS      from '../Apis';

export const sendPaymentReceiptApi   = (data)   => Connector.post(APIS.NOTIF_PAYMENT_RECEIPT, data);
export const sendPaymentReminderApi  = (data)   => Connector.post(APIS.NOTIF_PAYMENT_REMINDER, data);
export const sendBookingConfirmedApi = (data)   => Connector.post(APIS.NOTIF_BOOKING_CONFIRMED, data);
export const sendOverdueAlertsApi    = (data)   => Connector.post(APIS.NOTIF_OVERDUE_ALERTS, data);
export const sendCustomApi           = (data)   => Connector.post(APIS.NOTIF_CUSTOM, data);
export const getNotifLogApi          = (params) => Connector.get(APIS.NOTIF_LOG, { params });
export const getNotifLogByBookingApi = (id)     => Connector.get(APIS.NOTIF_LOG_BOOKING(id));
export const getNotifLogByCustomerApi= (id)     => Connector.get(APIS.NOTIF_LOG_CUSTOMER(id));