import { useMemo, useState } from "react";
import type { AdamModel, AdamOrigin, DataType, SdtmOrigin, SdtmRole } from "../data/types";
import { useStore } from "../state/store";
import { FlowArrow, IconCheck, IconX, Modal, SectionLabel } from "./ui";

const input =
  "w-full rounded-md border border-line/80 bg-abyss/60 px-3 py-2 font-mono text-[12px] text-ink placeholder-faint outline-none transition-colors focus:border-sdtm/60";
const label = "mb-1 block font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-faint";

function ModeSwitch({ mode, setMode, existingLabel }: { mode: "existing" | "new"; setMode: (m: "existing" | "new") => void; existingLabel: string }) {
  return (
    <div className="mb-3 flex rounded-md border border-line/80 bg-abyss/40 p-0.5">
      {(["existing", "new"] as const).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={`flex-1 rounded-[5px] py-1.5 text-[11.5px] font-medium transition-all ${
            mode === m ? "bg-raise text-ink shadow" : "text-faint hover:text-dim"
          }`}
        >
          {m === "existing" ? existingLabel : "Create new"}
        </button>
      ))}
    </div>
  );
}

export default function AddTraceModal() {
  const { state, dispatch, setModalOpen, toast } = useStore();
  const [step, setStep] = useState(1);

  const [crfMode, setCrfMode] = useState<"existing" | "new">("existing");
  const [crfId, setCrfId] = useState("");
  const [crfPage, setCrfPage] = useState("VS");
  const [crfOid, setCrfOid] = useState("");
  const [crfLabel, setCrfLabel] = useState("");
  const [crfType, setCrfType] = useState<DataType>("float");

  const [sdMode, setSdMode] = useState<"existing" | "new">("existing");
  const [sdId, setSdId] = useState("");
  const [sdDomain, setSdDomain] = useState("VS");
  const [sdName, setSdName] = useState("");
  const [sdLabel, setSdLabel] = useState("");
  const [sdRole, setSdRole] = useState<SdtmRole>("TOPIC");

  const [adMode, setAdMode] = useState<"existing" | "new">("existing");
  const [adId, setAdId] = useState("");
  const [adDataset, setAdDataset] = useState("ADVS");
  const [adName, setAdName] = useState("");
  const [adLabel, setAdLabel] = useState("");
  const [adModel, setAdModel] = useState<AdamModel>("BDS");
  const [adDeriv, setAdDeriv] = useState("");

  const pages = useMemo(() => [...new Set(state.crfFields.map((f) => f.pageCode))], [state]);
  const domains = useMemo(() => [...new Set(state.sdtmVars.map((v) => v.domain))], [state]);
  const datasets = useMemo(() => [...new Set(state.adamVars.map((v) => v.dataset))], [state]);

  const newCrfId = crfOid.trim() ? `${crfPage}.${crfOid.trim().toUpperCase()}` : "";
  const newSdId = sdName.trim() ? `${sdDomain}.${sdName.trim().toUpperCase()}` : "";
  const newAdId = adName.trim() ? `${adDataset}.${adName.trim().toUpperCase()}` : "";

  const resolvedCrf = crfMode === "existing" ? crfId : newCrfId;
  const resolvedSd = sdMode === "existing" ? sdId : newSdId;
  const resolvedAd = adMode === "existing" ? adId : newAdId;

  const step1Valid = crfMode === "existing" ? crfId !== "" : newCrfId !== "" && crfLabel.trim() !== "";
  const step2Valid = sdMode === "existing" ? sdId !== "" : newSdId !== "" && sdLabel.trim() !== "";
  const step3Valid = adMode === "existing" ? adId !== "" : newAdId !== "" && adLabel.trim() !== "";

  const submit = () => {
    if (crfMode === "new" && !state.crfFields.some((f) => f.id === newCrfId)) {
      const page = state.crfFields.find((f) => f.pageCode === crfPage)?.page ?? "Custom Page";
      dispatch({ type: "addCrfField", field: { id: newCrfId, pageCode: crfPage, page, label: crfLabel.trim(), dataType: crfType, required: true } });
    }
    const sdtmExists = state.sdtmVars.some((v) => v.id === resolvedSd);
    if (sdMode === "new" && !sdtmExists) {
      const origin: SdtmOrigin = "CRF";
      dispatch({
        type: "addSdtmVar",
        v: { id: newSdId, domain: sdDomain, name: sdName.trim().toUpperCase(), label: sdLabel.trim(), role: sdRole, type: "Char", length: 20, origin, crfFieldIds: [resolvedCrf] },
      });
    } else if (sdtmExists) {
      dispatch({ type: "linkCrfSdtm", sdtmId: resolvedSd, crfId: resolvedCrf });
    }
    const adamExists = state.adamVars.some((v) => v.id === resolvedAd);
    if (adMode === "new" && !adamExists) {
      const origin: AdamOrigin = adDeriv.trim() ? "DERIVED" : "SDTM";
      dispatch({
        type: "addAdamVar",
        v: { id: newAdId, dataset: adDataset, name: adName.trim().toUpperCase(), label: adLabel.trim(), type: "Num", length: 8, origin, model: adModel, sdtmVarIds: [resolvedSd], derivation: adDeriv.trim() || undefined },
      });
    } else if (adamExists) {
      dispatch({ type: "linkSdtmAdam", adamId: resolvedAd, sdtmId: resolvedSd });
    }
    toast("success", `Trace path created: ${resolvedCrf} → ${resolvedSd} → ${resolvedAd}`);
    setModalOpen(false);
  };

  const stepTitle = ["CRF source", "SDTM target", "ADaM variable"][step - 1];

  return (
    <Modal onClose={() => setModalOpen(false)} width={640}>
      <div className="border-b border-line/80 px-6 pb-4 pt-5">
        <div className="flex items-start justify-between">
          <div>
            <SectionLabel color="#38c7a6">New traceability link</SectionLabel>
            <h2 className="mt-1 font-display text-[20px] font-bold tracking-tight">{stepTitle}</h2>
          </div>
          <button onClick={() => setModalOpen(false)} className="mt-1 text-faint transition-colors hover:text-ink" aria-label="Close">
            <IconX size={16} />
          </button>
        </div>
        {/* stepper */}
        <div className="mt-4 flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex flex-1 items-center gap-2">
              <button
                onClick={() => s < step && setStep(s)}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[10.5px] font-semibold transition-all ${
                  s < step ? "bg-sdtm text-abyss" : s === step ? "border border-sdtm text-sdtm" : "border border-line text-faint"
                }`}
              >
                {s < step ? <IconCheck size={11} /> : s}
              </button>
              <div className={`h-px flex-1 ${s < 3 ? (s < step ? "bg-sdtm/60" : "bg-line") : ""}`} />
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 py-5">
        {step === 1 && (
          <div className="anim-fade flex flex-col gap-3">
            <ModeSwitch mode={crfMode} setMode={setCrfMode} existingLabel="Pick collected field" />
            {crfMode === "existing" ? (
              <select value={crfId} onChange={(e) => setCrfId(e.target.value)} className={input}>
                <option value="">Select CRF field…</option>
                {state.crfFields.map((f) => (
                  <option key={f.id} value={f.id}>{f.id} — {f.label}</option>
                ))}
              </select>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={label}>Page code</label>
                    <select value={crfPage} onChange={(e) => setCrfPage(e.target.value)} className={input}>
                      {[...pages, "PC"].map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={label}>Field OID</label>
                    <input value={crfOid} onChange={(e) => setCrfOid(e.target.value)} placeholder="e.g. RESPIR" className={input} />
                  </div>
                </div>
                <div>
                  <label className={label}>Field label</label>
                  <input value={crfLabel} onChange={(e) => setCrfLabel(e.target.value)} placeholder="e.g. Respiratory Rate (breaths/min)" className={input} />
                </div>
                <div>
                  <label className={label}>Data type</label>
                  <select value={crfType} onChange={(e) => setCrfType(e.target.value as DataType)} className={input}>
                    {(["float", "integer", "text", "date", "time", "coded"] as const).map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="anim-fade flex flex-col gap-3">
            <ModeSwitch mode={sdMode} setMode={setSdMode} existingLabel="Pick SDTM variable" />
            {sdMode === "existing" ? (
              <select value={sdId} onChange={(e) => setSdId(e.target.value)} className={input}>
                <option value="">Select SDTM variable…</option>
                {state.sdtmVars.map((v) => (
                  <option key={v.id} value={v.id}>{v.id} — {v.label}</option>
                ))}
              </select>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={label}>Domain</label>
                    <select value={sdDomain} onChange={(e) => setSdDomain(e.target.value)} className={input}>
                      {[...domains, "EG", "DS", "MH"].map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={label}>Variable name</label>
                    <input value={sdName} onChange={(e) => setSdName(e.target.value)} placeholder="e.g. EGORRES" className={input} />
                  </div>
                </div>
                <div>
                  <label className={label}>Label</label>
                  <input value={sdLabel} onChange={(e) => setSdLabel(e.target.value)} placeholder="e.g. Result in Original Units" className={input} />
                </div>
                <div>
                  <label className={label}>Variable role</label>
                  <select value={sdRole} onChange={(e) => setSdRole(e.target.value as SdtmRole)} className={input}>
                    {(["TOPIC", "QUALIFIER", "TIMING", "IDENTIFIER"] as const).map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="anim-fade flex flex-col gap-3">
            <ModeSwitch mode={adMode} setMode={setAdMode} existingLabel="Pick ADaM variable" />
            {adMode === "existing" ? (
              <select value={adId} onChange={(e) => setAdId(e.target.value)} className={input}>
                <option value="">Select ADaM variable…</option>
                {state.adamVars.map((v) => (
                  <option key={v.id} value={v.id}>{v.id} — {v.label}</option>
                ))}
              </select>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={label}>Dataset</label>
                    <select value={adDataset} onChange={(e) => setAdDataset(e.target.value)} className={input}>
                      {[...datasets, "ADEG", "ADMH", "ADQS"].map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={label}>Variable name</label>
                    <input value={adName} onChange={(e) => setAdName(e.target.value)} placeholder="e.g. AVAL" className={input} />
                  </div>
                </div>
                <div>
                  <label className={label}>Label</label>
                  <input value={adLabel} onChange={(e) => setAdLabel(e.target.value)} placeholder="e.g. Analysis Value" className={input} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={label}>Structure</label>
                    <select value={adModel} onChange={(e) => setAdModel(e.target.value as AdamModel)} className={input}>
                      {(["BDS", "OCCDS", "ADSL"] as const).map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={label}>Derivation rule</label>
                    <input value={adDeriv} onChange={(e) => setAdDeriv(e.target.value)} placeholder="e.g. AVAL = EGSTRESN" className={input} />
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* footer */}
      <div className="flex flex-wrap items-center gap-2 border-t border-line/80 px-6 py-4">
        <span className="rounded-sm border border-crf/40 bg-crf/10 px-2 py-0.5 font-mono text-[10px] text-crf">{resolvedCrf || "· CRF ·"}</span>
        <FlowArrow color="#38c7a6" />
        <span className="rounded-sm border border-sdtm/40 bg-sdtm/10 px-2 py-0.5 font-mono text-[10px] text-sdtm">{resolvedSd || "· SDTM ·"}</span>
        <FlowArrow color="#f27059" />
        <span className="rounded-sm border border-adam/40 bg-adam/10 px-2 py-0.5 font-mono text-[10px] text-adam">{resolvedAd || "· ADaM ·"}</span>
        <div className="ml-auto flex gap-2">
          {step > 1 && (
            <button onClick={() => setStep((s) => s - 1)} className="rounded-md border border-line px-4 py-2 text-[12px] font-medium text-dim transition-colors hover:border-line hover:text-ink">
              Back
            </button>
          )}
          {step < 3 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 1 ? !step1Valid : !step2Valid}
              className="rounded-md border border-sdtm/50 bg-sdtm/15 px-5 py-2 text-[12px] font-semibold text-sdtm transition-all hover:bg-sdtm/25 disabled:cursor-not-allowed disabled:opacity-35"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!step3Valid}
              className="rounded-md border border-sdtm/60 bg-sdtm/20 px-5 py-2 text-[12px] font-semibold text-sdtm transition-all hover:-translate-y-px hover:bg-sdtm/30 disabled:cursor-not-allowed disabled:opacity-35"
            >
              Create trace path
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
