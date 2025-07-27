# WARP Toggle

#### Toggle Cloudflare WARP connection from Quick Settings menu

### Install

#### Prerequisite

1. Install [warp-cli](https://developers.cloudflare.com/warp-client/get-started/linux/)
2. Register new connection:

```bash
warp-cli registration new
```

#### Using Extension Manager

1. Download [Extension Manager](https://flathub.org/apps/com.mattjakeman.ExtensionManager) flatpak
2. Search for `WARP Toggle` extension and click `Install`

#### Using GNOME Extensions website

Go to [this](https://extensions.gnome.org/extension/7905/warp-toggle/) page and follow click `Install` button.

#### Installing from source

1. Clone repo:

```bash
git clone https:github.com/mrvladus/warp-toggle-gnome-extension && cd warp-toggle-gnome-extension
```

2. Install extension:

```bash
./build install
```

3. To uninstall extension run:

```bash
./build uninstall
```

Or manually remove this directory: `~/.local/share/gnome-shell/extensions/warptoggle@mrvladus.github.io`
