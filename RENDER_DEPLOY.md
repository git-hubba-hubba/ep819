# Deploy AmethystPlus to Render

The repository is prepared for one Node web service serving the React build and API on the same HTTPS origin. `render.yaml` configures a paid Starter instance and a 1 GB persistent disk. No cloud services have been created.

## Your remaining steps

1. Put this project in a GitHub repository, with `render.yaml`, `backend/`, and `frontend/` at its root. Include `frontend/amethyst-ep/package-lock.json`. Do not upload `.env`, `backend/data`, `node_modules`, or `dist`; the root `.gitignore` excludes them. If Git reports the Xcode license error on this Mac, complete Apple's license setup first, or use GitHub's web interface to upload the source files selectively.
2. In Render, choose **New → Blueprint**, connect your repository, and use `render.yaml` from the repository root.
3. Enter `ADMIN_EMAIL` and `ADMIN_PASSWORD` when prompted. Use a password of 12–128 characters. Enter plain values without quotes. `ADMIN_NAME` defaults to Rachel and can be changed in Render.
4. Review the paid Starter service and 1 GB disk, then deploy.
5. Open the service's HTTPS URL. The server automatically uses Render's `RENDER_EXTERNAL_URL` for its authentication origin, so there is no URL placeholder to fill in.
6. Sign in as admin, add a person and ticket, restart the service, and confirm they remain. Sign up separately as a reader to verify read-only access.

Your local data and passwords are not automatically copied to Render. The hosted database starts empty and creates the admin using Render's environment variables. Changing those variables later does not reset an existing admin password.

## Service configuration

- Build: `npm ci --include=dev --prefix frontend/amethyst-ep && npm run build --prefix frontend/amethyst-ep`
- Start: `node backend/render.mjs`
- Health check: `/healthz`
- Node: `24.20.0`
- Disk mount: `/var/data`
- Database: `/var/data/amethyst.sqlite`
- Origin: automatically from `RENDER_EXTERNAL_URL`; for a custom domain, set `APP_ORIGIN` to its exact HTTPS origin and redeploy. Use that domain to sign in.

Keep one service instance: this app uses local SQLite. The disk preserves users, sessions, tickets, roadmap entries, team profiles, and uploaded photos. Take database backups before deleting or replacing the disk.

## Local verification

```sh
npm run build --prefix frontend/amethyst-ep
npm run lint --prefix frontend/amethyst-ep
npm test --prefix backend
```

The tests use temporary databases and include a production-server check of frontend assets, API login, secure cookies, and private-file blocking. Production tests require the frontend build first. Local development still uses the existing backend `npm start` and frontend `npm run dev` workflow.

## References

- https://render.com/docs/blueprint-spec
- https://render.com/docs/disks
- https://render.com/docs/environment-variables
