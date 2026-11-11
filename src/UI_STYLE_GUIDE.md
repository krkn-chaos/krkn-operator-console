# UI Style Guide

Conventions for building UI in `krkn-operator-console`. **Any agent or developer writing UI MUST follow this guide** so pages stay visually and behaviorally consistent.

Stack: React 18 + TypeScript + [PatternFly 5](https://www.patternfly.org/) (`@patternfly/react-core`, `@patternfly/react-table`, `@patternfly/react-icons`). Vite build. Font: Inter (set in `src/index.css`).

> When a pattern below cites a "Canonical" component, open that file and copy its structure rather than inventing a new one.

---

## 1. Buttons & Icons

### Icon library

- **Use `@patternfly/react-icons` ONLY** in new code.
- Do **not** add `react-icons` (`react-icons/fi`, etc.). It still appears in legacy components (`Studio/*`, `JobsList.tsx`, `FileManagement/*`); migrate those to PatternFly icons opportunistically, never add more.

### Standard icon map

Use the same icon for the same action everywhere:

| Action   | Icon            |
|----------|-----------------|
| Edit     | `EditIcon`      |
| Delete   | `TrashIcon`     |
| View     | `EyeIcon`       |
| Add/New  | `PlusCircleIcon`|
| Password | `KeyIcon`       |
| Overflow | `EllipsisVIcon` |

### Button variants

- **Icon buttons (edit/delete/view in a row)**: `Button variant="plain"` with a **required** `aria-label`.
  ```tsx
  <Button variant="plain" aria-label="Edit user" onClick={onEdit}>
    <EditIcon />
  </Button>
  ```
- **Primary action** (create/add, one per view): `Button variant="primary" icon={<PlusCircleIcon />}`.
- **Destructive action**: `Button variant="danger"` — only **inside a confirmation modal**, never a direct inline delete.
- **Overflow / multiple row actions**: `Dropdown` + `MenuToggle` using `EllipsisVIcon` (toggle `variant="plain"`).

Canonical: [`src/components/UsersCard.tsx`](components/UsersCard.tsx) — plain icon buttons, `aria-label`, overflow dropdown, primary add button, and danger confirm modal.

---

## 2. Loaders & States

### Loading

- **Full-view / page load**: reuse [`LoadingScreen.tsx`](components/LoadingScreen.tsx) — `EmptyState` + `EmptyStateIcon icon={Spinner}` + `Title size="lg"` + `EmptyStateBody` message.
- **Standalone spinner** (section/card loading): `Spinner` default (`md`).
- **Inline / inside a button**: `Spinner size="sm"`.
- Use `size="xl"` only for a deliberate large centered spinner. Do not pick spinner sizes ad hoc — stick to `sm` (inline), `md` (section), `xl` (large centered).

### Empty state

Every list/table MUST handle the empty case with `EmptyState` + icon + `Title` + `EmptyStateBody` + a guidance action (e.g. the create button). Canonical: empty branch in [`UsersCard.tsx`](components/UsersCard.tsx).

### Error state

- Transient errors (action failed): notify via the `useNotifications` hook (`src/hooks`).
- Load failures: render an error `EmptyState` with a retry affordance rather than a blank screen.

---

## 3. Tables, Forms & Modals

### Tables

- Tabular data: `@patternfly/react-table` (`Table, Thead, Tr, Th, Tbody, Td`). Canonical: [`FileManagement/FilesTable.tsx`](components/FileManagement/FilesTable.tsx), [`CategoryManagement/CategoriesTable.tsx`](components/CategoryManagement/CategoriesTable.tsx).
- `DataList` only for card-style / row-detail layouts, not grids. Canonical: [`UsersCard.tsx`](components/UsersCard.tsx).
- Long lists: paginate with the `usePagination` hook (`src/hooks/usePagination`) + PatternFly `Pagination`.

### Forms

- Build with `Form` / `FormGroup` from `@patternfly/react-core`.
- Schema-driven forms: reuse [`DynamicFormBuilder.tsx`](components/DynamicFormBuilder.tsx) instead of hand-rolling fields.

### Modals

- Use `Modal` + `ModalVariant`.
- **Create/edit form in a modal**: reuse the shared [`FormModal.tsx`](components/FormModal.tsx) shell (`ModalVariant.medium`).
- **Confirm-delete**: `ModalVariant.small` + a `variant="danger"` confirm button + a cancel button. Canonical: delete flow in [`UsersCard.tsx`](components/UsersCard.tsx).

---

## 4. Accessibility & general

- Every icon-only control needs an `aria-label`.
- Use semantic PatternFly components over raw `<div>` styling.
- Prefer PatternFly components and global tokens over inline `style={{...}}`; when inline styling is unavoidable, use `var(--pf-v5-global--*)` tokens, never hardcoded hex or px.

---

## Future (not yet enforced)

Design-token section: formalize color / spacing / typography on `var(--pf-v5-global--*)`, ban hardcoded hex/px, and standardize on Inter. Add when prioritized.
