# AmethystPlus

A React workspace built around the AmethystPlus badge. Its three circles open separate components:

- **Tickets:** searchable action register, priority/status/owner filters, sorting, summary filters, ticket detail panels, and admin-only creation/editing.
- **Roadmap:** editable phases 1.0–3.0, a monthly Gantt timeline, key milestones, owner/status/year filters, and execution linked to tickets.
- **Team:** ownership groups with their open/completed counts and ticket lists.

Users sign up with read-only access. Only the separately provisioned administrator can create tickets, assign owners, change status, and edit notes. The API enforces these permissions regardless of which controls are visible in the UI.

## Run

Requires Node.js 24+. Start the API first, following [backend setup](../../backend/README.md), including initial administrator provisioning. Then from this directory:

```sh
npm install
npm run dev
```

Open http://localhost:5173. Vite forwards `/api` requests to http://127.0.0.1:3001. Both processes must be running. For a frontend preview (`npm run preview`), start the backend with `APP_ORIGIN=http://localhost:4173`.

```sh
npm run build
npm run lint
```

Run backend integration tests with `npm test` from `backend`.

## Roadmap execution

The second circle opens an empty program roadmap using the three-phase format from the supplied image. Select a workstream or timeline bar to inspect it. Admins can add workstreams and edit phase, owner, month-level dates, status, milestone markers, and execution notes. Readers can inspect the same timeline and linked tickets.

**Start & create ticket** creates one assigned action item with a due date on the last day of the target month. **Mark complete** and **Reopen workstream** update that same ticket. Repeated Start requests cannot create duplicates. Editing a linked roadmap item updates its ticket title, owner, status, and due date; existing ticket notes remain intact. Updating the linked ticket's owner or status updates the roadmap, too. Ticket dates/titles do not change the roadmap's month-level plan. Concurrent edits are rejected until the view is refreshed.

Roadmap execution tracks work in this application; it does not automatically perform external business tasks. Restart the backend after upgrading to initialize the new roadmap table without replacing existing tickets or accounts.

The workspace starts empty. Create tickets and assign owners to populate the dashboard and team view.

## People & ownership

In Team, admins can choose **Add person** to save a name, position, email, and optional profile image (PNG/JPEG/WebP, up to 512 KB). Cards show contact details, ticket counts, an Edit control, and **Assign ticket**, which opens a new ticket with the owner filled in. Saved names are also suggested in ticket and roadmap owner fields. Existing tickets can be reassigned through their Edit form. Readers can browse the directory and action items but cannot edit profiles.

Profile edits persist across restarts. Renaming a person updates matching ticket and roadmap ownership. Profiles do not create login accounts or send invitations. Restart the backend after upgrading to initialize the team table.
