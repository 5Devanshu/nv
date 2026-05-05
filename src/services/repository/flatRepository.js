import Connector from '../Connector';
import APIS      from '../Apis';

export const getFlatsApi         = (params)     => Connector.get(APIS.FLATS, { params });
export const getFlatStatsApi     = (params)     => Connector.get(APIS.FLAT_STATS, { params });
export const getFlatByIdApi      = (id)         => Connector.get(APIS.FLAT_BY_ID(id));
export const createFlatApi       = (data)       => Connector.post(APIS.FLATS, data);
export const bulkCreateFlatsApi  = (data)       => Connector.post(APIS.FLATS_BULK, data);
export const updateFlatApi       = (id, data)   => Connector.put(APIS.FLAT_BY_ID(id), data);
export const updateFlatStatusApi = (id, status) => Connector.patch(APIS.FLAT_STATUS(id), { status });
export const deleteFlatApi       = (id)         => Connector.delete(APIS.FLAT_BY_ID(id));