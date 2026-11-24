# AI usage

## Tools used

| Tool | What I used it for |
|---|---|
| Claude Code (Anthropic, Claude Opus 5.5 model) in the terminal | Planning the architecture, writing code step by step (backend routes and services, SQL schema, React pages), running curl checks and the race test, taking headless screenshots to check the layout at 375 / 768 / 1280 px, and drafting the documentation |

I worked step by step: the AI proposed and wrote each step, explained what was added and why, I reviewed it, and then it was committed. All commits are mine. AI help is declared here instead of in commit trailers.

## Where I verified or overrode the AI

1. **Commit attribution.** The AI tool by default adds a `Co-Authored-By` trailer for itself to commits. Rule Q3 asks for exactly one human contributor and no co-author trailers, so I chose to commit without the trailer and declare AI use in this file instead.

2. **Checking the performance claim with evidence.** After the indexes were added, the easy story would have been "the trigram index makes search fast". Before it went into SOLUTION.md, the query plans were checked with `EXPLAIN ANALYZE`. They showed Postgres still uses a **Seq Scan** for `q=crash` on ~2,000 rows, because the table is small. So part C says this honestly: the search gain came from removing the second round trip (`COUNT(*) OVER()`), not from the trigram index.

3. **Screenshot check at 375 px.** The first version of the filter bar looked fine on desktop, but the 375 px screenshot showed the dropdown placeholders cut off ("Any s…"). They were shortened to "Status / Category / Priority" in a follow-up commit.

4. **Rule interpretation I accepted after review.** The spec calls `autoCategory` "immutable" but also asks to re-run classification on re-import. The AI proposed: agents can never change `autoCategory`, but the classifier may refresh it while no human has overridden the category. I reviewed this against T-B2 and kept it. It is documented in SOLUTION.md part B.
