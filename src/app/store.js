import { configureStore } from '@reduxjs/toolkit';
import authReducer         from './authSlice';
import nivaraReducer       from './nivaraSlice';

export const store = configureStore({
  reducer: {
    auth:   authReducer,
    nivara: nivaraReducer,
  },
});

export default store;