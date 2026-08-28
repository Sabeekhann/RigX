# Product vision

## Thesis

As coding models improve, an increasing share of engineering leverage comes from the **harness** around the model: context, repository structure, instructions, tools, skills, hooks, verification, permissions, and feedback loops.

RIGX exists to make that harness an observable and improvable engineering system.

## The problem

Teams currently improve coding-agent behavior mostly by intuition:

1. an agent fails;
2. someone adds another instruction;
3. context grows;
4. the next task feels better or worse;
5. nobody can prove which harness change helped.

This does not scale.

## The intended end state

RIGX should eventually answer where repositories make agents waste time/context, which deterministic requirements should be hooks rather than prose, what information agents repeatedly rediscover, which skills/tools improve outcomes, and whether a harness change actually improves task success, cost, retries, or verification adherence across Claude Code and Codex.

## Product boundary

RIGX should not own the coding conversation. Developers continue using their preferred agent.

RIGX owns the engineering loop around the agent:

```text
agent → local signals → harness evidence → candidate improvement → evaluation
```

The project succeeds when developers can improve agent reliability without surrendering source code or session history to a mandatory hosted service.
