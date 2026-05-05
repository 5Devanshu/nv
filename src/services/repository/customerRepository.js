import Connector from '../Connector';
import APIS      from '../Apis';

export const getCustomersApi     = (params)    => Connector.get(APIS.CUSTOMERS, { params });
export const getCustomerByIdApi  = (id)        => Connector.get(APIS.CUSTOMER_BY_ID(id));
export const createCustomerApi   = (data)      => Connector.post(APIS.CUSTOMERS, data);
export const updateCustomerApi   = (id, data)  => Connector.put(APIS.CUSTOMER_BY_ID(id), data);