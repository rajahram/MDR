import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AdamVar, CrfField, MdrState, Selection, SdtmVar } from "../data/types";
import { seedState } from "../data/seed";

const LS_KEY = "trace-mdr:v1";

export type ViewKey = "overview" | "explorer" | "matrix" | "gaps" | "framework";

export type Action =
  | { type: "reset" }
  | { type: "addCrfField"; field: CrfField }
  | { type: "addSdtmVar"; v: SdtmVar }
  | { type: "addAdamVar"; v: AdamVar }
  | { type: "linkCrfSdtm"; sdtmId: string; crfId: string }
  | { type: "linkSdtmAdam"; adamId: string; sdtmId: string }
  | { type: "linkAdamTfl"; tflId: string; adamId: string };

function reducer(state: MdrState, action: Action): MdrState {
  switch (action.type) {
    case "reset":
      return seedState;
    case "addCrfField":
      if (state.crfFields.some((f) => f.id === action.field.id)) return state;
      return { ...state, crfFields: [...state.crfFields, action.field] };
    case "addSdtmVar":
      if (state.sdtmVars.some((v) => v.id === action.v.id)) return state;
      return { ...state, sdtmVars: [...state.sdtmVars, action.v] };
    case "addAdamVar":
      if (state.adamVars.some((v) => v.id === action.v.id)) return state;
      return { ...state, adamVars: [...state.adamVars, action.v] };
    case "linkCrfSdtm":
      return {
        ...state,
        sdtmVars: state.sdtmVars.map((v) =>
          v.id === action.sdtmId && !v.crfFieldIds.includes(action.crfId)
            ? { ...v, crfFieldIds: [...v.crfFieldIds, action.crfId] }
            : v
        ),
      };
    case "linkSdtmAdam":
      return {
        ...state,
        adamVars: state.adamVars.map((v) =>
          v.id === action.adamId && !v.sdtmVarIds.includes(action.sdtmId)
            ? { ...v, sdtmVarIds: [...v.sdtmVarIds, action.sdtmId] }
            : v
        ),
      };
    case "linkAdamTfl":
      return {
        ...state,
        tfls: state.tfls.map((t) =>
          t.id === action.tflId && !t.adamVarIds.includes(action.adamId)
            ? { ...t, adamVarIds: [...t.adamVarIds, action.adamId] }
            : t
        ),
      };
    default:
      return state;
  }
}

function loadInitial(): MdrState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MdrState;
      if (
        Array.isArray(parsed.crfFields) &&
        Array.isArray(parsed.sdtmVars) &&
        Array.isArray(parsed.adamVars) &&
        Array.isArray(parsed.tfls)
      ) {
        return { ...seedState, ...parsed };
      }
    }
  } catch {
    /* corrupted storage → reseed */
  }
  return seedState;
}

export interface Toast {
  id: number;
  kind: "success" | "info" | "warn";
  text: string;
}

interface StoreValue {
  state: MdrState;
  dispatch: (a: Action) => void;
  view: ViewKey;
  setView: (v: ViewKey) => void;
  selection: Selection | null;
  select: (sel: Selection | null, gotoExplorer?: boolean) => void;
  toasts: Toast[];
  toast: (kind: Toast["kind"], text: string) => void;
  dismissToast: (id: number) => void;
  modalOpen: boolean;
  setModalOpen: (b: boolean) => void;
}

const StoreCtx = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitial);
  const [view, setView] = useState<ViewKey>("overview");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const toastId = useRef(0);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable */
    }
  }, [state]);

  const toast = useCallback((kind: Toast["kind"], text: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const select = useCallback((sel: Selection | null, gotoExplorer = false) => {
    setSelection(sel);
    if (gotoExplorer && sel) setView("explorer");
  }, []);

  const value = useMemo(
    () => ({ state, dispatch, view, setView, selection, select, toasts, toast, dismissToast, modalOpen, setModalOpen }),
    [state, view, selection, select, toasts, toast, dismissToast, modalOpen]
  );

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
