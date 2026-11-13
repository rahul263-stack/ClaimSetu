# ClaimSetu

ClaimSetu is a hospital-side claims audit and recovery project. Its MVP helps hospital teams review insurer deductions, prepare appeals for human approval, check bills against payer rules, and track recovery outcomes.

## MVP

The runnable application is in [`mvp/`](mvp/). See its [README](mvp/README.md) for requirements, setup, workflow, and current limitations.

```powershell
cd mvp
npm install
npm start
```

Open http://localhost:4173. The demo uses synthetic sample documents and synthetic payer rules. Do not upload real patient data without appropriate authorization and security controls.

## Project materials

- [`architecture/`](architecture/) contains the platform architecture and workflow diagrams.
- [`reports/`](reports/) contains the product thesis and operating model.
- [`research_notes/`](research_notes/) contains supporting research.

This repository is an early prototype, not a production-ready healthcare system.