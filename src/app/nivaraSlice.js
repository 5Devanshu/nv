import { createSlice } from '@reduxjs/toolkit';

const nivaraSlice = createSlice({
  name: 'nivara',
  initialState: {
    sidebarOpen:    true,
    activeProject:  null,
  },
  reducers: {
    toggleSidebar:    (state)             => { state.sidebarOpen   = !state.sidebarOpen; },
    setActiveProject: (state, { payload }) => { state.activeProject = payload; },
  },
});

export const { toggleSidebar, setActiveProject } = nivaraSlice.actions;
export default nivaraSlice.reducer;