# Git Push Restriction & User Authorization Policy

## Mandatory Constraint
**NEVER execute `git push` (or any command that pushes modifications to remote repositories such as GitHub or origin) without the user's explicit command or prior confirmation.**

---

### Core Guidelines

1. **No Unsolicited Pushing**:
   - You may stage (`git add`) and commit (`git commit`) changes locally as part of developing, refactoring, and verifying code.
   - You must **NEVER** run `git push` automatically after finishing a task, refactor, or test suite.
   - Pushing to remote repositories alters team branches and remote history, which requires explicit user oversight.

2. **When `git push` Is Allowed**:
   - You may ONLY execute `git push` when the user explicitly provides a direct command or consent in their prompt (e.g., *"push to GitHub"*, *"push back to origin"*, *"git push"*).
   - If the user has not explicitly requested a push, you must keep the commit local, report that the commit is saved locally on the branch, and ask the user whether they would like you to push it.

3. **Prohibited Variations**:
   - `git push`
   - `git push origin <branch>`
   - `git push --force` or `git push --force-with-lease`
   - Any script, tool, or command sequence that triggers a remote push without user instruction.
