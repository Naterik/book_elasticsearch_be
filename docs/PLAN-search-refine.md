# Plan: Refine Search & Filter Logic (Navigation vs Discovery)

## Goal
Implement "Google-like Navigation" for search suggestions, ensuring that selecting a specific suggestion triggers an "Absolute Search" (exact ID match) while preserving broad "Discovery Search" for general queries.

## Tasks
### Phase 1: Backend Implementation (Completed)
- [x] Modify `suggest.elastic.ts`: Return not just title/author text, but also `id` in the API response. → Verify: API returns `[{ text: "Stone Cold", id: 2936, ...}]`.
- [x] Refactor `search.controller.ts`: Add `exactId` logic. If `exactId` is present, bypass fuzzy/description search and filter strictly by ID. → Verify: `search?exactId=2936` returns exactly 1 book, ignoring description matches.
- [x] Add comments to Backend code explaining the 2 modes (Navigation vs Discovery).

### Phase 2: Frontend Integration Plan (Actionable for FE Team)
- [ ] **Update Suggestion Component**:
    - Modify the click handler on suggestion items.
    - Instead of setting the input value and searching text, grab the `id` from the suggestion object.
    - Router push to: `/search?exactId={id}` (or handle state management equivalent).
- [ ] **Handle Search Input ("Enter" key)**:
    - Keep existing behavior. If user types "Stone" and hits Enter (without clicking suggestion), Router push to: `/search?q=Stone`.
- [ ] **UX Improvement (Auto-Reset)**:
    - When `exactId` is present in URL/State (Absolute Mode), show a clear "Viewing specific book: [Title]" badge.
    - **Critical:** If user clicks any Filter (Author, Year, Genre), **REMOVE** `exactId` and switch back to broad search mode (`?q={Title}&year=2020`) because "Short Desc" might be relevant for filtering again.
    - *Reasoning:* Filters imply exploration. Absolute ID implies specific navigation. Don't mix them blindly.

## Verification Checklist
- [ ] Selecting "Stone Cold" from dropdown -> Shows 1 result (Book ID 2936). "Martin the Warrior" must NOT appear.
- [ ] Typing "Stone Cold" + Enter -> Shows all results with "Stone Cold" in title/desc.
- [ ] Searching with `exactId` + adding a valid Filter -> Should still return the book (if it matches filter).
- [ ] Searching with `exactId` + adding an invalid Filter -> Returns 0 results.
