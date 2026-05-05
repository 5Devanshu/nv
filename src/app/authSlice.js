import { createSlice } from '@reduxjs/toolkit';

const token = localStorage.getItem('nivara_token');
const user  = JSON.parse(localStorage.getItem('nivara_user') || 'null');

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    token: token || null,
    user:  user  || null,
    isAuthenticated: !!token,
  },
  reducers: {
    setCredentials: (state, { payload }) => {
      state.token           = payload.token;
      state.user            = payload.user;
      state.isAuthenticated = true;
      localStorage.setItem('nivara_token', payload.token);
      localStorage.setItem('nivara_user',  JSON.stringify(payload.user));
    },
    clearCredentials: (state) => {
      state.token           = null;
      state.user            = null;
      state.isAuthenticated = false;
      localStorage.removeItem('nivara_token');
      localStorage.removeItem('nivara_user');
    },
  },
});

export const { setCredentials, clearCredentials } = authSlice.actions;
export default authSlice.reducer;