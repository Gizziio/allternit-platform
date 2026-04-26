# Action Plan: Phase 6 Frontend (Assistant & Proactivity)

## Goal
Integrate the Phase 4 & 5 Kernel features (Assistant Identity, Agent Templates, Proactive Suggestions) into the Shell UI.

## Phase 6: Frontend Integration
1.  **Shared Contracts**:
    *   Update `apps/shared/contracts.ts` to include `AssistantIdentity` and `Suggestion` interfaces matching the Kernel types.
2.  **API Client**:
    *   Create `apps/shell/src/runtime/ApiClient.ts` to centralize Kernel API calls (fetching assistant, suggestions, etc.).
3.  **Components**:
    *   **AssistantProfile**: A sidebar or header widget displaying the Assistant's Persona and Name. Allows editing via a modal.
    *   **SuggestionWidget**: A floating or sidebar widget showing active `Suggestion` items from the State Engine.
    *   **AgentTemplateSelector**: A component to view available agent templates (optional for now, but good for "New Capsule" flow).
4.  **Wiring**:
    *   Update `App.tsx` to fetch Assistant and Suggestions on load/interval.
    *   Pass this state to the `CommandBar` or a new `ShellHeader`.

## Affected Files
*   `apps/shared/contracts.ts`
*   `apps/shell/src/runtime/ApiClient.ts` (New)
*   `apps/shell/src/components/AssistantProfile.tsx` (New)
*   `apps/shell/src/components/SuggestionWidget.tsx` (New)
*   `apps/shell/src/App.tsx`
*   `apps/shell/src/styles.css` (For new widgets)

## Breaking Changes
*   None. Purely additive to the UI.

## Verification
*   Manual verification by running the shell (`npm run dev`) and checking if the Assistant appears and Suggestions populate when a Goal is added.
