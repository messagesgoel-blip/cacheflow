# Deploy Fast-Forward Update

Date: 2026-03-08

## Scope

- remove `git pull` from `deploy.sh`
- use `git fetch origin main` followed by `git merge --ff-only FETCH_HEAD`

## Reason

- `/opt/docker/apps/cacheflow` is the canonical deploy checkout
- local `pull.rebase` settings can still make `git pull --ff-only origin main` fail even when the repo is clean
- deploys should not depend on per-host pull behavior

## Verification

- `bash -n deploy.sh`
- rerun `./deploy.sh` from a clean `/opt/docker/apps/cacheflow` checkout
