# AI Chat activity progress

`AiChatMessageList` renders `AiChatActivityProgress` for the active assistant
response and for recorded retrieval activity. The panel is open while a response
is streaming and can be collapsed or expanded with the pointer or keyboard.

- The initial status means a response is being prepared. It does not claim a
  search has occurred before receiving an actual SSE step.
- Real-time `step` events carry optional `id` and `status` (`running`,
  `completed`, `failed`) for `session_context`, `thinking` planning, `tool`
  calls, and `answer` synthesis/citation verification. Steps with matching `id`
  update in place without duplicating timeline rows; legacy `step` frames
  without `id` still append cleanly. A `delta` changes the public status to
  writing the answer.
- The status uses a typewriter effect, with one stable live-region announcement
  per status. Reduced-motion preferences show the full text without typing.
- `thinking` step payloads are replaced with the localized planning step label
  (`activityStepThinking`); private reasoning and raw tool arguments/errors are
  never rendered. Canonical SAG tool labels are localized across English and
  Vietnamese while custom tool labels render verbatim.
- Completed, failed and cancelled responses stop their timers and animation.
  Their messages remain distinct; a failed or stopped response is never labelled
  ready. Only the active activity region has `aria-busy=true`.
- Client timestamps and sanitized execution-trace steps from the completed
  stream are remembered in memory by message ID during the current workspace
  session (and cleared on project switch), including after the final response is
  refetched in empty-source scopes. They are not added
  to the API or database. Reloaded historical activity without those timestamps
  has no invented elapsed time.
- English and Vietnamese use matching `AiChat.activity*` translation keys.

## Validation

### Stable composer layout

AI Chat has one docked composer in both the welcome screen and active threads;
the Chat/Work switch is no longer displayed. Creating the first thread does not
replace the textarea or lose keyboard focus. The greeting and prompt suggestions
remain in the separate, flexible content region.

Automatic message scrolling and jumps to session references scroll only the
message-list container. They must not use `scrollIntoView` across the surrounding
canvas: that also scrolls overflow-hidden ancestors and moves the composer.
The message region shrinks within the viewport while the composer stays at its
bottom. A multiline draft can grow upward naturally within its existing limit.

Regression tests cover absence of both mode switches and textarea identity/focus
through Enter, thread creation, streaming and completion. Live verification uses
the authenticated local app at 390, 768, 1280 and 1440 pixels. No API, database,
authentication or provider change is part of this layout fix.

### No-answer presentation follow-up

A completed `no_answer` response is presented as one localized explanation,
including guidance to clarify the question or check searchable documents. Copy
uses that displayed explanation. Failed/cancelled responses retain their own
terminal state and partial content. Genuine English answers remain unchanged.

For history without the transient `answerStatus`, only the exact canonical SAG
fallback with no document/session citations is treated as an abstention. An
explicit `answered` status takes precedence. No API or persistence field is
added. `AiChatMessageList.spec.tsx` covers these seven behaviors in English and
Vietnamese. Real-session checks verified localized history and Copy.

The broader Vietnamese benchmark and final complete responsive/light/dark
acceptance are still follow-up work; the scoped tests do not certify every
question or UI state.

The activity component tests cover status animation, actual step updates,
answer generation, collapse/expand, terminal timing, failure/cancellation,
Vietnamese, reduced motion, scoped busy state, cleanup and long labels.
Existing AI workspace tests cover stream integration, validation, Project
permission failures and citation dialog open/close.

Live QA uses the real local FE/BFF/SAG services, normal test-account sign-in,
and screenshots at 390, 768, 1280 and 1440 pixels. Stop intentionally aborts
its in-flight request. The browser also recorded Project permission-check 403
responses and `/chat/ws-ticket` 503 responses from the separate messaging
connection. These remain outside this activity UI change. AI Chat SSE requests
completed with HTTP 200; the selected test project returned an empty-evidence
answer. Unit fixtures are not evidence of live retrieval acceptance.

No database, environment, authentication, authorization, citation or provider
configuration changes are required. Rollback is reverting the activity UI
commit; the prior Vietnamese-localization commit can be retained independently.
