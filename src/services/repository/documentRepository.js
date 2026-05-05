import Connector from '../Connector';
import APIS      from '../Apis';

// Upload uses multipart/form-data — FormData object passed directly
export const uploadDocumentApi    = (formData)    =>
  Connector.post(APIS.DOCUMENT_UPLOAD, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const getDocumentsApi      = (params)      => Connector.get(APIS.DOCUMENTS, { params });
export const getDocumentByIdApi   = (id)          => Connector.get(APIS.DOCUMENT_BY_ID(id));
export const updateDocLabelApi    = (id, doc_label) => Connector.patch(APIS.DOCUMENT_LABEL(id), { doc_label });
export const deleteDocumentApi    = (id)          => Connector.delete(APIS.DOCUMENT_BY_ID(id));
export const getDocsByBookingApi  = (bookingId)   => Connector.get(APIS.DOCS_BY_BOOKING(bookingId));
export const getDocsByCustomerApi = (customerId)  => Connector.get(APIS.DOCS_BY_CUSTOMER(customerId));
export const getDocsByProjectApi  = (projectId)   => Connector.get(APIS.DOCS_BY_PROJECT(projectId));
export const getDocsByFlatApi     = (flatId)      => Connector.get(APIS.DOCS_BY_FLAT(flatId));
export const getDocsByExpenseApi  = (expenseId)   => Connector.get(APIS.DOCS_BY_EXPENSE(expenseId));

// Download — returns a blob URL the browser can open/download
export const downloadDocumentApi  = (id) =>
  Connector.get(APIS.DOCUMENT_DOWNLOAD(id), { responseType: 'blob' });