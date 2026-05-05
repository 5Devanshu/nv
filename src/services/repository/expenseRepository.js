import Connector from '../Connector';
import APIS      from '../Apis';

export const getCategoriesApi         = ()           => Connector.get(APIS.EXPENSE_CATEGORIES);
export const createCategoryApi        = (data)       => Connector.post(APIS.EXPENSE_CATEGORIES, data);
export const deactivateCategoryApi    = (cid)        => Connector.patch(APIS.EXPENSE_CATEGORY_DEACTIVATE(cid));
export const getExpensesApi           = (params)     => Connector.get(APIS.EXPENSES, { params });
export const getExpenseSummaryApi     = (params)     => Connector.get(APIS.EXPENSES_SUMMARY, { params });
export const getUnpaidExpensesApi     = (params)     => Connector.get(APIS.EXPENSES_UNPAID, { params });
export const getExpensesByProjectApi  = (id, params) => Connector.get(APIS.EXPENSES_BY_PROJECT(id), { params });
export const getExpenseByIdApi        = (id)         => Connector.get(APIS.EXPENSE_BY_ID(id));
export const createExpenseApi         = (data)       => Connector.post(APIS.EXPENSES, data);
export const updateExpenseApi         = (id, data)   => Connector.put(APIS.EXPENSE_BY_ID(id), data);
export const deleteExpenseApi         = (id)         => Connector.delete(APIS.EXPENSE_BY_ID(id));
export const payExpenseApi            = (id, data)   => Connector.post(APIS.EXPENSE_PAY(id), data);
export const getExpensePaymentsApi    = (id)         => Connector.get(APIS.EXPENSE_PAYMENTS(id));