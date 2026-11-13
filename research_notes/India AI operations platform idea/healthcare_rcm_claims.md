# Hospital revenue-cycle / health-insurance claims operations in India (as of Nov 2026)

Notes on method: ~24 search/fetch calls. Most figures come from press reports of IRDAI's Annual Report 2024-25 (FY25, year to March 2025), not from the report PDF itself, which I did not open. The IRDAI Annual Report 2025-26 (FY26) was not found in search; FY25 is the latest full-year regulator data I could cite. US$ conversions are my own at roughly ₹85 = US$1 and are approximate. Items marked "vendor claim" are company-stated and unaudited.

## 1. How large is Indian health insurance (premiums, claims paid, claim counts, cashless share, growth)?

### Takeaway
Regulated health insurance is roughly a ₹1.27 lakh crore (~US$15bn) premium market paying ~₹94,000 crore (~US$11bn) on ~3.26 crore claims a year, growing ~9-11% a year; about two-thirds of the money and ~58% of claims go cashless, i.e. through the hospital's insurance desk. PM-JAY adds a separate government stream of roughly ₹1.4 lakh crore cumulative since 2018.

### Cited Findings
- Health insurance premium FY25: ₹1,27,417 crore (~US$15.0bn), up 9.19% YoY (press report of IRDAI Annual Report 2024-25) — [Outlook Money](https://www.outlookmoney.com/insurance/irdai-2024-25-annual-report-health-premiums-cross-rs-127-lakh-crore-mark)
- Finance Ministry phrasing: health premiums "exceeding ₹1.2 lakh crore" in 2024-25, sector growth ~9% — [Tribune](https://www.tribuneindia.com/news/business/indias-health-insurance-premiums-cross-rs-1-2-lakh-crore-in-2024-25-finance-ministry/)
- FY25 claims: ~3.26 crore (32.6 million) health claims; ₹94,248 crore paid (~US$11.1bn), up ~11-13% from ₹83,493 crore in FY24 — [India Med Today](https://indiamedtoday.com/record-health-insurance-claims-settled-in-fy25-average-payout-per-claim-declines/); [Algates summary](https://algatesinsurance.in/irdai-annual-report-2024-25-highlights/)
- Average payout per claim fell to ₹28,910 (FY25) from ₹31,086 (FY24) — [India Med Today](https://indiamedtoday.com/record-health-insurance-claims-settled-in-fy25-average-payout-per-claim-declines/)
- Cashless share of amount paid: ~66.35% (FY25) vs ~66.17% (FY24); reimbursement ~29.34% (FY25) vs 31.35% — [India Med Today](https://indiamedtoday.com/record-health-insurance-claims-settled-in-fy25-average-payout-per-claim-declines/)
- Cashless share by number of claims: ~58% (secondary explainers only; not verified against the IRDAI PDF) — [Ditto](https://www.joinditto.in/articles/general/irdai-annual-report/); [Algates](https://algatesinsurance.in/irdai-annual-report-2024-25-highlights/)
- TPAs processed ~69% of claims by number in FY25 (72% in FY24); insurers' in-house ~31% (28%) — [India Med Today](https://indiamedtoday.com/record-health-insurance-claims-settled-in-fy25-average-payout-per-claim-declines/)
- PM-JAY cumulative: 8.99 crore admissions worth ₹1.26 lakh crore authorised (as reported early 2025) — [Medical Dialogues](https://medicaldialogues.in/news/health/hospital-diagnostics/899-crore-hospital-admissions-worth-rs-126-lakh-crore-authorised-under-pmjay-145772); later 9.84 crore admissions worth ₹1.40 lakh crore "till June" (2025) — [Lokmat Times](https://www.lokmattimes.com/health/ab-pmjay-over-984-cr-hospital-admissions-worth-rs-140-lakh-cr-availed-till-june-says-govt/amp)
- Asia-Pacific medical cost trend projected at 14% for 2026 (WTW survey, cited in press) — [Insurance Business](https://www.insurancebusinessmag.com/asia/news/life-insurance/irdai-cannot-explain-why-health-insurance-claims-go-unpaid-583814.aspx)

### Inferences
- If ~58% of 3.26 crore claims are cashless, that is roughly 1.9 crore (19 million) cashless claims a year, and ~₹62,500 crore (~US$7.4bn) of cashless payouts (66.35% of ₹94,248 crore). This is the direct hospital-desk addressable flow in private insurance. (My arithmetic.)
- The claim count includes many small OPD/group claims (average ₹28,910); hospital IPD cashless claims are fewer and larger. Medi Assist's FY26 split (2.2M cashless IP vs 2.7M cashless OP out of 10.0M claims) suggests IPD cashless is a minority of claim counts.
- PM-JAY authorised amounts imply roughly ₹25,000-30,000 crore a year of scheme claims in recent years (difference between cumulative figures over time); this is my rough inference, not a reported number.

### Gaps
- FY26 (IRDAI Annual Report 2025-26) figures not found; not confirmed whether it has been published as of Nov 2026.
- Did not open the IRDAI PDF or the GI Council yearbook; cashless-by-count share (58%) rests on secondary explainers.
- No sourced annual claim value for CGHS, ECHS, ESIC or individual state schemes was found.

## 2. Rejection, repudiation, deduction and delay rates; revenue lost or stuck in receivables (private insurance and government schemes)

### Takeaway
On regulator data, ~8% of claims by number were repudiated in FY25 (11% in FY24) and in FY24 about ₹26,000 crore (~22% of ₹1.17 lakh crore claimed) was either disallowed or repudiated. Hard, audited data on hospital-side receivable days and deduction percentages does not exist publicly; the usable numbers are vendor/practitioner estimates (8-15% of claim value lost, 30-45+ day settlement) and government-scheme dues episodes (PM-JAY ~₹12,000 crore pending in early 2025 by my reading of the RTI figure).

### Cited Findings
- FY25 claim outcomes by number: ~87% settled (83% in FY24), ~8% repudiated (11%), ~5% pending at year end (6%) — [India Med Today](https://indiamedtoday.com/record-health-insurance-claims-settled-in-fy25-average-payout-per-claim-declines/); [Insurance Business](https://www.insurancebusinessmag.com/asia/news/life-insurance/irdai-cannot-explain-why-health-insurance-claims-go-unpaid-583814.aspx)
- FY24 by value: ~₹1.17 lakh crore claims registered; ₹83,493 crore paid; ₹15,100 crore disallowed (12.9%); ₹10,937 crore repudiated (9.34%) — [Outlook Business](https://www.outlookbusiness.com/economy-and-policy/health-insurers-disallowed-claims-worth-rs-15100-crore-during-fy24); [Millennium Post](https://www.millenniumpost.in/big-stories/health-insurers-reject-claims-worth-rs-15100-cr-during-fy24-592851)
- FY25 by value: one low-authority source gives ₹18,521 crore disallowed and ₹11,412 crore repudiated; unverified and should be checked against the IRDAI report — [Analytics Insight](https://www.analyticsinsight.net/news/heres-why-your-health-insurance-claim-gets-rejected-three-ways-you-can-avoid-it)
- IRDAI told Parliament (July 2026) it holds no data on why claims are denied; it has mandated insurers give detailed reasons for rejections — [Insurance Business](https://www.insurancebusinessmag.com/asia/news/life-insurance/irdai-cannot-explain-why-health-insurance-claims-go-unpaid-583814.aspx)
- General and health insurance grievances rose 41% to 1,37,361 in FY25 (97,503 in FY24); ~69% claim-related — [Angel One](https://www.angelone.in/news/personal-finance/irdai-data-reveals-41-spike-in-health-insurance-grievances-over-claim-settlements-in-fy25); [Outlook Money](https://www.outlookmoney.com/personal-finance/health-insurance-complaints-jump-41-per-cent-69-per-cent-involve-claims-failures-reveals-1-finance-study)
- Ombudsman: 53,184 complaints in FY25, ~64% health, ~71% decided for the policyholder — [Insurance Business](https://www.insurancebusinessmag.com/asia/news/life-insurance/irdai-cannot-explain-why-health-insurance-claims-go-unpaid-583814.aspx)
- Discharge delays: a 2024 survey reported 5 in 10 patients face discharge delay due to the insurance claim process (2024) — [The Week](https://www.theweek.in/news/biz-tech/2024/04/29/medical-insurance-claims-5-out-of-10-patients-face-discharge-delays.html)
- Hospital settlement delay: a NATHEALTH NHCX paper says ~45-day settlement delays are a common hospital complaint, with many hospitals at 30-40 days (2025) — [NATHEALTH](https://nathealthindia.org/wp-content/uploads/2025/06/National-Health-Claims-Exchange_Latest.pdf)
- Vendor/practitioner estimates (not audited): a 100-200 bed hospital loses 8-14% of claim value to rejections, deductions and resubmission cycles — [Docxtract](https://docxtract.io/blog/tpa-claims-processing-document-pipeline/); total revenue leakage 5-15% of gross revenue with TPA/insurance among top four sources — [AccredReady](https://accredready.in/learn/hospital-revenue-leakage-guide); 4-9% of IPD revenue leaked, TPA denial resolution window 45-90 days — [Ichelon Consulting](https://ichelonconsulting.com/insights/hospital-revenue-leakage-guide); TPA payments are the largest source of outstanding receivables for most hospitals — [Patron Accounting](https://www.patronaccounting.com/blog/tpa-insurance-receivable-reconciliation-hospitals)
- Hospital-insurer conflict 2025: AHPI advised North India members to stop cashless for Bajaj Allianz from 1 Sept 2025, citing unrevised tariffs (vs 7-8% medical inflation), unilateral deductions, payment delays and slow pre-auth/discharge approvals; similar notices to Care Health and a warning to Star Health (22 Sept 2025), citing deductions/rejections after prior approval — [Outlook Money](https://www.outlookmoney.com/news/ahpi-hospitals-to-suspend-cashless-treatment-for-bajaj-allianz-policyholders-from-september-1); [Business Today](https://www.businesstoday.in/latest/corporate/story/hospitals-may-withdraw-star-health-cashless-services-amid-ongoing-disputes-warns-ahpi-493807-2025-09-12)
- PM-JAY pending claims: NHA RTI reply (filed 28 Feb 2025) reported 63,89,517 uncleared claims amounting to "Rs 1,21,61,45,63,617", which the press reported as "₹1.21 lakh crore" — [Medical Dialogues](https://medicaldialogues.in/news/health/hospital-diagnostics/rs-121-lakh-crore-claims-pending-under-ayushman-bharat-reveals-rti-144237)
- PM-JAY payment norm: 15 days from submission for intra-state claims, 30 days for portability claims (Rajya Sabha answer, Mar 2025) — [Rajya Sabha](https://rsdebate.nic.in/bitstream/123456789/759227/1/PQ_267_18032025_U2041_p393_p395.pdf)
- State flashpoints (2025): Haryana, ~650 private hospitals suspended AB-PMJAY services from 8 Aug 2025 over ~₹490 crore dues — [Business Standard](https://www.business-standard.com/health/haryana-hospitals-to-continue-ab-pmjay-strike-despite-partial-payment-125080601850_1.html); Maharashtra MJPJAY ~₹182 crore pending late Sept 2025 — [Free Press Journal](https://www.freepressjournal.in/mumbai/private-hospitals-under-state-health-scheme-struggle-as-maharashtra-govt-fails-to-clear-182-crore-pending-bills); Chhattisgarh dues near ₹200 crore, services halted — [Medical Dialogues](https://medicaldialogues.in/amp/news/health/hospital-diagnostics/chhattisgarh-private-hospitals-halt-ayushman-bharat-services-over-payment-delays-154729)
- 609 private hospitals opted out of PM-JAY since 2018, citing payment delays and low package rates — [Moneylife](https://www.moneylife.in/article/ayushman-bharat-scheme-609-private-hospitals-opted-out-due-to-payment-delays-low-reimbursements-since-2018-says-govt/76783.html)

### Inferences
- The widely repeated "₹1.21 lakh crore PM-JAY dues" figure is almost certainly a 10x misreading. The quoted rupee number, 1,21,61,45,63,617, equals ₹12,161 crore (~US$1.4bn), i.e. ~₹19,000 per pending claim across 63.9 lakh claims, which is plausible; ₹1.21 lakh crore would nearly equal everything PM-JAY has authorised since 2018 (₹1.26 lakh crore). This correction is my arithmetic, not a published correction.
- FY24 disallowed + repudiated = ₹26,037 crore (~US$3.1bn), ~22% of claimed value. This counts policyholder reimbursement claims too, and much of it is legitimately non-payable (sub-limits, exclusions, consumables), so the recoverable share for a hospital-side AI vendor is a fraction of it. No source quantifies that fraction.
- For a hospital the pain is three separate things: (a) deductions on cashless bills (hospital usually absorbs or chases the patient), (b) settlement delay of 30-45+ days on private claims, and (c) government-scheme dues running for months, which is a payer-liquidity problem that software cannot fix.

### Gaps
- No authoritative national figure for hospital days-in-AR on insurance/TPA receivables, write-off rates, or cashless deduction percentage. Listed hospital chains' annual reports (Apollo, Max, Fortis, Narayana) would be the next place to look; not checked.
- FY25 rupee value of disallowed/repudiated claims is unverified.
- No rejection-rate data found for PM-JAY, CGHS or ECHS claims; CGHS/ECHS pending-dues figures not searched in depth.

## 3. How hospitals handle this today; number of hospitals and empanelment

### Takeaway
Claims are worked by in-house "TPA/insurance desks" using payer portals, email and spreadsheets, with reconciliation done manually against lump-sum bank transfers; I found no reliable figure on desk staffing or cost per claim. The PM-JAY network is ~33,000 hospitals (15,733 private), and private-insurer networks reach 20,000-30,000 hospitals through Medi Assist and IHX.

### Cited Findings
- PM-JAY empanelled hospitals: 33,270 as of 21 Dec 2025, of which 15,733 private and 17,537 public; 6,952 private hospitals added Apr 2022-Mar 2025, 458 opted out in that period — [Millennium Post](https://www.millenniumpost.in/nation/nadda-49-hospital-admissions-availed-by-women-till-december-647259)
- Earlier: 30,957 hospitals (13,866 private) as of 1 Mar 2025 — [Rajya Sabha answer](https://rsdebate.nic.in/bitstream/123456789/759220/1/PQ_267_18032025_U2035_p378_p381.pdf)
- Private-insurance network proxies: IHX says it connects 30,000+ hospitals in 1,200 locations with 30+ payers — [YourStory](https://yourstory.com/2025/04/perfios-buys-healthcare-information-exchange-platform-ihx); Medi Assist network 20,204 hospitals (FY25), with 12,000+ hospitals actively submitting claims each month (FY26 coverage) — [FilingReader](https://filingreader.com/news-wire/mumbai/2025-08-30/medi-assist-reports-strong-fy25-performance-ahead-of-25th-agm); [Medi Assist MAtrix](https://mediassist.in/products/matrix/)
- Workflow reality: one bank transfer of ~₹12 lakh may cover 40-80 individual claims netted with deductions, making reconciliation manual and error-prone (vendor description) — [Patron Accounting](https://www.patronaccounting.com/blog/tpa-insurance-receivable-reconciliation-hospitals)
- PM-JAY claims are raised inside NHA's Transaction Management System (TMS 2.0) web application, separate from private-insurer portals and from NHCX — [Nirmitee](https://nirmitee.io/blog/nhcx-pmjay-tms-ayushman-bharat-claims/)
- Hospitals complained to ClaimBuddy's founders that insurers demand repeat documentation and payments are hard to recover (Forbes India profile, Jan 2026) — [Forbes India via Magzter](https://www.magzter.com/es/stories/business/Forbes-India/CLAIMS-ASSURED)
- Private hospital structure: a Maharashtra study found no reliable count of private hospitals exists and had to physically list them; surveys indicate most private hospitals have fewer than 50 beds — [NIPFP WP 254 (2019)](https://nipfp.org.in/media/documents/WP_254_2019.pdf)

### Inferences
- The realistic buyer universe is roughly 12,000-30,000 hospitals already transacting cashless claims monthly (Medi Assist's 12,000 active; IHX's 30,000 connected), plus ~15,700 private PM-JAY hospitals with heavy overlap. The long tail is sub-50-bed nursing homes with one or two desk staff.
- Each hospital deals with several workflows at once: insurer/TPA portals, IHX/Medi Assist rails, PM-JAY TMS, state-scheme portals, CGHS/ECHS. Fragmentation across portals, not a single integration, is the operational burden an AI operator would absorb.

### Gaps
- No sourced figure for total hospitals/nursing homes in India by bed size (commonly quoted ~70,000 total is not sourced here), nor a count of insurer-empanelled hospitals from IRDAI or the GI Council.
- No sourced data on insurance-desk headcount per hospital, salary cost, or cost per claim; no data on market size of outsourced hospital billing firms in India.

## 4. IRDAI 2024 master circular and NHCX: what changes, adoption status, open APIs

### Takeaway
The May 2024 master circular puts hard clocks on insurers (1 hour for pre-auth, 3 hours for discharge authorisation) and pushes 100% cashless, which raises the premium on clean, complete first-time submissions from hospitals. NHCX is live with FHIR-based open APIs and a sandbox that any HMIS/startup can onboard to via ABDM, but the only official adoption figures are from mid-2024 (34 insurers/TPAs live, ~300 hospitals preparing); I found no official 2026 volume numbers and governance was contested in 2025.

### Cited Findings
- IRDAI Master Circular on Health Insurance Business (29 May 2024) repealed 55 earlier circulars; insurer must decide cashless authorisation "immediately but not more than one hour" from receipt of request, and final discharge authorisation within three hours of the hospital's request; insurers to strive for 100% cashless; systems to be in place by 31 July 2024 — [ThePrint](https://theprint.in/economy/cashless-claims-within-an-hour-and-discharge-from-hospital-in-3-hours-says-irdais-master-circular/2107998); [The Week](https://www.theweek.in/news/india/2024/05/30/irdai-issues-new-master-circular-to-make-health-insurance-claims-process-more-seamless.html)
- Reimbursement claims: settlement within 30 days of documents, up to 45 days where investigation is needed (explainer) — [Ditto](https://joinditto.in/articles/health-insurance/cashless-health-insurance-claims-timelines/)
- NHCX went live with its first claim (HDFC Ergo) in June 2024; ~50 insurers in scope — [Wikipedia](https://en.wikipedia.org/wiki/National_Health_Claims_Exchange)
- Adoption: government release of July 2024 reported 34 insurers and TPAs live and ~300 hospitals preparing to send claims; an industry blog later said 47+ insurers/TPAs had connected to sandbox or live — [India Insurtech Summit blog](https://indiainsurtechsummit.com/blog/national-health-claims-exchange-nhcx/); a hospital-software vendor says a "significant gap in onboarding" remains on the provider side — [Hodo](https://hodo.in/post-nhcx-indian-hospitals-billing-faster-claims.html)
- Incentive: under NHA's Digital Health Incentive Scheme, hospitals get ₹500 per claim or 10% of claim amount, whichever is lower, for claims via NHCX (vendor guide, 2026) — [Nirmitee](https://nirmitee.io/blog/nhcx-pmjay-tms-ayushman-bharat-claims/)
- Integration path: registration via the ABDM sandbox portal using ABDM client credentials; provider identity is its Health Facility Registry ID; NHA expects software to be live on ABDM Milestone 1 in production before NHCX onboarding; sandbox-to-production certification steps exist — [Nirmitee onboarding checklist](https://nirmitee.io/blog/nhcx-onboarding-checklist-sandbox-to-production-hims/)
- PM-JAY is not on NHCX in production: the same vendor found no official source confirming PM-JAY claims flow over NHCX; they stay in TMS — [Nirmitee](https://nirmitee.io/blog/nhcx-pmjay-tms-ayushman-bharat-claims/)
- Governance: in July 2025 the Finance Ministry's Department of Financial Services sought to move control of NHCX from the Health Ministry to bring it under IRDAI-linked oversight — [Business Standard](https://www.business-standard.com/finance/news/fin-min-seeks-control-of-nhcx-from-health-ministry-to-boost-transparency-125071000958_1.html)

### Inferences
- NHCX lowers integration cost in principle (one FHIR API instead of dozens of portals), which reduces the moat of proprietary networks such as IHX and Medi Assist over time, but as of the latest evidence the volume still runs on those private rails and portals. A startup should plan for portal/email/RPA-style operation today and treat NHCX as an option, not a dependency.
- The 1-hour/3-hour clocks bind insurers, not hospitals. Their practical effect on hospitals is faster query round-trips: a query unanswered quickly becomes a denial or a delayed discharge, which favours always-on automated query handling.
- The ₹500/claim NHCX incentive is a small but real subsidy that a vendor could capture or pass through.

### Gaps
- No official 2025-2026 NHCX statistics (claims processed, hospitals live, insurers live) found; NHA/ABDM dashboards and PIB were not successfully retrieved. Whether the DFS takeover happened is unconfirmed.
- No evidence found on measured compliance with the 1-hour/3-hour rule or IRDAI enforcement actions specific to it.
- Did not verify the NHCX specification repository or API documentation first-hand; integration details rest on one vendor's blog.

## 5. Existing players in India and US analogues

### Takeaway
India has an incumbent "rail" layer (IHX, now owned by Perfios, claiming 40% of cashless claims; Medi Assist with ~10M claims a year and its MAtrix AI engine) and a thin, lightly funded layer of hospital-side claims startups (Care.fi ~US$8M Series A in 2026, ClaimBuddy US$5M Series A, Vitraya ~US$4M). Nobody has raised US-scale money for hospital-side AI RCM in India; in the US the category has rounds of US$16M-120M and prices at ~1-9% of collections.

### Cited Findings
India
- IHX: founded 2020 (spun out of Medi Assist's provider network business); acquired by Perfios in April 2025, terms undisclosed (one tracker lists US$35.8M); claims 40%+ of India's cashless claims, 10M+ transactions and US$1bn claims a year, 30,000+ hospitals, 30+ payers — [YourStory](https://yourstory.com/2025/04/perfios-buys-healthcare-information-exchange-platform-ihx); [Inc42](https://inc42.com/buzz/perfios-buys-healthcare-information-exchange-firm-ihx-in-third-bet-this-year); [MergerLinks](https://app.mergerlinks.com/transactions/2025-04-25-ihx-private-limited)
- Medi Assist (listed TPA): 8.9M+ claims in FY25, 10.0M in FY26 (2.2M cashless IP, 2.7M cashless OP); FY26 revenue ₹904.8 crore (~US$106M), up 25%; acquired Paramount Health Services TPA for ₹412.44 crore (closed 1 July 2025); MAtrix described as an AI claims engine with integration to 10,000+ network hospitals and sub-one-hour cashless authorisation — [Free Press Journal](https://www.freepressjournal.in/business/medi-assists-revenue-rises-25-to-9048-crore-turns-debt-free); [Medi Assist MAtrix](https://mediassist.in/products/matrix/); [FilingReader](https://filingreader.com/news-wire/mumbai/2025-11-05/medi-assist-reports-strong-h1-fy26-growth-strategic-advancements)
- Care.fi (Gurugram): US$8M Series A in Feb 2026 (US$5M equity led by July Ventures with Peak XV, Accion, Sadev; ~US$3M debt from Trifecta and Vivriti); products RevNow (AI RCM: pre-auth to settlement) and CareCred (insurance receivables and supply-chain financing via NBFC partners/own NBFC licence); acquired Aldun (billing/discharge automation, 300+ hospitals and clinics) in Jan 2026; claims ₹800 crore+ of claims handled across 300+ hospitals and funds to hospitals within 3-5 days of discharge (vendor claims); plans US and Middle East expansion — [ImpactAlpha](https://impactalpha.com/?p=123744); [CXOToday](https://cxotoday.com/press-release/care-fi-launches-revnow-indias-smartest-ai-enabled-rcm-platform/); [Media Infoline](https://www.mediainfoline.com/brand/care-fi-strengthens-its-leadership-in-healthcare-claims-processing-with-inr-7-5-cr-debt-funding)
- ClaimBuddy: US$5M Series A (2024) led by Bharat Innovation Fund with CAC Capital, Chiratae, Rebright, after a US$3M pre-Series A; claims processed for 35,000+ patients worth ₹500 crore+ (vendor claim); started as patient-side claim assistance and sells through hospital partnerships — [Outlook Business](https://www.outlookbusiness.com/companies/claimbuddy-secures-5-million-in-series-a-funding); [Entrepreneur India](https://www.entrepreneur.com/en-in/news-and-trends/healthtech-startup-claimbuddy-raises-3-million-in/420826)
- Vitraya Technologies (Mohali, founded 2019, ex-MobiKwik COO): ₹34 crore (~US$4.1M) pre-Series A led by StartupXseed; real-time automated adjudication between hospitals and insurers; founder-stated reach of 4,000 hospitals (unverified) — [Inc42](https://inc42.com/buzz/former-mobikwik-coos-insurtech-startup-vitraya-technologies-raises-inr-34-cr-funding/amp); [Lapaas Voice](https://lapaasvoice.com/startup/vitraya-technologies/business-model/)
- New entrants marketing AI claims tooling to hospitals (small, vendor sites only): Docxtract, Caladrius Health, Hodo, Adrine — [Docxtract](https://docxtract.io/blog/tpa-claims-processing-document-pipeline/); [Caladrius](https://caladriushealth.ai/what-is-nhcx/)

US analogues
- Smarter Technologies (New Mountain Capital roll-up of SmarterDx, Thoughtful.ai and Access Healthcare, 2025): CEO says typical RCM vendors charge 5-9% of collections and it targets 1-1.5% — [MedCity News](https://medcitynews.com/2025/05/rcm-healthcare-technology)
- Candid Health: US$120M Series D led by Sixth Street Growth; 190% YoY contracted run-rate growth and 180% net dollar retention in 2025 — [Fierce Healthcare](https://fiercehealthcare.com/health-tech/candid-health-secures-120m-series-d-funding-ai-powered-rcm-ramps); pricing reported by a secondary blog as ~3% of collections, or 3% + US$6 per claim with coding — [New Market Pitch](https://newmarketpitch.com/blogs/news/healthcare-ai-medical-billing-startup)
- AKASA: US$200-250M raised (sources differ); markets performance-based pricing with no upfront fees for its mid-cycle suite; Infinx: consultative annual contracts, from ~US$5,000 a month — [RFP.wiki comparison](https://www.rfp.wiki/specialty-industries/healthcare-life-sciences/healthcare/revenue-cycle-management-software/akasa/infinx)
- Amperos Health (AI denial management): US$16M Series A led by Bessemer, Apr 2026 — [HLTH](https://hlth.com/insights/news/amperos-health-secures-16m-series-a-led-by-bessemer-to-scale-ai-denial-management-platform); Arintra (autonomous coding): US$25M Series B, US$51M total — [BioSpace](https://www.biospace.com/press-releases/arintra-raises-25m-to-pioneer-revenue-assurance-for-americas-health-systems); Adonis: US$40M — [PYMNTS](https://www.pymnts.com/?p=3592755)

### Inferences
- The control points are owned by payer-side incumbents: IHX and Medi Assist sit between hospitals and insurers and are adding AI themselves. A hospital-side AI operator is structurally on the opposite side of the table from them (maximising hospital recovery vs controlling insurer payout), which is both the opening and the risk (they control the portals you depend on).
- Care.fi is the closest direct competitor to an "AI operations company for hospital claims", and its model bundles software with receivables financing, suggesting software/service fees alone have been hard to monetise.
- Total disclosed venture funding across Care.fi, ClaimBuddy and Vitraya is under ~US$25M, versus single US rounds of US$120M, consistent with a much smaller revenue pool per claim in India.

### Gaps
- No results at all for Altair Health or Hesper AI; could not confirm they exist as described.
- Nothing found in this pass on Remedinet (current status), Hulp, CarePay, or claims-specific products from Eka Care, HealthPlix or Qure.ai.
- No revenue figures for Care.fi, ClaimBuddy, Vitraya or IHX; weaknesses listed are inferred, not reported.

## 6. Willingness to pay and pricing models in India

### Takeaway
I found no published India pricing for any hospital-side claims vendor; this is the weakest part of the fact base. The only quantified anchors are US contingency rates (1-9% of collections), the ₹500-per-claim NHCX incentive, and the average claim payout of ~₹28,910.

### Cited Findings
- No pricing disclosed for Care.fi RevNow; it is sold alongside receivables financing (CareCred) — [CXOToday](https://cxotoday.com/press-release/care-fi-launches-revnow-indias-smartest-ai-enabled-rcm-platform/); [ImpactAlpha](https://impactalpha.com/?p=123744)
- US benchmark: 5-9% of collections for traditional RCM vendors; 1-1.5% targeted by Smarter Technologies — [MedCity News](https://medcitynews.com/2025/05/rcm-healthcare-technology); Candid ~3% of collections (secondary source) — [New Market Pitch](https://newmarketpitch.com/blogs/news/healthcare-ai-medical-billing-startup)
- NHCX incentive to hospitals: ₹500 per claim or 10% of claim amount, whichever is lower — [Nirmitee](https://nirmitee.io/blog/nhcx-pmjay-tms-ayushman-bharat-claims/)
- Average health claim payout FY25: ₹28,910 (~US$340) — [India Med Today](https://indiamedtoday.com/record-health-insurance-claims-settled-in-fy25-average-payout-per-claim-declines/)
- Hospitals' stated grievances centre on tariffs, deductions and payment delay (AHPI 2025), i.e. they see the problem as money withheld by payers — [Outlook Money](https://www.outlookmoney.com/news/ahpi-hospitals-to-suspend-cashless-treatment-for-bajaj-allianz-policyholders-from-september-1)

### Inferences
- Illustrative sizing (my arithmetic, assumptions flagged): 1.5% of the ~₹62,500 crore cashless payout pool is ~₹940 crore (~US$110M) a year; 3% is ~₹1,875 crore (~US$220M). At US-style 5-9% the number is larger, but Indian hospital margins and the small ticket (~₹29,000 average claim) make that unlikely. A per-claim fee of ₹100-300 on ~1.9 crore cashless claims would be ₹190-570 crore (~US$22-67M). These are ceilings assuming full penetration, not forecasts.
- Because hospitals frame the pain as withheld money, pricing tied to recovered deductions/denials or faster cash (as Care.fi's financing bundle implies) is likely easier to sell than SaaS seats; this is inference, not evidence.

### Gaps
- No evidence on actual prices paid (per claim, % of recovery, or subscription) by Indian hospitals, on outsourced desk contract terms, or on hospital software budgets. Primary interviews with hospital CFOs and insurance-desk heads are needed.

## 7. India as an offshore base for US medical coding / RCM, and AI disruption (brief)

### Takeaway
India is the dominant delivery base for US RCM (Zinnov: over 60% of the global RCM workforce; vendor estimate 300,000+ healthcare BPM staff) serving a US RCM spend of US$110bn+ heading to US$200bn+; market-size estimates for the India-based industry vary from ~US$1bn (coding only) to US$4-11bn depending on scope. AI is being embedded by the incumbents and a PE roll-up (Smarter Technologies, built on India's Access Healthcare) is explicitly repricing from 5-9% to 1-1.5% of collections.

### Cited Findings
- US healthcare spend ~US$5tn (2024) with US$110bn+ on RCM, projected US$200-210bn by 2029; India hosts "over 60% of the global RCM workforce"; 74% of RCM service providers embed AI — [Zinnov](https://zinnov.com/centers-of-excellence/the-200-billion-question-why-the-future-of-healthcare-rcm-may-belong-to-india)
- 300,000+ professionals in India's healthcare BPM roles; 100,000+ medical coders trained annually (market-research blog estimate) — [Nexdigm](https://www.nexdigm.com/market-research/insights/blog/india-healthcare-bpo-services-industry/)
- Market-size estimates (different scopes, not comparable): India medical coding US$954M in 2025, 10.15% CAGR 2026-34 — [IMARC](https://www.imarcgroup.com/india-medical-coding-market); India RCM US$4.0bn in 2025 — [Ken Research](https://www.kenresearch.com/industry-reports/india-revenue-cycle-management-market); India RCM US$4.8bn in 2024, US$15.0bn by 2033 — [IMARC](https://www.imarcgroup.com/india-revenue-cycle-management-market); India healthcare BPO ~US$11.35bn in 2025, ~US$21.7bn by 2030 — [MarketsandMarkets](https://www.marketsandmarkets.com/Market-Reports/geography/healthcare-outsourcing-bpo-market/India)
- 70% of US hospitals/health systems plan to expand offshore RCM engagements — [Outsource Accelerator](https://news.outsourceaccelerator.com/us-hospitals-rcm-india/)
- Smarter Technologies combines SmarterDx, Thoughtful.ai and India-headquartered Access Healthcare, targeting 1-1.5% of collections vs the 5-9% norm — [MedCity News](https://medcitynews.com/2025/05/rcm-healthcare-technology)
- US RCM firm Cosentus positions its India centre as its AI development hub for coding and denial management (June 2026) — [YourStory](https://yourstory.com/enterprise-story/2026/06/cosentus-sees-india-centre-as-key-ai-pillar-for-us-healthcare-sector)

### Inferences
- The US-facing RCM export business is one to two orders of magnitude larger in revenue than the domestic Indian hospital claims opportunity sized in section 6, and it is where talent trained in claims operations already sits.
- The 5-9% to 1-1.5% repricing claim implies AI is compressing price per unit of work by roughly 4-6x in the US; a domestic Indian business should expect to price at or below the low end from day one.

### Gaps
- No NASSCOM or audited headcount for India's RCM/coding workforce; no independent data on AI-driven job losses or headcount changes at Omega, AGS Health, GeBBS or Access Healthcare.
