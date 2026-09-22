# Team Tracker UI

Static front end of a private team tracker (projects, people, learning progress, activity log).
This copy holds **no data**: on first open go to **Data → Connect to GitHub** and paste a
fine-grained personal access token for the private repository that stores `data/*.json`
(Contents: read and write, that one repository only). The token stays in your browser and is sent
only to api.github.com.

The UI source of truth lives in the private repository; this copy is refreshed with its
`tools/publish_ui.py`.
