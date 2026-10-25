---
name: App Storage permission checks
description: Object access can succeed even when bucket metadata access is forbidden.
---

Validate App Storage with the specific object operation the feature needs, not
with a bucket metadata request.

**Why:** The workspace's sidecar credentials returned 403 for bucket metadata
while uploading, reading and deleting a temporary tutorial object all succeeded.
Bucket-level and object-level permissions are different.

**How to apply:** Do not treat a bucket metadata 403 as proof that asset storage
is unavailable. Check a uniquely named temporary object and remove it afterward;
never print storage credentials or configuration values while diagnosing access.
