import Connector from '../Connector';
import APIS      from '../Apis';

export const getAllCustomerSummariesApi = (params)    => Connector.get(APIS.LEDGER_ALL, { params });
export const getCustomerLedgerApi      = (id)        => Connector.get(APIS.LEDGER_CUSTOMER(id));
export const getStatementApi           = (id, params)=> Connector.get(APIS.LEDGER_STATEMENT(id), { params });
export const getBookingLedgerApi       = (id)        => Connector.get(APIS.LEDGER_BOOKING(id));
export const getOverdueCustomersApi    = (params)    => Connector.get(APIS.LEDGER_OVERDUE, { params });
export const getFullyPaidCustomersApi  = (params)    => Connector.get(APIS.LEDGER_FULLY_PAID, { params });