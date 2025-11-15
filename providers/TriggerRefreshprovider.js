"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

const TriggerRefreshContext = createContext();

export const useTriggerRefresh = () => useContext(TriggerRefreshContext);

export const TriggerRefreshProvider = ({ children }) => {
  const [refresh, setRefresh] = useState(false);

  const triggerRefresh = useCallback(() => {
    setRefresh((prev) => !prev);
  }, []);

  return (
    <TriggerRefreshContext.Provider value={{ refresh, triggerRefresh }}>
      {children}
    </TriggerRefreshContext.Provider>
  );
};