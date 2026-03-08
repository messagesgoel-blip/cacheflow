# Deploy Prune Guard

Date: 2026-03-08

Goal:
- stop `deploy.sh` from failing after a successful rollout when Docker image pruning hits a running `cacheflow` image

Problem:
- the previous prune step sorted tags lexically instead of using Docker's native newest-first image order
- SHA tags could be misordered relative to manual tags and selected for deletion
- when `docker rmi --force` hit an image still attached to a running container, the deploy exited non-zero even though the services were already updated

Change:
- prune by Docker's returned image order instead of manual tag sorting
- dedupe by image ID, not tag name
- protect any image currently referenced by a running container whose configured image is `cacheflow:*`
- keep the newest 3 non-running cacheflow builds
- convert prune failures into warnings so rollout success is not reported as a deploy failure

Non-goals:
- this does not reduce the large web Docker build context
- this does not change compose service definitions
