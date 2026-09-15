// @ts-nocheck
export const PR_TITLE = 'Add Gizzi Code GitHub Workflow'

export const GITHUB_ACTION_SETUP_DOCS_URL =
  'https://docs.gizziio.com'

export const WORKFLOW_CONTENT = `name: Gizzi Code

on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]
  issues:
    types: [opened, assigned]
  pull_request_review:
    types: [submitted]

jobs:
  gizzi:
    if: |
      (github.event_name == 'issue_comment' && contains(github.event.comment.body, '@gizzi')) ||
      (github.event_name == 'pull_request_review_comment' && contains(github.event.comment.body, '@gizzi')) ||
      (github.event_name == 'pull_request_review' && contains(github.event.review.body, '@gizzi')) ||
      (github.event_name == 'issues' && (contains(github.event.issue.body, '@gizzi') || contains(github.event.issue.title, '@gizzi')))
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read
      issues: read
      id-token: write
      actions: read # Required for Gizzi to read CI results on PRs
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Run Gizzi Code
        id: gizzi
        env:
          ALLTERNIT_API_KEY: \${{ secrets.ALLTERNIT_API_KEY }}
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: |
          npm install -g @allternit/gizzi-code
          BODY="\${{ github.event.comment.body || github.event.review.body || github.event.issue.body }}"
          gizzi exec "$BODY"

`

export const PR_BODY = `## 🤖 Installing Gizzi Code GitHub App

This PR adds a GitHub Actions workflow that enables Gizzi Code integration in our repository.

### What is Gizzi Code?

[Gizzi Code](https://docs.gizziio.com) is an AI coding agent that can help with:
- Bug fixes and improvements  
- Documentation updates
- Implementing new features
- Code reviews and suggestions
- Writing tests
- And more!

### How it works

Once this PR is merged, we'll be able to interact with Gizzi by mentioning @gizzi in a pull request or issue comment.
Once the workflow is triggered, Gizzi will analyze the comment and surrounding context, and execute on the request in a GitHub action.

### Important Notes

- **This workflow won't take effect until this PR is merged**
- **@gizzi mentions won't work until after the merge is complete**
- The workflow runs automatically whenever @gizzi is mentioned in PR or issue comments
- Gizzi gets access to the entire PR or issue context including files, diffs, and previous comments

### Security

- Our API key is securely stored as a GitHub Actions secret
- Only users with write access to the repository can trigger the workflow
- All Gizzi runs are stored in the GitHub Actions run history
- Gizzi's default tools are limited to reading/writing files and interacting with our repo by creating comments, branches, and commits.
- We can add more allowed tools by adding them to the workflow file like:

\`\`\`
allowed_tools: Bash(npm install),Bash(npm run build),Bash(npm run lint),Bash(npm run test)
\`\`\`

Store your Allternit API key as the \`ALLTERNIT_API_KEY\` repository secret.

After merging this PR, mention @gizzi in a comment on any PR to get started!`

export const CODE_REVIEW_PLUGIN_WORKFLOW_CONTENT = `name: Gizzi Code Review

on:
  pull_request:
    types: [opened, synchronize, ready_for_review, reopened]
    # Optional: Only run on specific file changes
    # paths:
    #   - "src/**/*.ts"
    #   - "src/**/*.tsx"
    #   - "src/**/*.js"
    #   - "src/**/*.jsx"

jobs:
  gizzi-review:
    # Optional: Filter by PR author
    # if: |
    #   github.event.pull_request.user.login == 'external-contributor' ||
    #   github.event.pull_request.user.login == 'new-developer' ||
    #   github.event.pull_request.author_association == 'FIRST_TIME_CONTRIBUTOR'

    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read
      issues: read
      id-token: write

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Run Gizzi Code Review
        id: gizzi-review
        env:
          ALLTERNIT_API_KEY: \${{ secrets.ALLTERNIT_API_KEY }}
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: |
          npm install -g @allternit/gizzi-code
          gh pr diff \${{ github.event.pull_request.number }} | gizzi exec "Review this pull request for bugs, security issues, and style violations. Post a concise review."

`
