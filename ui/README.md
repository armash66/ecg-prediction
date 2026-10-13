# ECG Intelligence UI (plain HTML/CSS/JS, no Streamlit, no build step)

Pale, minimal single-page UI: waveform viewer with per-lead attribution overlay, multi-label predictions with
decision thresholds, gate split, and a Model tab with the experiment table.

Open `index.html` directly to see the **demo mode** (synthetic waveform, clearly labelled, not model output).
With a backend running, open it through the server (`http://localhost:8000/`) or `index.html?api=http://localhost:8000`.

## Backend contract (JSON)

`GET /api/info`
```json
{ "model": "gated", "n_samples": 40,
  "experiments": [ {"name":"xgb","macro_auc":0.0,"macro_auprc":0.0,"macro_f1":0.0,"macro_sensitivity":0.0}, ... ],
  "per_class": { "auc":{"NORM":0.0,...}, "auprc":{...}, "f1":{...}, "sensitivity":{...} } }
```
`GET /api/sample/{i}`  ->  `{ "signal": [[12 floats] x 1000], "labels": ["NORM"] }`   (test-fold ECGs, raw units, mV)

`POST /api/predict`  body `{ "signal": [[12 floats] x 1000], "explain": "MI" | null }`
```json
{ "probs": {"NORM":0.0,"MI":0.0,"STTC":0.0,"CD":0.0,"HYP":0.0},
  "thresholds": {"NORM":0.5,...},            // tuned on validation fold 9
  "gate": 0.58 | null,                       // mean deep-branch weight for THIS ECG (gated model only)
  "explain_class": "MI",                     // default: highest-probability class
  "attribution": [[1000 floats] x 12] | null // integrated gradients, lead-major, any scale (UI normalises)
}
```
Signal shape is time-major (1000 rows x 12 leads, order I, II, III, aVR, aVL, aVF, V1-V6, 100 Hz).
Errors: return HTTP 4xx/5xx with a plain-text message; the UI shows it in the banner.

Research prototype. Not a medical device.
