# claude-plugins

My plugins for [Claude Code](https://claude.com/claude-code), published as one marketplace (`winazar`).

## Plugins

| Plugin | What it does |
| --- | --- |
| [usage-band](plugins/usage-band) | One line under the prompt: the 5-hour and weekly rate-limit windows with the time until each resets, and how full the context window is, e.g. `5h 18% (4h 11m) · week 6% (5d 20h) · ctx 7% 66k/1M`. |

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install usage-band --marketplace WinaZar/claude-plugins
```

Answer `y` to add the marketplace, then pick a scope (`user` loads it in every session).
Once the marketplace is added, any other plugin here installs with:

```
/plugin install <plugin>@winazar
```

From a shell:

```
claude plugin install usage-band --marketplace WinaZar/claude-plugins
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `WinaZar/claude-plugins`, then Add plugin.

To pick up a new version: `claude plugin update usage-band@winazar`, then `/reload-plugins` in a running session.
