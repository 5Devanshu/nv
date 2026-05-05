import Connector from '../Connector';
import APIS      from '../Apis';

export const getDashboardApi        = ()       => Connector.get(APIS.REPORT_DASHBOARD);
export const getProjectReportApi    = (id)     => Connector.get(APIS.REPORT_PROJECT(id));
export const getSalesReportApi      = (params) => Connector.get(APIS.REPORT_SALES, { params });
export const getMonthlySalesApi     = (params) => Connector.get(APIS.REPORT_MONTHLY_SALES, { params });
export const getCollectionReportApi = (params) => Connector.get(APIS.REPORT_COLLECTIONS, { params });
export const getMonthlyCollApi      = (params) => Connector.get(APIS.REPORT_MONTHLY_COLL, { params });
export const getExpenseReportApi    = (params) => Connector.get(APIS.REPORT_EXPENSES, { params });
export const getBrokerPerfApi       = (params) => Connector.get(APIS.REPORT_BROKER_PERF, { params });
export const getInventorySnapApi    = (params) => Connector.get(APIS.REPORT_INVENTORY, { params });