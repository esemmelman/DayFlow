DayFlow Design Standards (apply to all code changes)

General
- Preserve all existing functionality unless the task explicitly requires changing it.
- Refactor rather than duplicate code.
- Keep the render pipeline centered around renderSelectedDay().
- Do not introduce redundant render paths or duplicate event handlers.
- Keep JavaScript modular and maintainable.

Platform Support
- DayFlow is a Progressive Web App (PWA).
- Every feature must work equally well on:
  • Windows desktop browsers
  • Android Chrome
- Do not implement desktop-only solutions.

Responsive Design
- Mobile-first responsive design.
- Support screens from 360px wide through large desktop monitors.
- Use CSS Grid and Flexbox.
- Avoid absolute positioning except where absolutely necessary.
- Avoid fixed pixel heights when content can grow.
- Use relative sizing where practical.

Touch Support
- Every feature must support:
  • mouse
  • touch
  • stylus
- Never rely on hover.
- All buttons and controls should be at least 48px tall for comfortable touch interaction.
- Leave adequate spacing between touch targets.

Dialogs
- Use responsive modal dialogs.
- On phones:
    - nearly full-screen
    - vertically stacked controls
- On desktop:
    - centered dialog
- Use native HTML controls whenever appropriate:
    input[type=date]
    input[type=time]
    textarea
    select

Timeline
- Timeline rows should grow automatically with their contents.
- Never use fixed heights that can clip appointments.
- Time, add button, and appointments each occupy their own grid column.
- Avoid inline styles for layout.
- Avoid layout hacks using margin-left or width: calc(...).

Performance
- Minimize DOM rebuilds.
- Render only what changes.
- Avoid unnecessary event rebinding.
- Prefer event delegation where appropriate.
- Keep scrolling smooth on Android devices.

Accessibility
- Keyboard accessible.
- Screen-reader friendly where practical.
- Good color contrast.
- Visible focus indicators.
- Use semantic HTML.

Code Quality
- Remove obsolete code after refactoring.
- Avoid duplicate functions.
- Keep CSS organized.
- Add concise comments only where they improve understanding.

Future Compatibility
Design new features so they can later support:
- recurring appointments
- reminders
- drag and drop
- categories/colors
- synchronization
- notifications
without requiring major rewrites.

When completing each task:
1. Preserve existing behavior.
2. Keep desktop compatibility.
3. Keep Android compatibility.
4. Keep the PWA installable.
5. Explain any architectural changes made.