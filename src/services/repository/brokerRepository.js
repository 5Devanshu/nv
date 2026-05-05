import Connector from '../Connector';
import APIS      from '../Apis';

export const getBrokersApi               = (params)      => Connector.get(APIS.BROKERS, { params });
export const getBrokerSummaryApi         = ()            => Connector.get(APIS.BROKER_SUMMARY);
export const getBrokerByIdApi            = (id)          => Connector.get(APIS.BROKER_BY_ID(id));
export const createBrokerApi             = (data)        => Connector.post(APIS.BROKERS, data);
export const updateBrokerApi             = (id, data)    => Connector.put(APIS.BROKER_BY_ID(id), data);
export const activateBrokerApi           = (id)          => Connector.patch(APIS.BROKER_ACTIVATE(id));
export const deactivateBrokerApi         = (id)          => Connector.patch(APIS.BROKER_DEACTIVATE(id));
export const getBrokerCommissionsApi     = (id, params)  => Connector.get(APIS.BROKER_COMMISSIONS(id), { params });
export const getBrokerCommissionSummaryApi = (id)        => Connector.get(APIS.BROKER_COMMISSION_SUMMARY(id));
export const createCommissionApi         = (id, data)    => Connector.post(APIS.BROKER_COMMISSIONS(id), data);
export const payCommissionApi            = (id, cid, data) => Connector.patch(APIS.BROKER_COMMISSION_PAY(id, cid), data);
export const getCommissionPaymentsApi    = (id, cid)     => Connector.get(APIS.BROKER_COMMISSION_PAYMENTS(id, cid));
export const getPendingCommissionsApi    = (params)      => Connector.get(APIS.COMMISSIONS_PENDING, { params });
export const getAllCommissionsApi         = (params)      => Connector.get(APIS.COMMISSIONS_ALL, { params });