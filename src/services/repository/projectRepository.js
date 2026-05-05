import Connector from '../Connector';
import APIS      from '../Apis';

export const getProjectsApi       = (params)      => Connector.get(APIS.PROJECTS, { params });
export const getProjectSummaryApi = ()            => Connector.get(APIS.PROJECT_SUMMARY);
export const getProjectByIdApi    = (id)          => Connector.get(APIS.PROJECT_BY_ID(id));
export const createProjectApi     = (data)        => Connector.post(APIS.PROJECTS, data);
export const updateProjectApi     = (id, data)    => Connector.put(APIS.PROJECT_BY_ID(id), data);
export const deleteProjectApi     = (id)          => Connector.delete(APIS.PROJECT_BY_ID(id));

export const getConfigsApi        = (id)          => Connector.get(APIS.PROJECT_CONFIGS(id));
export const addConfigApi         = (id, data)    => Connector.post(APIS.PROJECT_CONFIGS(id), data);
export const removeConfigApi      = (id, cid)     => Connector.delete(APIS.PROJECT_CONFIG_BY_ID(id, cid));