# Thesis Registration Portal Prototype

This prototype showcases the interactive thesis management experience that was
requested. It contains the following key pieces:

- **Landing dashboard** featuring the academic calendar, day/week/month view
  toggles, Buddhist calendar formatting, and an always-on sidebar for
  navigation.
- **Topic exploration workflow** with multi-student selection, advisor and
  thesis type capture, inline editing of submissions, and name de-duplication
  tools.
- **Placeholder registration screens** for the remaining flows so visitors know
  they are still under construction.
- **Thai/English localisation** toggle with all copy driven by a translation
  table.

## Getting started

1. Serve the files from the repository root. For a quick preview you can run:
   ```bash
   python -m http.server 8000
   ```
2. Open `http://localhost:8000` in your browser and you will see the fully
   interactive interface.

All dates are pre-populated with academic-year (พ.ศ.) specific examples so you
can explore how the filtering behaviour works.
