## 🧑‍💻 Development

This project supports a development environment with hot-reloading for the dashboard frontend and backend. This is achieved using a `docker-compose.override.yml` file.

### Frontend and API (Dashboard)

1.  **Enable Development Mode**: To start, make a copy of the example override file.
    ```shell
    cp example.docker-compose.override.yml docker-compose.override.yml
    ```
2.  **Start the Stack**: Launch the services. `docker compose` will automatically detect and use both files.
    ```shell
    docker compose up -d --build --force-recreate
    ```

This development setup starts a separate `dashboard-dev` container running the Vite dev server for the frontend. The main `dashboard` backend container uses `nodemon` to watch for file changes. Any updates to the API or frontend source code will be updated automatically in the running containers.

You should set the DNS server for your development device to 127.0.0.1 in order to test the pages with their actual domain names.

### Host API

To work on the Host API locally with hot-reloading, you can run it directly on your Arch Linux host.

```shell
# Navigate to the host API directory
cd ./services/dashboard/host-api/

# Install dependencies
npm install

# Start the dev server with nodemon
npm run dev
```


### Git Hooks (Pre-commit Version Sync & Pre-push Validation)

Validation and version synchronization hooks are stored and tracked in `.githooks/` and `puzzle-plus-plus/.githooks/`.

To enable Git hooks locally:

```bash
git config core.hooksPath .githooks
(cd puzzle-plus-plus && git config core.hooksPath .githooks)
```

- **`pre-commit`**: Automatically runs `scripts/sync-version.sh` to synchronize `VERSION` numbers across all `package.json` files and `CMakeLists.txt` *before* a commit is saved into git history.
- **`pre-push`**: Runs ESLint, TypeScript `tsc --noEmit`, Python syntax checks, Ansible syntax checks, `clang-format`, and `ctest` unit tests *before* pushing to GitHub.

## Next: 7\. ❓ Troubleshooting
[Continue to the next section of the guide for detailed instructions on troubleshooting common issues.](./7-troubleshooting.md)