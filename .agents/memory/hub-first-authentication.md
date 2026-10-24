---
name: Hub-first authentication
description: Madhorse's required destination after account creation and sign-in.
---

After a successful sign-up or log-in, send the user to the authenticated Madhorse Hub first. The Hub is the entry point for Studio and Vision Board.

**Why:** the user asked that new users land on the Hub before accessing the rest of the app.

**How to apply:** Route account success/fallback redirects and signed-in home visits to `/hub/`. Keep the Hub protected; provide links from it to Studio and Vision Board.
