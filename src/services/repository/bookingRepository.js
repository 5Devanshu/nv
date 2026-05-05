import Connector from '../Connector';
import APIS      from '../Apis';

export const getBookingsApi        = (params)      => Connector.get(APIS.BOOKINGS, { params });
export const getBookingByIdApi     = (id)          => Connector.get(APIS.BOOKING_BY_ID(id));
export const createBookingApi      = (data)        => Connector.post(APIS.BOOKINGS, data);
export const updateBookingApi      = (id, data)    => Connector.put(APIS.BOOKING_BY_ID(id), data);
export const cancelBookingApi      = (id, data)    => Connector.patch(APIS.BOOKING_CANCEL(id), data);
export const updateBookingStatusApi= (id, status)  => Connector.patch(APIS.BOOKING_STATUS(id), { status });
export const getScheduleApi        = (id)          => Connector.get(APIS.BOOKING_SCHEDULE(id));
export const addScheduleApi        = (id, data)    => Connector.post(APIS.BOOKING_SCHEDULE(id), data);
export const removeScheduleApi     = (id, sid)     => Connector.delete(APIS.BOOKING_SCHEDULE_DEL(id, sid));