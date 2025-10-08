# Artificial Metacognition (M-Stack)

## A reliability architecture for AI systems that know when they’re wrong

**Author**: AI Reliability Research Group
**Maintainer**: Aditya Morey ([adityamorey1723@gmail.com](mailto:adityamorey1723@gmail.com))
**License**: CC BY-SA 4.0 (suggested)

---

## TL;DR

Most AI systems fail quietly. They sound confident even when they shouldn’t. **M-Stack** fixes this by wrapping any model with four inference-time functions—**Monitor → Evaluate → Control → Learn**—so the system can **detect uncertainty, verify claims, abstain when needed, and adapt thresholds over time**. It’s training-agnostic, auditable, and deployable today in offline/BYO setups.

---

## Abstract

We present **Artificial Metacognition**, a reliability layer (M-Stack) that gives AI systems the ability to **know when they’re likely wrong** and behave accordingly. The architecture is **model-agnostic** and **inference-time only**: no fine-tuning required. M-Stack monitors uncertainty and contradictions, evaluates outputs for factuality and process quality, chooses an action under a **risk and cost budget** (verify, revise, abstain, emit), and then **learns** better thresholds from outcomes.

We propose **MetaBench**, a simple evaluation recipe using public datasets (e.g., SQuAD2 unanswerables, TruthfulQA, RAG tasks), with metrics including **Hallucination Rate**, **AURC** (Area Under Risk–Coverage), **ECE** (calibration), **RCC** (risk-controlling coverage), and **meta-d′**. Our reference pipeline supports **offline/BYO models**, **citation-gated RAG**, **process supervision**, and **conformal gating**. The system outputs **tamper-evident logs** and **decision traces** aligned with the **EU AI Act**, **NIST AI RMF**, and **ISO/IEC 42001** expectations.

---

## 1) Why this matters

Here’s the thing: capability without self-awareness creates **silent failure**. A single wrong answer in customer support is a nuisance; in a clinical, legal, or financial context it’s risk. What we need is **actionable uncertainty**—not just a confidence score buried in a JSON blob, but a **controller** that says:

* “I’m not sure—**abstain**.”
* “I can be sure if I **verify** this claim.”
* “This is clean—**emit**.”

What this really means is: the system should choose **how** to respond, not just **what** to say.

---

## 2) Problem definition

* **Hallucination**: the system produces unsupported or false claims.
* **Overconfidence**: probability estimates don’t match reality (poor calibration).
* **No control layer**: nothing decides whether to verify, revise, or abstain.
* **No audit trail**: it’s hard to show why the system made a risky call.

We want a drop-in layer that can sit on top of any model, **catch failure before it escapes**, and leave a paper trail that stands up to audits.

---

## 3) The M-Stack architecture (Monitor → Evaluate → Control → Learn)

**M1 — Monitor.** Extract uncertainty signals and contradictions:

* **Self-disagreement**: variance across K samples (dynamic K = 1/3/5).
* **Entropy/likelihood**: token-level instability, early-token slope.
* **NLI contradictions**: claim-graph across candidates (entail/neutral/contradict).
* **RAG coverage**: span-level alignment of claims to retrieved docs.

**M2 — Evaluate.** Score factuality and process quality:

* **LLM-as-a-Judge** for final outputs (binary/graded).
* **Process Reward Model (PRM)** for stepwise reasoning quality.
* **Citation checks**: every claim that should be grounded is grounded.

**M3 — Control.** Choose **verify / revise / abstain / emit** under constraints:

* Treat it as a **Constrained MDP**: maximize utility while keeping **risk ≤ α** and **cost ≤ budget**.
* Supports **conformal gates**: only emit when coverage ≥ τ calibrated on a held-out split.

**M4 — Learn.** Calibrate and adapt:

* Update thresholds (judge, PRM, coverage τ) to hit target **error@coverage**.
* Online updates via **bandit-style** or periodic batch calibration.

---

## 4) What “good” looks like (targets)

* **Hallucination Rate**: ↓ 30–60% vs. base at matched cost.
* **AURC**: ↓ (better risk–coverage tradeoff).
* **ECE**: ↓ (improved calibration).
* **RCC curve**: lower risk for any given coverage.
* **Abstention quality**: error rate of abstained set >> emitted set.

These are measurable and reproducible with the kit.

---

## 5) Signals and checks (how it works under the hood)

### Uncertainty signals

* **K-sample variance**: generate K candidates; compute agreement and token-level overlap.
* **Entropy / early-token slope**: unstable prefix = early warning.
* **Retrieval density** (for RAG): thin retrieval → higher risk.
* **Claim graph contradictions**: build atomic claims; run NLI edges.

### Evaluators

* **Judge**: a small model (or your main model) that grades output factuality and completeness.
* **PRM**: scores intermediate steps; flags “unsupported leap,” “unsafe,” etc.
* **Citation alignment**: claim spans map to doc spans; missing coverage → penalty.

### Decision policy

* **CMDP (Lagrangian)** with dual variables **λ** (cost) and **μ** (risk).
* **Actions**:

  * **Verify**: run retrieval or tool call; re-grade.
  * **Revise**: ask model to fix unsupported claims only.
  * **Abstain**: yield a safe, actionable fallback.
  * **Emit**: response + confidence + evidence IDs.

---

## 6) Reference pipeline (offline/BYO friendly)

```python
# Pseudocode — inference-time orchestrator
def pipeline(query, ctx=None, budget= {'tokens': 2000, 'latency_ms': 2000}, risk_cap=0.2):
    K = dynamic_k(query, ctx)             # 1, 3, or 5
    cands = [generate(query, ctx) for _ in range(K)]
    m1 = monitor(cands, ctx)              # variance, entropy, nli_contra, rag_coverage
    m2 = evaluate(cands, ctx)             # judge_score, prm_score, citation_score
    action = decide_cmdp(m1, m2, budget, risk_cap)
    y = execute(action, cands, query, ctx)  # verify/revise/abstain/emit
    learn.update(m1, m2, action, y)         # thresholds & calibration
    return y
```

**Notes**

* Works with **local models** (text-gen, NLI, judge/PRM).
* RAG uses local embeddings + local store.
* All artifacts written to **JSONL logs** with hashes and spans.

---

## 7) Logging and auditability

Emit a structured record per request:

```json
{
  "qid": "uuid-123",
  "timestamp": "2025-10-08T12:34:56Z",
  "input": {"query": "...", "ctx_hash": "..."},

  "candidates": [
    {"text": "...", "conf": 0.74}, {"text": "...", "conf": 0.61}
  ],

  "monitor": {
    "entropy_prefix": 0.32,
    "k_var_conf": 0.11,
    "nli_contra": 0.23,
    "rag_coverage": 0.58
  },

  "evaluate": {
    "judge": 0.67,
    "prm": 0.71,
    "citation_score": 0.62
  },

  "decision": {
    "action": "abstain|verify|emit|revise",
    "rationale": "low coverage; high contradiction",
    "policy_version": "mstack_v1.2.0"
  },

  "output": {
    "emitted_text": null,
    "abstention_reason": "Insufficient evidence for claim [2]",
    "citations": ["S44#p3:12-40"]
  },

  "cost": {"prompt": 1024, "completion": 1280, "latency_ms": 1450}
}
```

These logs make audits and incident reviews straightforward.

---

## 8) Evaluation plan (MetaBench)

**Tasks**

* **SQuAD 2.0 (unanswerables)** – must abstain when no answer.
* **TruthfulQA** – penalize specific falsehoods.
* **RAG (Hotpot style)** – penalize unsupported claims (must cite).
* *(Optional)* **HumanEval/MBPP** – proxy for “false confidence” in code tasks.

**Systems at matched cost (±5%)**

1. Base (single shot)
2. Self-Consistency (K=3 majority)
3. Judge-Gate (single + threshold)
4. Conformal RAG (coverage gate only)
5. **M-Stack (full)**

**Metrics**

* **Hallucination rate** (primary), 95% CI; paired **McNemar**.
* **AURC**; paired bootstrap.
* **RCC** (risk@coverage); **ECE**; **meta-d′**.
* **Abstention quality**: error in abstained vs. emitted sets.

**Acceptance (example targets)**

* SQuAD2 unans: **≥30%** relative reduction (p<0.01).
* RAG unsupported claims: **≥40%** reduction at equal coverage.
* Maintain or improve AURC; lower ECE; higher meta-d′.

---

## 9) Cost model and latency

Let’s break it down.

* **Overhead drivers**: K-sampling, judge/PRM calls, retrieval/verify passes.
* **Mitigations**:

  * **Dynamic-K**: low-risk queries stay at K=1.
  * **Localized revision**: only fix flagged spans, not the whole answer.
  * **Early-exit gating**: short-circuit when signals are clean.
  * **Route by domain**: risk caps and budgets per route (support vs. legal).

In practice, you’ll see **1.4×–2.5×** cost vs. base depending on risk caps. With Dynamic-K and localized revision, you typically **recover 30–50%** of naive overhead.

---

## 10) Governance alignment (EU AI Act / NIST / ISO 42001)

What auditors want to see, you’ll have:

* **Decision traces**: signals → scores → action with versioned policy.
* **RCC targets**: declared risk caps and achieved metrics.
* **Citations and spans**: claim-to-source mapping.
* **Tamper-evidence**: hash configs and artifacts (content-addressed logs).
* **Playbooks**: safe fallbacks on abstain; human-in-the-loop escalation.

This isn’t hand-waving. It’s concrete evidence they can read.

---

## 11) Security, Safety, and Fairness

* **Prompt injection**: strip, sandbox, and **verify** before emit; never trust retrieved text blindly.
* **PII & compliance**: log hashes, not raw user content (or store encrypted + access-controlled).
* **Bias**: run **stratified evaluations**; compare abstention rates across cohorts; retrain judge/PRM if skewed.
* **Abuse**: clamp outputs with policy filters before emit; abstain if unsafe flags trip.

---

## 12) Deployment models

* **Offline/BYO** (recommended for now):

  * Local LLM(s), NLI, judge/PRM, embeddings, and vector store.
  * No external network calls required.
* **Hybrid**: local for monitor/evaluate; remote for occasional verification.
* **Full API**: possible, but you’ll lose some signals (e.g., logits) and control.

---

## 13) Implementation details

### 13.1 Dynamic-K

```python
def dynamic_k(query, ctx):
    # Simple heuristic: score risk from 0..1
    r = 0.0
    r += 0.3 * is_long(query)           # length proxy
    r += 0.4 * retrieval_thin(ctx)      # few relevant docs
    r += 0.3 * domain_risk(ctx.domain)  # e.g., medical > chit-chat
    return 1 if r < 0.33 else (3 if r < 0.66 else 5)
```

### 13.2 Statement-graph contradiction

* Extract atomic claims (regex + chunking; optional small **NER** model).
* Pairwise **NLI** between claims across candidates.
* Find **maximum consistent subgraph**; if below threshold → verify/revise/abstain.

### 13.3 CMDP controller (Lagrangian)

```python
# At each decision
L = U(a; x) - λ * (cost(x,a) - B) - μ * (risk(x,a) - α)
# Update duals
λ = max(0, λ + η * (observed_cost - B))
μ = max(0, μ + η * (observed_risk - α))
```

Where **risk** proxies include: judge failure prob, NLI contradiction mass, uncovered claims, low coverage τ.

### 13.4 Conformal gates

* For RAG, define non-conformity as **1 − coverage**.
* Calibrate **τ = q_{1−α}** on a held-out set; emit only if coverage ≥ τ.

---

## 14) API surfaces (suggested)

```http
POST /mstack/infer
{
  "query": "...",
  "context": {...},            // optional RAG context
  "route": "support|legal|...", 
  "budget": {"tokens": 2000, "latency_ms": 2000},
  "risk_cap": 0.2
}

200 OK
{
  "action": "emit|abstain|verify|revise",
  "text": "...",               // if emit
  "citations": [{"doc_id":"S1","span":[123,196]}],
  "confidence": 0.81,
  "log_id": "uuid-123"
}
```

---

## 15) SRE and observability

* **Dashboards**: hallucination rate, abstention rate, coverage τ distribution, judge/PRM drift, latency buckets.
* **Alerts**: spike in contradiction rate; spikes in abstentions; coverage dips.
* **Red/black tests**: canary new thresholds; holdout tasks for regression.

---

## 16) Known limitations

* **Verifier bias**: judge/PRM can be wrong; keep them simple and regularly recalibrated.
* **Latency stacking**: too many checks in series will sting; favor **parallel** signals + early exits.
* **Adversarial data**: citation tricks and prompt injection require hardened retrieval + sanitization.
* **Domain shifts**: bake in **shift suites** (paraphrase, time-shift, entity-swap) and report **worst-case** ECE/AURC.

---

## 17) Results snapshot (fill after run)

| Task         | Metric                 | Baseline | M-Stack |     Δ |
| ------------ | ---------------------- | -------- | ------: | ----: |
| SQuAD2-Unans | Hallucination (↓)      | —        |       — | **—** |
| TruthfulQA   | Hallucination (↓)      | —        |       — | **—** |
| RAG          | Unsupported claims (↓) | —        |       — | **—** |
| All          | AURC (↓)               | —        |       — | **—** |
| All          | ECE (↓) / meta-d′ (↑)  | —        |       — | **—** |

---

## 18) Roadmap (next sprint)

1. Add **conformal gating** for RAG + **APS/RAPS** for classification heads.
2. Swap any rule leftovers with **CMDP** everywhere.
3. Distill a tiny **PRM** from judge for faster step scoring.
4. Ship **RCC curves**, shift-wise **ECE/AURC**, and ablations.
5. Harden **span logging** (claim→citation) for audits.

---

## 19) FAQ (short)

**Q: Can this run fully offline?**
Yes. All components can run locally with open models.

**Q: Does this replace training?**
No. It **wraps** whatever you have and makes it safer.

**Q: What happens on abstain?**
Return a short, helpful fallback: “I’m unsure. Here’s what I’d need to verify…” plus next steps.

**Q: How expensive is this?**
Depends on risk caps and K. With Dynamic-K and localized revision, ~1.4×–2× is common.

---

## 20) Glossary

* **AURC**: risk–coverage tradeoff area. Lower is better.
* **ECE**: calibration error. Lower is better.
* **RCC**: minimal achievable risk at a given coverage.
* **PRM**: process reward model (scores steps, not just the final).
* **CMDP**: constrained MDP; optimize utility under risk and cost constraints.

---

## Credits

Thanks to the reliability community for calibration, selective prediction, and conformal foundations this work stands on. Implementation in this repo by the AI Reliability Research Group, with contributions by Aditya Morey.

---
