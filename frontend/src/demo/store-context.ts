import {createContext,useContext} from "react";
import type {Action,DemoState,Result} from "./types";

export interface DemoApi{state:DemoState;dispatch(action:Action):Result;reset():Result}
export const DemoContext=createContext<DemoApi|null>(null);
export function useDemo():DemoApi{const c=useContext(DemoContext);if(!c)throw new Error("useDemo must be used inside DemoProvider.");return c}
