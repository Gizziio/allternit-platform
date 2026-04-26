"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

export type DataStreamPart = 
  | { type: "text"; text: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; args: unknown }
  | { type: "tool-result"; toolCallId: string; result: unknown }
  | { type: "error"; error: string }
  | { type: "finish"; finishReason: string; usage: unknown };

interface DataStreamContextType {
  dataStream: DataStreamPart[];
  setDataStream: (parts: DataStreamPart[]) => void;
  appendData: (part: DataStreamPart) => void;
  clearData: () => void;
}

const DataStreamContext = createContext<DataStreamContextType | undefined>(undefined);

interface DataStreamProviderProps {
  children: ReactNode;
}

export function DataStreamProvider({ children }: DataStreamProviderProps) {
  const [dataStream, setDataStream] = useState<DataStreamPart[]>([]);

  const appendData = (part: DataStreamPart) => {
    setDataStream((prev) => [...prev, part]);
  };

  const clearData = () => {
    setDataStream([]);
  };

  return (
    <DataStreamContext.Provider
      value={{ dataStream, setDataStream, appendData, clearData }}
    >
      {children}
    </DataStreamContext.Provider>
  );
}

export function useDataStream() {
  const context = useContext(DataStreamContext);
  if (context === undefined) {
    throw new Error("useDataStream must be used within a DataStreamProvider");
  }
  return context;
}
