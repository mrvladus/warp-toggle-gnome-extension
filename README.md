# WARP Toggle

#### Toggle Cloudflare WARP connection from Quick Settings menu

### Install

1. Install [warp-cli](https://developers.cloudflare.com/warp-client/get-started/linux/)
2. Register new connection:

```bash
$ warp-cli registration new
```

3. Install extension:

```bash
./build.sh install
```

### Uninstall

To delete extension run:

```bash
./build.sh uninstall
```

Or manually remove this directory: `~/.local/share/gnome-shell/extensions/warptoggle@mrvladus.github.io`
